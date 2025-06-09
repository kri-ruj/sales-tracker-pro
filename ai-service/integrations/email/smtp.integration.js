const nodemailer = require('nodemailer');
const BaseTool = require('../../core/registry/tool-interface');
const fs = require('fs').promises;
const path = require('path');

/**
 * Generic SMTP Email Integration
 * Support for multiple email providers via SMTP
 */
class SMTPIntegration extends BaseTool {
    constructor() {
        super({
            name: 'smtpIntegration',
            description: 'Send emails through any SMTP server (Gmail, Outlook, Yahoo, custom)',
            category: 'integration',
            version: '1.0.0',
            
            parameters: {
                operation: {
                    type: 'string',
                    description: 'Operation: sendEmail, sendBulkEmails, verifyConnection, sendTemplate',
                    required: true,
                    validate: (value) => ['sendEmail', 'sendBulkEmails', 'verifyConnection', 'sendTemplate'].includes(value)
                },
                provider: {
                    type: 'string',
                    description: 'Email provider: gmail, outlook, yahoo, custom',
                    required: false,
                    default: 'custom'
                },
                emailData: {
                    type: 'object',
                    description: 'Email data',
                    required: false,
                    properties: {
                        from: { type: 'string' },
                        to: { type: 'string' },
                        cc: { type: 'string' },
                        bcc: { type: 'string' },
                        subject: { type: 'string' },
                        text: { type: 'string' },
                        html: { type: 'string' },
                        attachments: { type: 'array' },
                        headers: { type: 'object' },
                        priority: { type: 'string' }, // high, normal, low
                        replyTo: { type: 'string' },
                        inReplyTo: { type: 'string' },
                        references: { type: 'string' }
                    }
                },
                bulkEmails: {
                    type: 'array',
                    description: 'Array of email data for bulk sending',
                    required: false
                },
                template: {
                    type: 'object',
                    description: 'Email template configuration',
                    required: false,
                    properties: {
                        name: { type: 'string' },
                        variables: { type: 'object' }
                    }
                },
                smtpConfig: {
                    type: 'object',
                    description: 'Custom SMTP configuration',
                    required: false,
                    properties: {
                        host: { type: 'string' },
                        port: { type: 'number' },
                        secure: { type: 'boolean' },
                        auth: { type: 'object' }
                    }
                }
            },
            
            requiresAuth: true,
            timeout: 30000,
            retryable: true,
            maxRetries: 2
        });

        this.transporter = null;
        this.connectionPool = new Map();
        this.mockMode = process.env.NODE_ENV === 'development' || !process.env.SMTP_HOST;
        
        // Provider presets
        this.providerPresets = {
            gmail: {
                host: 'smtp.gmail.com',
                port: 587,
                secure: false,
                requiresAuth: true
            },
            outlook: {
                host: 'smtp-mail.outlook.com',
                port: 587,
                secure: false,
                requiresAuth: true,
                tls: {
                    ciphers: 'SSLv3'
                }
            },
            yahoo: {
                host: 'smtp.mail.yahoo.com',
                port: 465,
                secure: true,
                requiresAuth: true
            },
            sendgrid: {
                host: 'smtp.sendgrid.net',
                port: 587,
                secure: false,
                requiresAuth: true
            },
            mailgun: {
                host: 'smtp.mailgun.org',
                port: 587,
                secure: false,
                requiresAuth: true
            }
        };

        // Email templates
        this.templates = {
            welcome: {
                subject: 'Welcome to {{company}}!',
                html: `
                    <h1>Welcome {{name}}!</h1>
                    <p>Thank you for joining {{company}}. We're excited to have you on board.</p>
                    <p>Best regards,<br>The {{company}} Team</p>
                `
            },
            notification: {
                subject: '{{type}} Notification',
                html: `
                    <h2>{{type}} Notification</h2>
                    <p>{{message}}</p>
                    <p>Time: {{timestamp}}</p>
                `
            },
            invoice: {
                subject: 'Invoice #{{invoiceNumber}} from {{company}}',
                html: `
                    <h1>Invoice #{{invoiceNumber}}</h1>
                    <p>Dear {{customerName}},</p>
                    <p>Please find attached your invoice for {{amount}}.</p>
                    <p>Due date: {{dueDate}}</p>
                    <p>Thank you for your business!</p>
                `
            }
        };
    }

    /**
     * Initialize SMTP transporter
     */
    async initialize() {
        if (this.mockMode) {
            this.logger.info('SMTP integration running in mock mode');
            return;
        }

        try {
            // Default SMTP configuration from environment
            const defaultConfig = {
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            };

            if (defaultConfig.host && defaultConfig.auth.user) {
                this.transporter = nodemailer.createTransporter(defaultConfig);
                await this.verifyTransporter(this.transporter);
                this.logger.info('Default SMTP transporter initialized');
            }
        } catch (error) {
            this.logger.error('Failed to initialize SMTP', { error: error.message });
            this.mockMode = true;
        }
    }

    /**
     * Execute SMTP operation
     */
    async execute(parameters, context) {
        const { operation } = parameters;

        if (this.mockMode && operation !== 'verifyConnection') {
            return this.executeMock(operation, parameters);
        }

        switch (operation) {
            case 'sendEmail':
                return this.sendEmail(parameters, context);
            
            case 'sendBulkEmails':
                return this.sendBulkEmails(parameters, context);
            
            case 'verifyConnection':
                return this.verifyConnection(parameters);
            
            case 'sendTemplate':
                return this.sendTemplate(parameters, context);
            
            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
    }

    /**
     * Send a single email
     */
    async sendEmail(parameters, context) {
        try {
            const transporter = await this.getTransporter(parameters.provider, parameters.smtpConfig);
            const emailOptions = this.prepareEmailOptions(parameters.emailData);
            
            // Add attachments if any
            if (parameters.emailData.attachments) {
                emailOptions.attachments = await this.prepareAttachments(parameters.emailData.attachments);
            }

            const info = await transporter.sendMail(emailOptions);

            return {
                success: true,
                messageId: info.messageId,
                response: info.response,
                summary: `Email sent successfully to ${emailOptions.to}`,
                details: {
                    from: emailOptions.from,
                    to: emailOptions.to,
                    subject: emailOptions.subject,
                    timestamp: new Date().toISOString(),
                    accepted: info.accepted,
                    rejected: info.rejected
                }
            };

        } catch (error) {
            throw new Error(`Failed to send email: ${error.message}`);
        }
    }

    /**
     * Send bulk emails
     */
    async sendBulkEmails(parameters, context) {
        try {
            const transporter = await this.getTransporter(parameters.provider, parameters.smtpConfig);
            const results = [];
            const failed = [];

            // Process emails in batches to avoid overwhelming the server
            const batchSize = 10;
            for (let i = 0; i < parameters.bulkEmails.length; i += batchSize) {
                const batch = parameters.bulkEmails.slice(i, i + batchSize);
                
                const batchPromises = batch.map(async (emailData) => {
                    try {
                        const emailOptions = this.prepareEmailOptions(emailData);
                        const info = await transporter.sendMail(emailOptions);
                        results.push({
                            to: emailOptions.to,
                            messageId: info.messageId,
                            status: 'sent'
                        });
                    } catch (error) {
                        failed.push({
                            to: emailData.to,
                            error: error.message,
                            status: 'failed'
                        });
                    }
                });

                await Promise.all(batchPromises);
                
                // Add delay between batches
                if (i + batchSize < parameters.bulkEmails.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            return {
                success: true,
                summary: `Bulk email operation completed: ${results.length} sent, ${failed.length} failed`,
                details: {
                    sent: results.length,
                    failed: failed.length,
                    total: parameters.bulkEmails.length,
                    results: results,
                    failures: failed
                }
            };

        } catch (error) {
            throw new Error(`Failed to send bulk emails: ${error.message}`);
        }
    }

    /**
     * Verify SMTP connection
     */
    async verifyConnection(parameters) {
        try {
            const transporter = await this.getTransporter(parameters.provider, parameters.smtpConfig);
            await this.verifyTransporter(transporter);

            return {
                success: true,
                summary: 'SMTP connection verified successfully',
                details: {
                    provider: parameters.provider || 'custom',
                    host: transporter.options.host,
                    port: transporter.options.port,
                    secure: transporter.options.secure
                }
            };

        } catch (error) {
            return {
                success: false,
                summary: 'SMTP connection verification failed',
                error: error.message,
                details: {
                    provider: parameters.provider || 'custom'
                }
            };
        }
    }

    /**
     * Send email using template
     */
    async sendTemplate(parameters, context) {
        try {
            const { template, emailData } = parameters;
            
            // Get template
            const emailTemplate = this.templates[template.name];
            if (!emailTemplate) {
                throw new Error(`Template "${template.name}" not found`);
            }

            // Process template variables
            const processedSubject = this.processTemplate(emailTemplate.subject, template.variables);
            const processedHtml = this.processTemplate(emailTemplate.html, template.variables);

            // Merge with email data
            const finalEmailData = {
                ...emailData,
                subject: processedSubject,
                html: processedHtml
            };

            // Send email
            return this.sendEmail({
                ...parameters,
                emailData: finalEmailData
            }, context);

        } catch (error) {
            throw new Error(`Failed to send template email: ${error.message}`);
        }
    }

    /**
     * Get or create transporter
     */
    async getTransporter(provider = 'custom', customConfig = null) {
        // Check connection pool
        const poolKey = provider + JSON.stringify(customConfig || {});
        if (this.connectionPool.has(poolKey)) {
            return this.connectionPool.get(poolKey);
        }

        let config;

        if (provider !== 'custom' && this.providerPresets[provider]) {
            // Use provider preset
            const preset = this.providerPresets[provider];
            config = {
                ...preset,
                auth: customConfig?.auth || {
                    user: process.env[`SMTP_${provider.toUpperCase()}_USER`],
                    pass: process.env[`SMTP_${provider.toUpperCase()}_PASS`]
                }
            };
        } else if (customConfig) {
            // Use custom configuration
            config = customConfig;
        } else if (this.transporter) {
            // Use default transporter
            return this.transporter;
        } else {
            throw new Error('No SMTP configuration provided');
        }

        // Create transporter
        const transporter = nodemailer.createTransporter(config);
        
        // Verify connection
        await this.verifyTransporter(transporter);
        
        // Add to pool
        this.connectionPool.set(poolKey, transporter);
        
        return transporter;
    }

    /**
     * Verify transporter connection
     */
    async verifyTransporter(transporter) {
        return new Promise((resolve, reject) => {
            transporter.verify((error, success) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(success);
                }
            });
        });
    }

    /**
     * Prepare email options for nodemailer
     */
    prepareEmailOptions(emailData) {
        const options = {
            from: emailData.from || process.env.SMTP_FROM_EMAIL,
            to: emailData.to,
            subject: emailData.subject
        };

        // Set content
        if (emailData.html) {
            options.html = emailData.html;
        }
        if (emailData.text) {
            options.text = emailData.text;
        } else if (emailData.html) {
            // Generate text from HTML if not provided
            options.text = emailData.html.replace(/<[^>]*>/g, '');
        }

        // Optional fields
        if (emailData.cc) options.cc = emailData.cc;
        if (emailData.bcc) options.bcc = emailData.bcc;
        if (emailData.replyTo) options.replyTo = emailData.replyTo;
        if (emailData.inReplyTo) options.inReplyTo = emailData.inReplyTo;
        if (emailData.references) options.references = emailData.references;
        if (emailData.headers) options.headers = emailData.headers;

        // Priority
        if (emailData.priority) {
            const priorityMap = {
                high: 'high',
                normal: 'normal',
                low: 'low'
            };
            options.priority = priorityMap[emailData.priority] || 'normal';
        }

        return options;
    }

    /**
     * Prepare attachments
     */
    async prepareAttachments(attachments) {
        const preparedAttachments = [];

        for (const attachment of attachments) {
            const preparedAttachment = {
                filename: attachment.filename
            };

            if (attachment.content) {
                // Base64 content
                preparedAttachment.content = attachment.content;
                preparedAttachment.encoding = 'base64';
            } else if (attachment.path) {
                // File path
                preparedAttachment.path = attachment.path;
            } else if (attachment.href) {
                // URL
                preparedAttachment.href = attachment.href;
            }

            if (attachment.contentType) {
                preparedAttachment.contentType = attachment.contentType;
            }

            if (attachment.cid) {
                preparedAttachment.cid = attachment.cid;
            }

            preparedAttachments.push(preparedAttachment);
        }

        return preparedAttachments;
    }

    /**
     * Process template with variables
     */
    processTemplate(template, variables) {
        let processed = template;
        
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            processed = processed.replace(regex, value);
        }
        
        return processed;
    }

    /**
     * Mock implementations
     */
    executeMock(operation, parameters) {
        switch (operation) {
            case 'sendEmail':
                return {
                    success: true,
                    messageId: `<mock-${Date.now()}@smtp.local>`,
                    response: '250 Message accepted',
                    summary: `[MOCK] Email sent to ${parameters.emailData.to}`,
                    details: {
                        from: parameters.emailData.from || 'noreply@example.com',
                        to: parameters.emailData.to,
                        subject: parameters.emailData.subject,
                        timestamp: new Date().toISOString(),
                        accepted: [parameters.emailData.to],
                        rejected: []
                    }
                };

            case 'sendBulkEmails':
                const bulkResults = parameters.bulkEmails.map((email, index) => ({
                    to: email.to,
                    messageId: `<mock-bulk-${Date.now()}-${index}@smtp.local>`,
                    status: Math.random() > 0.1 ? 'sent' : 'failed'
                }));
                
                const sent = bulkResults.filter(r => r.status === 'sent');
                const failed = bulkResults.filter(r => r.status === 'failed');
                
                return {
                    success: true,
                    summary: `[MOCK] Bulk email: ${sent.length} sent, ${failed.length} failed`,
                    details: {
                        sent: sent.length,
                        failed: failed.length,
                        total: parameters.bulkEmails.length,
                        results: sent,
                        failures: failed
                    }
                };

            case 'sendTemplate':
                return {
                    success: true,
                    messageId: `<mock-template-${Date.now()}@smtp.local>`,
                    response: '250 Message accepted',
                    summary: `[MOCK] Template "${parameters.template.name}" sent to ${parameters.emailData.to}`,
                    details: {
                        template: parameters.template.name,
                        to: parameters.emailData.to,
                        timestamp: new Date().toISOString()
                    }
                };

            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
    }
}

module.exports = SMTPIntegration;