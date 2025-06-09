const GmailIntegration = require('../integrations/email/gmail.integration');
const OutlookIntegration = require('../integrations/email/outlook.integration');
const SMTPIntegration = require('../integrations/email/smtp.integration');

/**
 * Unified Email Service
 * Manages multiple email providers and provides a consistent interface
 */
class EmailService {
    constructor() {
        this.providers = new Map();
        this.defaultProvider = process.env.DEFAULT_EMAIL_PROVIDER || 'smtp';
        this.initialized = false;
        
        // Logger
        this.logger = {
            info: (message, data) => console.log(`[EmailService] INFO:`, message, data || ''),
            error: (message, data) => console.error(`[EmailService] ERROR:`, message, data || ''),
            warn: (message, data) => console.warn(`[EmailService] WARN:`, message, data || ''),
            debug: (message, data) => console.debug(`[EmailService] DEBUG:`, message, data || '')
        };
    }

    /**
     * Initialize all configured email providers
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // Initialize Gmail if configured
            if (process.env.GOOGLE_GMAIL_CREDENTIALS || process.env.GMAIL_ENABLED === 'true') {
                const gmail = new GmailIntegration();
                await gmail.initialize();
                this.providers.set('gmail', gmail);
                this.logger.info('Gmail provider initialized');
            }

            // Initialize Outlook if configured
            if (process.env.OUTLOOK_CLIENT_ID || process.env.OUTLOOK_ENABLED === 'true') {
                const outlook = new OutlookIntegration();
                await outlook.initialize();
                this.providers.set('outlook', outlook);
                this.logger.info('Outlook provider initialized');
            }

            // Always initialize SMTP as fallback
            const smtp = new SMTPIntegration();
            await smtp.initialize();
            this.providers.set('smtp', smtp);
            this.logger.info('SMTP provider initialized');

            // Set default provider if not available
            if (!this.providers.has(this.defaultProvider)) {
                this.defaultProvider = 'smtp';
                this.logger.warn('Default provider not available, falling back to SMTP');
            }

            this.initialized = true;
            this.logger.info(`Email service initialized with ${this.providers.size} providers`);
        } catch (error) {
            this.logger.error('Failed to initialize email service', { error: error.message });
            throw error;
        }
    }

    /**
     * Send email using specified or default provider
     */
    async sendEmail(emailData, options = {}) {
        await this.ensureInitialized();

        const provider = options.provider || this.defaultProvider;
        const integration = this.providers.get(provider);

        if (!integration) {
            throw new Error(`Email provider "${provider}" not available`);
        }

        try {
            // Convert email data to provider-specific format
            const providerData = this.convertEmailData(emailData, provider);
            
            const result = await integration.run({
                operation: 'sendEmail',
                emailData: providerData
            }, options.context || {});

            if (!result.success) {
                throw new Error(result.error || 'Failed to send email');
            }

            return {
                success: true,
                provider: provider,
                ...result.data
            };

        } catch (error) {
            this.logger.error(`Failed to send email via ${provider}`, { error: error.message });
            
            // Try fallback provider if available
            if (options.fallback !== false && provider !== 'smtp') {
                this.logger.info('Attempting to send via SMTP fallback');
                return this.sendEmail(emailData, { ...options, provider: 'smtp', fallback: false });
            }
            
            throw error;
        }
    }

    /**
     * Send bulk emails
     */
    async sendBulkEmails(emails, options = {}) {
        await this.ensureInitialized();

        const provider = options.provider || this.defaultProvider;
        
        // SMTP is best for bulk emails
        if (provider !== 'smtp' && this.providers.has('smtp')) {
            this.logger.info('Using SMTP for bulk email operation');
            const smtp = this.providers.get('smtp');
            
            const result = await smtp.run({
                operation: 'sendBulkEmails',
                bulkEmails: emails,
                provider: options.smtpProvider || 'custom',
                smtpConfig: options.smtpConfig
            });

            return {
                success: result.success,
                provider: 'smtp',
                ...result.data
            };
        }

        // Fallback to sending individual emails
        const results = [];
        const failed = [];

        for (const email of emails) {
            try {
                const result = await this.sendEmail(email, options);
                results.push({
                    to: email.to,
                    status: 'sent',
                    messageId: result.messageId
                });
            } catch (error) {
                failed.push({
                    to: email.to,
                    status: 'failed',
                    error: error.message
                });
            }
        }

        return {
            success: true,
            provider: provider,
            summary: `Sent ${results.length} emails, ${failed.length} failed`,
            details: {
                sent: results.length,
                failed: failed.length,
                total: emails.length,
                results: results,
                failures: failed
            }
        };
    }

    /**
     * Send template email
     */
    async sendTemplateEmail(templateName, variables, emailData, options = {}) {
        await this.ensureInitialized();

        // SMTP has built-in template support
        if (this.providers.has('smtp')) {
            const smtp = this.providers.get('smtp');
            
            const result = await smtp.run({
                operation: 'sendTemplate',
                template: {
                    name: templateName,
                    variables: variables
                },
                emailData: emailData,
                provider: options.smtpProvider,
                smtpConfig: options.smtpConfig
            });

            return {
                success: result.success,
                provider: 'smtp',
                ...result.data
            };
        }

        // For other providers, manually process template
        const templates = {
            welcome: {
                subject: `Welcome to ${variables.company}!`,
                html: `
                    <h1>Welcome ${variables.name}!</h1>
                    <p>Thank you for joining ${variables.company}. We're excited to have you on board.</p>
                    <p>Best regards,<br>The ${variables.company} Team</p>
                `
            },
            notification: {
                subject: `${variables.type} Notification`,
                html: `
                    <h2>${variables.type} Notification</h2>
                    <p>${variables.message}</p>
                    <p>Time: ${variables.timestamp || new Date().toISOString()}</p>
                `
            }
        };

        const template = templates[templateName];
        if (!template) {
            throw new Error(`Template "${templateName}" not found`);
        }

        const processedEmailData = {
            ...emailData,
            subject: template.subject,
            html: template.html,
            isHtml: true
        };

        return this.sendEmail(processedEmailData, options);
    }

    /**
     * Search emails (provider-specific)
     */
    async searchEmails(query, options = {}) {
        await this.ensureInitialized();

        const provider = options.provider || this.defaultProvider;
        const integration = this.providers.get(provider);

        if (!integration) {
            throw new Error(`Email provider "${provider}" not available`);
        }

        // Only Gmail and Outlook support search
        if (provider === 'smtp') {
            throw new Error('Email search is not supported by SMTP provider');
        }

        const result = await integration.run({
            operation: 'searchEmails',
            searchQuery: query,
            maxResults: options.maxResults || 10
        });

        return {
            success: result.success,
            provider: provider,
            ...result.data
        };
    }

    /**
     * Create draft (provider-specific)
     */
    async createDraft(emailData, options = {}) {
        await this.ensureInitialized();

        const provider = options.provider || this.defaultProvider;
        const integration = this.providers.get(provider);

        if (!integration) {
            throw new Error(`Email provider "${provider}" not available`);
        }

        // Only Gmail and Outlook support drafts
        if (provider === 'smtp') {
            throw new Error('Draft creation is not supported by SMTP provider');
        }

        const providerData = this.convertEmailData(emailData, provider);
        
        const result = await integration.run({
            operation: 'createDraft',
            emailData: providerData
        });

        return {
            success: result.success,
            provider: provider,
            ...result.data
        };
    }

    /**
     * Verify connection
     */
    async verifyConnection(provider = null) {
        await this.ensureInitialized();

        const targetProvider = provider || this.defaultProvider;
        
        if (targetProvider === 'smtp' && this.providers.has('smtp')) {
            const smtp = this.providers.get('smtp');
            const result = await smtp.run({
                operation: 'verifyConnection'
            });
            
            return {
                provider: 'smtp',
                ...result.data || result
            };
        }

        // For other providers, just check if they're initialized
        if (this.providers.has(targetProvider)) {
            return {
                success: true,
                provider: targetProvider,
                summary: `${targetProvider} provider is initialized and ready`
            };
        }

        return {
            success: false,
            provider: targetProvider,
            summary: `${targetProvider} provider is not available`
        };
    }

    /**
     * Get available providers
     */
    getAvailableProviders() {
        return {
            providers: Array.from(this.providers.keys()),
            default: this.defaultProvider,
            capabilities: {
                gmail: ['send', 'search', 'draft', 'folders'],
                outlook: ['send', 'search', 'draft', 'folders', 'categories'],
                smtp: ['send', 'bulk', 'templates', 'custom-config']
            }
        };
    }

    /**
     * Convert email data between provider formats
     */
    convertEmailData(emailData, provider) {
        switch (provider) {
            case 'gmail':
                return {
                    to: emailData.to,
                    cc: emailData.cc,
                    bcc: emailData.bcc,
                    subject: emailData.subject,
                    body: emailData.html || emailData.text || emailData.body,
                    isHtml: !!emailData.html || emailData.isHtml,
                    attachments: this.convertAttachments(emailData.attachments),
                    replyTo: emailData.replyTo
                };

            case 'outlook':
                return {
                    to: Array.isArray(emailData.to) ? emailData.to : [emailData.to],
                    cc: emailData.cc ? (Array.isArray(emailData.cc) ? emailData.cc : [emailData.cc]) : undefined,
                    bcc: emailData.bcc ? (Array.isArray(emailData.bcc) ? emailData.bcc : [emailData.bcc]) : undefined,
                    subject: emailData.subject,
                    body: emailData.html || emailData.text || emailData.body,
                    isHtml: !!emailData.html || emailData.isHtml,
                    attachments: this.convertAttachments(emailData.attachments),
                    importance: emailData.priority || emailData.importance || 'normal',
                    categories: emailData.categories || [],
                    requestReadReceipt: emailData.requestReadReceipt || false,
                    requestDeliveryReceipt: emailData.requestDeliveryReceipt || false
                };

            case 'smtp':
                return {
                    from: emailData.from,
                    to: emailData.to,
                    cc: emailData.cc,
                    bcc: emailData.bcc,
                    subject: emailData.subject,
                    text: emailData.text,
                    html: emailData.html,
                    attachments: emailData.attachments,
                    priority: emailData.priority,
                    replyTo: emailData.replyTo,
                    headers: emailData.headers
                };

            default:
                return emailData;
        }
    }

    /**
     * Convert attachments to provider format
     */
    convertAttachments(attachments) {
        if (!attachments || !Array.isArray(attachments)) return [];

        return attachments.map(att => ({
            filename: att.filename || att.name,
            content: att.content || att.data,
            contentType: att.contentType || att.mimeType || 'application/octet-stream',
            cid: att.cid,
            isInline: att.isInline || false
        }));
    }

    /**
     * Ensure service is initialized
     */
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }
}

// Export singleton instance
module.exports = new EmailService();