const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const AWS = require('aws-sdk');
const handlebars = require('handlebars');
const mjml2html = require('mjml');
const juice = require('juice');
const { parse } = require('node-html-parser');
const emailValidator = require('email-validator');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const winston = require('winston');

// Logger setup
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'email.log' }),
        new winston.transports.Console()
    ]
});

/**
 * Enhanced Email Service with comprehensive features
 */
class EnhancedEmailService {
    constructor(queueService, databaseService) {
        this.queueService = queueService;
        this.databaseService = databaseService;
        this.transporters = new Map();
        this.templates = new Map();
        this.compiledTemplates = new Map();
        this.activeProvider = null;
        this.initialized = false;
        
        // Email tracking pixels
        this.trackingEndpoint = process.env.EMAIL_TRACKING_ENDPOINT || 'https://api.yourdomain.com/track';
        
        // Provider configurations
        this.providers = {
            gmail: {
                type: 'smtp',
                config: {
                    host: 'smtp.gmail.com',
                    port: 587,
                    secure: false,
                    auth: {
                        user: process.env.GMAIL_USER,
                        pass: process.env.GMAIL_APP_PASSWORD
                    }
                }
            },
            sendgrid: {
                type: 'sendgrid',
                config: {
                    apiKey: process.env.SENDGRID_API_KEY
                }
            },
            ses: {
                type: 'ses',
                config: {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                    region: process.env.AWS_REGION || 'us-east-1'
                }
            },
            smtp: {
                type: 'smtp',
                config: {
                    host: process.env.SMTP_HOST,
                    port: parseInt(process.env.SMTP_PORT || '587'),
                    secure: process.env.SMTP_SECURE === 'true',
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS
                    }
                }
            }
        };
        
        // Handlebars helpers
        this.registerHandlebarsHelpers();
    }
    
    /**
     * Initialize email service
     */
    async initialize() {
        if (this.initialized) return;
        
        try {
            // Initialize providers
            await this.initializeProviders();
            
            // Load email templates
            await this.loadTemplates();
            
            // Setup email queue processors
            this.setupQueueProcessors();
            
            // Initialize database tables
            await this.initializeDatabase();
            
            this.initialized = true;
            logger.info('Enhanced email service initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize email service', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Initialize email providers
     */
    async initializeProviders() {
        // Gmail/SMTP
        if (this.providers.gmail.config.auth.user) {
            this.transporters.set('gmail', nodemailer.createTransporter(this.providers.gmail.config));
            logger.info('Gmail provider initialized');
        }
        
        // SendGrid
        if (this.providers.sendgrid.config.apiKey) {
            sgMail.setApiKey(this.providers.sendgrid.config.apiKey);
            this.transporters.set('sendgrid', sgMail);
            logger.info('SendGrid provider initialized');
        }
        
        // AWS SES
        if (this.providers.ses.config.accessKeyId) {
            AWS.config.update(this.providers.ses.config);
            this.transporters.set('ses', new AWS.SES());
            logger.info('AWS SES provider initialized');
        }
        
        // Custom SMTP
        if (this.providers.smtp.config.host) {
            this.transporters.set('smtp', nodemailer.createTransporter(this.providers.smtp.config));
            logger.info('Custom SMTP provider initialized');
        }
        
        // Set active provider
        this.activeProvider = process.env.DEFAULT_EMAIL_PROVIDER || 
                            Array.from(this.transporters.keys())[0] || 
                            'gmail';
    }
    
    /**
     * Load email templates
     */
    async loadTemplates() {
        const templatesDir = path.join(__dirname, '../templates/emails');
        
        // Create templates directory if it doesn't exist
        try {
            await fs.mkdir(templatesDir, { recursive: true });
        } catch (error) {
            // Directory might already exist
        }
        
        // Default templates
        const defaultTemplates = {
            welcome: {
                subject: 'Welcome to {{company}}!',
                mjml: `
<mjml>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-text font-size="28px" color="#333333" font-weight="bold">
          Welcome {{name}}!
        </mj-text>
        <mj-text font-size="16px" color="#555555">
          Thank you for joining {{company}}. We're excited to have you on board.
        </mj-text>
        <mj-button background-color="#007bff" href="{{ctaUrl}}">
          Get Started
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
                text: `Welcome {{name}}!\n\nThank you for joining {{company}}. We're excited to have you on board.\n\nGet started: {{ctaUrl}}`
            },
            sessionSummary: {
                subject: 'Your AI Agent Session Summary',
                mjml: `
<mjml>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-text font-size="24px" color="#333333" font-weight="bold">
          Session Summary
        </mj-text>
        <mj-text font-size="16px" color="#555555">
          Session ID: {{sessionId}}
        </mj-text>
        <mj-text font-size="16px" color="#555555">
          Duration: {{duration}}
        </mj-text>
        <mj-divider border-color="#eeeeee" />
        <mj-text font-size="18px" color="#333333" font-weight="bold">
          Queries Processed
        </mj-text>
        {{#each queries}}
        <mj-text font-size="14px" color="#555555">
          • {{this.query}} ({{this.status}})
        </mj-text>
        {{/each}}
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
                text: `Session Summary\n\nSession ID: {{sessionId}}\nDuration: {{duration}}\n\nQueries Processed:\n{{#each queries}}• {{this.query}} ({{this.status}})\n{{/each}}`
            },
            errorNotification: {
                subject: 'Error Alert: {{errorType}}',
                mjml: `
<mjml>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-text font-size="24px" color="#dc3545" font-weight="bold">
          Error Alert
        </mj-text>
        <mj-text font-size="16px" color="#555555">
          An error occurred in your AI Agent system.
        </mj-text>
        <mj-table>
          <tr>
            <td style="padding: 5px;"><strong>Error Type:</strong></td>
            <td style="padding: 5px;">{{errorType}}</td>
          </tr>
          <tr>
            <td style="padding: 5px;"><strong>Message:</strong></td>
            <td style="padding: 5px;">{{errorMessage}}</td>
          </tr>
          <tr>
            <td style="padding: 5px;"><strong>Time:</strong></td>
            <td style="padding: 5px;">{{timestamp}}</td>
          </tr>
        </mj-table>
        <mj-text font-size="14px" color="#777777">
          Stack Trace:
        </mj-text>
        <mj-text font-size="12px" color="#999999" font-family="monospace">
          {{stackTrace}}
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
                text: `Error Alert\n\nError Type: {{errorType}}\nMessage: {{errorMessage}}\nTime: {{timestamp}}\n\nStack Trace:\n{{stackTrace}}`
            },
            queryCompletion: {
                subject: 'Query Completed: {{queryId}}',
                mjml: `
<mjml>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-text font-size="24px" color="#28a745" font-weight="bold">
          Query Completed Successfully
        </mj-text>
        <mj-text font-size="16px" color="#555555">
          Your query has been processed.
        </mj-text>
        <mj-table>
          <tr>
            <td style="padding: 5px;"><strong>Query ID:</strong></td>
            <td style="padding: 5px;">{{queryId}}</td>
          </tr>
          <tr>
            <td style="padding: 5px;"><strong>Query:</strong></td>
            <td style="padding: 5px;">{{query}}</td>
          </tr>
          <tr>
            <td style="padding: 5px;"><strong>Processing Time:</strong></td>
            <td style="padding: 5px;">{{processingTime}}</td>
          </tr>
          <tr>
            <td style="padding: 5px;"><strong>Tools Used:</strong></td>
            <td style="padding: 5px;">{{toolsUsed}}</td>
          </tr>
        </mj-table>
        <mj-text font-size="18px" color="#333333" font-weight="bold">
          Result:
        </mj-text>
        <mj-text font-size="14px" color="#555555">
          {{result}}
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
                text: `Query Completed Successfully\n\nQuery ID: {{queryId}}\nQuery: {{query}}\nProcessing Time: {{processingTime}}\nTools Used: {{toolsUsed}}\n\nResult:\n{{result}}`
            },
            weeklyReport: {
                subject: 'Weekly Usage Report - {{weekStart}} to {{weekEnd}}',
                mjml: `
<mjml>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-text font-size="28px" color="#333333" font-weight="bold">
          Weekly Usage Report
        </mj-text>
        <mj-text font-size="16px" color="#555555">
          {{weekStart}} to {{weekEnd}}
        </mj-text>
        <mj-divider border-color="#eeeeee" />
        
        <!-- Statistics -->
        <mj-text font-size="20px" color="#333333" font-weight="bold">
          Statistics
        </mj-text>
        <mj-table>
          <tr>
            <td style="padding: 5px;"><strong>Total Queries:</strong></td>
            <td style="padding: 5px;">{{stats.totalQueries}}</td>
          </tr>
          <tr>
            <td style="padding: 5px;"><strong>Successful:</strong></td>
            <td style="padding: 5px;">{{stats.successful}}</td>
          </tr>
          <tr>
            <td style="padding: 5px;"><strong>Failed:</strong></td>
            <td style="padding: 5px;">{{stats.failed}}</td>
          </tr>
          <tr>
            <td style="padding: 5px;"><strong>Average Response Time:</strong></td>
            <td style="padding: 5px;">{{stats.avgResponseTime}}</td>
          </tr>
        </mj-table>
        
        <!-- Top Tools -->
        <mj-text font-size="20px" color="#333333" font-weight="bold">
          Most Used Tools
        </mj-text>
        {{#each topTools}}
        <mj-text font-size="14px" color="#555555">
          {{this.name}}: {{this.count}} uses
        </mj-text>
        {{/each}}
        
        <!-- Top Queries -->
        <mj-text font-size="20px" color="#333333" font-weight="bold">
          Top Query Types
        </mj-text>
        {{#each topQueries}}
        <mj-text font-size="14px" color="#555555">
          {{this.type}}: {{this.count}} queries
        </mj-text>
        {{/each}}
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
                text: `Weekly Usage Report\n{{weekStart}} to {{weekEnd}}\n\nStatistics:\n- Total Queries: {{stats.totalQueries}}\n- Successful: {{stats.successful}}\n- Failed: {{stats.failed}}\n- Average Response Time: {{stats.avgResponseTime}}\n\nMost Used Tools:\n{{#each topTools}}{{this.name}}: {{this.count}} uses\n{{/each}}\n\nTop Query Types:\n{{#each topQueries}}{{this.type}}: {{this.count}} queries\n{{/each}}`
            }
        };
        
        // Store templates
        for (const [name, template] of Object.entries(defaultTemplates)) {
            this.templates.set(name, template);
            
            // Compile templates
            this.compiledTemplates.set(name, {
                subject: handlebars.compile(template.subject),
                html: template.mjml,
                text: handlebars.compile(template.text)
            });
        }
        
        logger.info(`Loaded ${this.templates.size} email templates`);
    }
    
    /**
     * Register Handlebars helpers
     */
    registerHandlebarsHelpers() {
        handlebars.registerHelper('formatDate', (date) => {
            return new Date(date).toLocaleDateString();
        });
        
        handlebars.registerHelper('formatTime', (date) => {
            return new Date(date).toLocaleTimeString();
        });
        
        handlebars.registerHelper('formatDuration', (seconds) => {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;
            return `${hours}h ${minutes}m ${secs}s`;
        });
        
        handlebars.registerHelper('truncate', (str, length) => {
            if (str.length <= length) return str;
            return str.substring(0, length) + '...';
        });
        
        handlebars.registerHelper('json', (obj) => {
            return JSON.stringify(obj, null, 2);
        });
    }
    
    /**
     * Initialize database tables
     */
    async initializeDatabase() {
        // Create email logs table
        await this.databaseService.query(`
            CREATE TABLE IF NOT EXISTS email_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id TEXT UNIQUE,
                to_email TEXT NOT NULL,
                from_email TEXT NOT NULL,
                subject TEXT NOT NULL,
                template TEXT,
                provider TEXT,
                status TEXT DEFAULT 'pending',
                sent_at DATETIME,
                opened_at DATETIME,
                clicked_at DATETIME,
                bounced_at DATETIME,
                unsubscribed_at DATETIME,
                error TEXT,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create email preferences table
        await this.databaseService.query(`
            CREATE TABLE IF NOT EXISTS email_preferences (
                user_id TEXT PRIMARY KEY,
                email TEXT NOT NULL,
                notifications_enabled BOOLEAN DEFAULT 1,
                welcome_emails BOOLEAN DEFAULT 1,
                session_summaries BOOLEAN DEFAULT 1,
                error_notifications BOOLEAN DEFAULT 1,
                query_completions BOOLEAN DEFAULT 0,
                weekly_reports BOOLEAN DEFAULT 1,
                marketing_emails BOOLEAN DEFAULT 0,
                preferred_time TEXT DEFAULT '09:00',
                timezone TEXT DEFAULT 'UTC',
                unsubscribe_token TEXT UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create email bounces table
        await this.databaseService.query(`
            CREATE TABLE IF NOT EXISTS email_bounces (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                bounce_type TEXT NOT NULL,
                bounce_subtype TEXT,
                bounce_message TEXT,
                bounced_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create indexes
        await this.databaseService.query(`
            CREATE INDEX IF NOT EXISTS idx_email_logs_to_email ON email_logs(to_email);
            CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);
            CREATE INDEX IF NOT EXISTS idx_email_bounces_email ON email_bounces(email);
        `);
        
        logger.info('Email database tables initialized');
    }
    
    /**
     * Setup queue processors
     */
    setupQueueProcessors() {
        // Email sending processor
        this.queueService.queues.emailNotifications.process(async (job) => {
            const { type, data } = job.data;
            
            try {
                await job.progress(10);
                
                switch (type) {
                    case 'single':
                        await this.sendEmailInternal(data);
                        break;
                    case 'bulk':
                        await this.sendBulkEmailsInternal(data.emails, data.options);
                        break;
                    case 'template':
                        await this.sendTemplateEmailInternal(
                            data.template,
                            data.variables,
                            data.to,
                            data.options
                        );
                        break;
                    default:
                        throw new Error(`Unknown email job type: ${type}`);
                }
                
                await job.progress(100);
                logger.info(`Email job completed: ${job.id}`);
            } catch (error) {
                logger.error(`Email job failed: ${job.id}`, { error: error.message });
                throw error;
            }
        });
        
        // Weekly report processor
        this.queueService.queues.emailNotifications.process('weekly-report', async (job) => {
            try {
                await this.sendWeeklyReports();
                logger.info('Weekly reports sent successfully');
            } catch (error) {
                logger.error('Failed to send weekly reports', { error: error.message });
                throw error;
            }
        });
        
        // Schedule weekly reports
        this.queueService.queues.emailNotifications.add(
            'weekly-report',
            {},
            {
                repeat: {
                    cron: '0 9 * * 1' // Every Monday at 9 AM
                }
            }
        );
    }
    
    /**
     * Send email with tracking
     */
    async sendEmail(to, subject, content, options = {}) {
        await this.ensureInitialized();
        
        // Validate email
        if (!emailValidator.validate(to)) {
            throw new Error(`Invalid email address: ${to}`);
        }
        
        // Check if user has unsubscribed
        const preferences = await this.getUserPreferences(to);
        if (preferences && !preferences.notifications_enabled) {
            logger.info(`Email not sent - user unsubscribed: ${to}`);
            return { sent: false, reason: 'unsubscribed' };
        }
        
        // Queue the email
        const job = await this.queueService.queues.emailNotifications.add({
            type: 'single',
            data: {
                to,
                subject,
                content,
                options
            }
        });
        
        return {
            jobId: job.id,
            status: 'queued'
        };
    }
    
    /**
     * Internal email sending
     */
    async sendEmailInternal(data) {
        const { to, subject, content, options } = data;
        const messageId = crypto.randomBytes(16).toString('hex');
        const provider = options.provider || this.activeProvider;
        
        try {
            // Add tracking pixel and modify links
            const trackedContent = await this.addTracking(content, messageId, to);
            
            // Add unsubscribe link
            const finalContent = this.addUnsubscribeLink(trackedContent, to);
            
            // Send based on provider
            let result;
            switch (provider) {
                case 'sendgrid':
                    result = await this.sendViaSendGrid(to, subject, finalContent, options);
                    break;
                case 'ses':
                    result = await this.sendViaSES(to, subject, finalContent, options);
                    break;
                case 'gmail':
                case 'smtp':
                default:
                    result = await this.sendViaSMTP(provider, to, subject, finalContent, options);
            }
            
            // Log email
            await this.logEmail({
                message_id: messageId,
                to_email: to,
                from_email: options.from || process.env.DEFAULT_FROM_EMAIL,
                subject,
                template: options.template,
                provider,
                status: 'sent',
                sent_at: new Date(),
                metadata: JSON.stringify(options.metadata || {})
            });
            
            return result;
        } catch (error) {
            // Log failure
            await this.logEmail({
                message_id: messageId,
                to_email: to,
                from_email: options.from || process.env.DEFAULT_FROM_EMAIL,
                subject,
                template: options.template,
                provider,
                status: 'failed',
                error: error.message,
                metadata: JSON.stringify(options.metadata || {})
            });
            
            throw error;
        }
    }
    
    /**
     * Send via SMTP (Gmail or custom)
     */
    async sendViaSMTP(provider, to, subject, content, options) {
        const transporter = this.transporters.get(provider);
        if (!transporter) {
            throw new Error(`SMTP provider not configured: ${provider}`);
        }
        
        const mailOptions = {
            from: options.from || process.env.DEFAULT_FROM_EMAIL,
            to,
            subject,
            html: content.html,
            text: content.text,
            attachments: options.attachments,
            headers: {
                'X-Message-ID': options.messageId,
                ...options.headers
            }
        };
        
        const result = await transporter.sendMail(mailOptions);
        return {
            messageId: result.messageId,
            response: result.response
        };
    }
    
    /**
     * Send via SendGrid
     */
    async sendViaSendGrid(to, subject, content, options) {
        const msg = {
            to,
            from: options.from || process.env.DEFAULT_FROM_EMAIL,
            subject,
            text: content.text,
            html: content.html,
            customArgs: {
                messageId: options.messageId
            },
            trackingSettings: {
                clickTracking: { enable: true },
                openTracking: { enable: true }
            }
        };
        
        const result = await sgMail.send(msg);
        return {
            messageId: result[0].headers['x-message-id'],
            response: result[0].statusCode
        };
    }
    
    /**
     * Send via AWS SES
     */
    async sendViaSES(to, subject, content, options) {
        const ses = this.transporters.get('ses');
        if (!ses) {
            throw new Error('AWS SES not configured');
        }
        
        const params = {
            Destination: {
                ToAddresses: [to]
            },
            Message: {
                Body: {
                    Html: {
                        Charset: 'UTF-8',
                        Data: content.html
                    },
                    Text: {
                        Charset: 'UTF-8',
                        Data: content.text
                    }
                },
                Subject: {
                    Charset: 'UTF-8',
                    Data: subject
                }
            },
            Source: options.from || process.env.DEFAULT_FROM_EMAIL,
            ConfigurationSetName: process.env.SES_CONFIGURATION_SET
        };
        
        const result = await ses.sendEmail(params).promise();
        return {
            messageId: result.MessageId,
            response: result
        };
    }
    
    /**
     * Send template email
     */
    async sendTemplateEmail(templateName, variables, to, options = {}) {
        await this.ensureInitialized();
        
        // Check preferences for this template type
        const preferences = await this.getUserPreferences(to);
        if (preferences && !this.checkTemplatePreference(preferences, templateName)) {
            logger.info(`Template email not sent - user preference: ${to}, template: ${templateName}`);
            return { sent: false, reason: 'preference_disabled' };
        }
        
        // Queue the email
        const job = await this.queueService.queues.emailNotifications.add({
            type: 'template',
            data: {
                template: templateName,
                variables,
                to,
                options
            }
        });
        
        return {
            jobId: job.id,
            status: 'queued'
        };
    }
    
    /**
     * Internal template email sending
     */
    async sendTemplateEmailInternal(templateName, variables, to, options) {
        const template = this.compiledTemplates.get(templateName);
        if (!template) {
            throw new Error(`Template not found: ${templateName}`);
        }
        
        // Compile subject and content
        const subject = template.subject(variables);
        
        // Compile MJML to HTML
        const mjmlResult = mjml2html(template.html);
        if (mjmlResult.errors.length > 0) {
            logger.error('MJML compilation errors', { errors: mjmlResult.errors });
        }
        
        // Apply variables to HTML
        const htmlTemplate = handlebars.compile(mjmlResult.html);
        const html = htmlTemplate(variables);
        
        // Apply CSS inlining
        const inlinedHtml = juice(html);
        
        // Compile text version
        const text = template.text(variables);
        
        return this.sendEmailInternal({
            to,
            subject,
            content: { html: inlinedHtml, text },
            options: { ...options, template: templateName }
        });
    }
    
    /**
     * Send bulk emails
     */
    async sendBulkEmails(emails, options = {}) {
        await this.ensureInitialized();
        
        // Queue the bulk email job
        const job = await this.queueService.queues.emailNotifications.add({
            type: 'bulk',
            data: {
                emails,
                options
            }
        });
        
        return {
            jobId: job.id,
            status: 'queued',
            count: emails.length
        };
    }
    
    /**
     * Internal bulk email sending
     */
    async sendBulkEmailsInternal(emails, options) {
        const results = {
            sent: [],
            failed: [],
            skipped: []
        };
        
        // Process in batches
        const batchSize = options.batchSize || 50;
        for (let i = 0; i < emails.length; i += batchSize) {
            const batch = emails.slice(i, i + batchSize);
            
            await Promise.all(batch.map(async (email) => {
                try {
                    // Check preferences
                    const preferences = await this.getUserPreferences(email.to);
                    if (preferences && !preferences.notifications_enabled) {
                        results.skipped.push({
                            email: email.to,
                            reason: 'unsubscribed'
                        });
                        return;
                    }
                    
                    await this.sendEmailInternal(email);
                    results.sent.push(email.to);
                } catch (error) {
                    results.failed.push({
                        email: email.to,
                        error: error.message
                    });
                }
            }));
            
            // Rate limiting
            if (i + batchSize < emails.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        return results;
    }
    
    /**
     * Add tracking to email content
     */
    async addTracking(content, messageId, to) {
        const trackingPixel = `<img src="${this.trackingEndpoint}/open/${messageId}" width="1" height="1" style="display:block;border:0;" alt="" />`;
        
        // Parse HTML
        const root = parse(content.html);
        
        // Add tracking pixel before closing body tag
        const body = root.querySelector('body');
        if (body) {
            body.innerHTML += trackingPixel;
        }
        
        // Track links
        const links = root.querySelectorAll('a');
        links.forEach((link, index) => {
            const originalHref = link.getAttribute('href');
            if (originalHref && !originalHref.startsWith('mailto:') && !originalHref.startsWith('#')) {
                const trackedUrl = `${this.trackingEndpoint}/click/${messageId}/${index}?url=${encodeURIComponent(originalHref)}`;
                link.setAttribute('href', trackedUrl);
            }
        });
        
        return {
            html: root.toString(),
            text: content.text
        };
    }
    
    /**
     * Add unsubscribe link
     */
    addUnsubscribeLink(content, to) {
        const unsubscribeToken = crypto.createHash('sha256').update(to + process.env.UNSUBSCRIBE_SECRET).digest('hex');
        const unsubscribeUrl = `${process.env.APP_URL}/unsubscribe/${unsubscribeToken}`;
        
        const unsubscribeHtml = `
            <div style="text-align: center; margin-top: 20px; padding: 20px; border-top: 1px solid #eeeeee;">
                <p style="font-size: 12px; color: #999999;">
                    Don't want to receive these emails? 
                    <a href="${unsubscribeUrl}" style="color: #999999;">Unsubscribe</a>
                </p>
            </div>
        `;
        
        const unsubscribeText = `\n\nDon't want to receive these emails? Unsubscribe: ${unsubscribeUrl}`;
        
        return {
            html: content.html.replace('</body>', unsubscribeHtml + '</body>'),
            text: content.text + unsubscribeText
        };
    }
    
    /**
     * Track email open
     */
    async trackOpen(messageId) {
        await this.databaseService.query(
            'UPDATE email_logs SET opened_at = ? WHERE message_id = ? AND opened_at IS NULL',
            [new Date(), messageId]
        );
        
        logger.info(`Email opened: ${messageId}`);
    }
    
    /**
     * Track email click
     */
    async trackClick(messageId, linkIndex) {
        await this.databaseService.query(
            'UPDATE email_logs SET clicked_at = ? WHERE message_id = ? AND clicked_at IS NULL',
            [new Date(), messageId]
        );
        
        logger.info(`Email link clicked: ${messageId}, link: ${linkIndex}`);
    }
    
    /**
     * Handle email bounce
     */
    async handleBounce(email, bounceType, bounceSubtype, message) {
        // Log bounce
        await this.databaseService.query(
            `INSERT INTO email_bounces (email, bounce_type, bounce_subtype, bounce_message) 
             VALUES (?, ?, ?, ?)`,
            [email, bounceType, bounceSubtype, message]
        );
        
        // Update email log
        await this.databaseService.query(
            'UPDATE email_logs SET bounced_at = ?, status = ? WHERE to_email = ? AND bounced_at IS NULL',
            [new Date(), 'bounced', email]
        );
        
        // Check bounce count
        const bounceCount = await this.databaseService.query(
            'SELECT COUNT(*) as count FROM email_bounces WHERE email = ? AND bounced_at > datetime("now", "-30 days")',
            [email]
        );
        
        // Disable email if too many bounces
        if (bounceCount[0].count >= 3) {
            await this.updateUserPreferences(email, { notifications_enabled: false });
            logger.warn(`Email disabled due to bounces: ${email}`);
        }
        
        logger.info(`Email bounce handled: ${email}, type: ${bounceType}`);
    }
    
    /**
     * Get user email preferences
     */
    async getUserPreferences(email) {
        const result = await this.databaseService.query(
            'SELECT * FROM email_preferences WHERE email = ?',
            [email]
        );
        
        return result[0] || null;
    }
    
    /**
     * Update user email preferences
     */
    async updateUserPreferences(email, preferences) {
        const existingPrefs = await this.getUserPreferences(email);
        
        if (existingPrefs) {
            // Update existing preferences
            const updates = Object.entries(preferences)
                .map(([key, value]) => `${key} = ?`)
                .join(', ');
            const values = Object.values(preferences);
            values.push(new Date());
            values.push(email);
            
            await this.databaseService.query(
                `UPDATE email_preferences SET ${updates}, updated_at = ? WHERE email = ?`,
                values
            );
        } else {
            // Create new preferences
            const unsubscribeToken = crypto.randomBytes(32).toString('hex');
            await this.databaseService.query(
                `INSERT INTO email_preferences (email, unsubscribe_token, ${Object.keys(preferences).join(', ')}) 
                 VALUES (?, ?, ${Object.values(preferences).map(() => '?').join(', ')})`,
                [email, unsubscribeToken, ...Object.values(preferences)]
            );
        }
    }
    
    /**
     * Unsubscribe user
     */
    async unsubscribe(token) {
        const result = await this.databaseService.query(
            'UPDATE email_preferences SET notifications_enabled = 0, updated_at = ? WHERE unsubscribe_token = ?',
            [new Date(), token]
        );
        
        if (result.changes === 0) {
            throw new Error('Invalid unsubscribe token');
        }
        
        // Log unsubscribe
        const prefs = await this.databaseService.query(
            'SELECT email FROM email_preferences WHERE unsubscribe_token = ?',
            [token]
        );
        
        if (prefs[0]) {
            await this.databaseService.query(
                'UPDATE email_logs SET unsubscribed_at = ? WHERE to_email = ? AND unsubscribed_at IS NULL',
                [new Date(), prefs[0].email]
            );
            
            logger.info(`User unsubscribed: ${prefs[0].email}`);
        }
    }
    
    /**
     * Check template preference
     */
    checkTemplatePreference(preferences, templateName) {
        const templatePreferenceMap = {
            welcome: 'welcome_emails',
            sessionSummary: 'session_summaries',
            errorNotification: 'error_notifications',
            queryCompletion: 'query_completions',
            weeklyReport: 'weekly_reports'
        };
        
        const prefKey = templatePreferenceMap[templateName];
        return prefKey ? preferences[prefKey] : true;
    }
    
    /**
     * Send weekly reports
     */
    async sendWeeklyReports() {
        // Get all users with weekly reports enabled
        const users = await this.databaseService.query(
            'SELECT * FROM email_preferences WHERE weekly_reports = 1 AND notifications_enabled = 1'
        );
        
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 7);
        const weekEnd = new Date();
        
        for (const user of users) {
            try {
                // Get user stats
                const stats = await this.getUserWeeklyStats(user.user_id, weekStart, weekEnd);
                
                await this.sendTemplateEmail('weeklyReport', {
                    weekStart: weekStart.toLocaleDateString(),
                    weekEnd: weekEnd.toLocaleDateString(),
                    stats: stats.summary,
                    topTools: stats.topTools,
                    topQueries: stats.topQueries
                }, user.email);
                
            } catch (error) {
                logger.error(`Failed to send weekly report to ${user.email}`, { error: error.message });
            }
        }
    }
    
    /**
     * Get user weekly stats
     */
    async getUserWeeklyStats(userId, startDate, endDate) {
        // This would query actual usage data from your main database
        // For now, returning mock data
        return {
            summary: {
                totalQueries: 150,
                successful: 145,
                failed: 5,
                avgResponseTime: '2.3s'
            },
            topTools: [
                { name: 'Web Search', count: 45 },
                { name: 'Calculator', count: 32 },
                { name: 'Weather', count: 28 }
            ],
            topQueries: [
                { type: 'Information', count: 78 },
                { type: 'Calculation', count: 45 },
                { type: 'Weather', count: 27 }
            ]
        };
    }
    
    /**
     * Get email analytics
     */
    async getEmailAnalytics(options = {}) {
        const { startDate, endDate, email, template } = options;
        
        let query = 'SELECT * FROM email_logs WHERE 1=1';
        const params = [];
        
        if (startDate) {
            query += ' AND sent_at >= ?';
            params.push(startDate);
        }
        
        if (endDate) {
            query += ' AND sent_at <= ?';
            params.push(endDate);
        }
        
        if (email) {
            query += ' AND to_email = ?';
            params.push(email);
        }
        
        if (template) {
            query += ' AND template = ?';
            params.push(template);
        }
        
        const logs = await this.databaseService.query(query, params);
        
        // Calculate metrics
        const totalSent = logs.length;
        const opened = logs.filter(log => log.opened_at).length;
        const clicked = logs.filter(log => log.clicked_at).length;
        const bounced = logs.filter(log => log.bounced_at).length;
        const unsubscribed = logs.filter(log => log.unsubscribed_at).length;
        
        return {
            totalSent,
            opened,
            clicked,
            bounced,
            unsubscribed,
            openRate: totalSent > 0 ? (opened / totalSent * 100).toFixed(2) + '%' : '0%',
            clickRate: opened > 0 ? (clicked / opened * 100).toFixed(2) + '%' : '0%',
            bounceRate: totalSent > 0 ? (bounced / totalSent * 100).toFixed(2) + '%' : '0%',
            unsubscribeRate: totalSent > 0 ? (unsubscribed / totalSent * 100).toFixed(2) + '%' : '0%',
            logs: logs.slice(0, 100) // Limit to 100 logs
        };
    }
    
    /**
     * Log email
     */
    async logEmail(data) {
        const columns = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        const values = Object.values(data);
        
        await this.databaseService.query(
            `INSERT INTO email_logs (${columns}) VALUES (${placeholders})`,
            values
        );
    }
    
    /**
     * Ensure service is initialized
     */
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }
    
    /**
     * Test email configuration
     */
    async testConfiguration(provider = null) {
        const testProvider = provider || this.activeProvider;
        
        try {
            await this.sendEmailInternal({
                to: process.env.TEST_EMAIL || 'test@example.com',
                subject: 'Email Configuration Test',
                content: {
                    html: '<h1>Test Email</h1><p>This is a test email from the Enhanced Email Service.</p>',
                    text: 'Test Email\n\nThis is a test email from the Enhanced Email Service.'
                },
                options: {
                    provider: testProvider
                }
            });
            
            return {
                success: true,
                provider: testProvider,
                message: 'Test email sent successfully'
            };
        } catch (error) {
            return {
                success: false,
                provider: testProvider,
                error: error.message
            };
        }
    }
}

module.exports = EnhancedEmailService;