const { google } = require('googleapis');
const BaseTool = require('../../core/registry/tool-interface');

/**
 * Gmail Integration
 * Send emails, manage drafts, and search emails using Gmail API
 */
class GmailIntegration extends BaseTool {
    constructor() {
        super({
            name: 'gmailIntegration',
            description: 'Send and manage emails through Gmail',
            category: 'integration',
            version: '1.0.0',
            
            parameters: {
                operation: {
                    type: 'string',
                    description: 'Operation: sendEmail, createDraft, searchEmails, getEmail, listEmails',
                    required: true,
                    validate: (value) => ['sendEmail', 'createDraft', 'searchEmails', 'getEmail', 'listEmails'].includes(value)
                },
                emailData: {
                    type: 'object',
                    description: 'Email data',
                    required: false,
                    properties: {
                        to: { type: 'string' },
                        cc: { type: 'string' },
                        bcc: { type: 'string' },
                        subject: { type: 'string' },
                        body: { type: 'string' },
                        isHtml: { type: 'boolean' },
                        attachments: { type: 'array' },
                        replyTo: { type: 'string' }
                    }
                },
                searchQuery: {
                    type: 'string',
                    description: 'Gmail search query',
                    required: false
                },
                emailId: {
                    type: 'string',
                    description: 'Email/Thread ID',
                    required: false
                },
                maxResults: {
                    type: 'number',
                    description: 'Maximum results to return',
                    required: false,
                    default: 10
                }
            },
            
            requiresAuth: true,
            timeout: 20000,
            retryable: true
        });

        this.gmail = null;
        this.auth = null;
        this.mockMode = process.env.NODE_ENV === 'development';
    }

    /**
     * Initialize Gmail client
     */
    async initialize() {
        // Check if we should use mock mode
        if (process.env.USE_MOCK_INTEGRATIONS === 'true') {
            this.mockMode = true;
            this.logger.info('Gmail integration running in mock mode (forced)');
            return;
        }

        try {
            // Use the shared Google Auth Service
            const GoogleAuthService = require('../../services/google-auth.service');
            const authService = new GoogleAuthService();
            
            this.auth = await authService.getAuthClient();
            this.gmail = google.gmail({ version: 'v1', auth: this.auth });
            
            // Test the connection
            await this.gmail.users.getProfile({ userId: 'me' });
            
            this.logger.info('Gmail client initialized with real authentication');
            this.mockMode = false;
        } catch (error) {
            this.logger.warn('Failed to initialize Gmail with real auth, falling back to mock mode', { 
                error: error.message 
            });
            this.mockMode = true;
        }
    }

    /**
     * Execute Gmail operation
     */
    async execute(parameters, context) {
        const { operation } = parameters;

        if (this.mockMode) {
            return this.executeMock(operation, parameters);
        }

        switch (operation) {
            case 'sendEmail':
                return this.sendEmail(parameters.emailData, context);
            
            case 'createDraft':
                return this.createDraft(parameters.emailData, context);
            
            case 'searchEmails':
                return this.searchEmails(parameters.searchQuery, parameters.maxResults);
            
            case 'getEmail':
                return this.getEmail(parameters.emailId);
            
            case 'listEmails':
                return this.listEmails(parameters.maxResults);
            
            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
    }

    /**
     * Send an email
     */
    async sendEmail(emailData, context) {
        try {
            // Create email content
            const email = this.createEmailContent(emailData);
            
            // Convert to base64
            const encodedEmail = Buffer.from(email).toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            const response = await this.gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: encodedEmail
                }
            });

            return {
                success: true,
                messageId: response.data.id,
                threadId: response.data.threadId,
                summary: `Email sent successfully to ${emailData.to}`,
                details: {
                    to: emailData.to,
                    subject: emailData.subject,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            throw new Error(`Failed to send email: ${error.message}`);
        }
    }

    /**
     * Create a draft
     */
    async createDraft(emailData, context) {
        try {
            const email = this.createEmailContent(emailData);
            const encodedEmail = Buffer.from(email).toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            const response = await this.gmail.users.drafts.create({
                userId: 'me',
                requestBody: {
                    message: {
                        raw: encodedEmail
                    }
                }
            });

            return {
                success: true,
                draftId: response.data.id,
                summary: `Draft created successfully`,
                details: {
                    to: emailData.to,
                    subject: emailData.subject
                }
            };

        } catch (error) {
            throw new Error(`Failed to create draft: ${error.message}`);
        }
    }

    /**
     * Search emails
     */
    async searchEmails(searchQuery, maxResults = 10) {
        try {
            const response = await this.gmail.users.messages.list({
                userId: 'me',
                q: searchQuery,
                maxResults: maxResults
            });

            if (!response.data.messages || response.data.messages.length === 0) {
                return {
                    success: true,
                    count: 0,
                    emails: [],
                    summary: 'No emails found matching the search criteria'
                };
            }

            // Get details for each email
            const emails = await Promise.all(
                response.data.messages.map(msg => this.getEmailDetails(msg.id))
            );

            return {
                success: true,
                count: emails.length,
                emails: emails,
                summary: `Found ${emails.length} emails matching "${searchQuery}"`
            };

        } catch (error) {
            throw new Error(`Failed to search emails: ${error.message}`);
        }
    }

    /**
     * Get email by ID
     */
    async getEmail(emailId) {
        try {
            const email = await this.getEmailDetails(emailId);
            
            return {
                success: true,
                email: email,
                summary: `Retrieved email: ${email.subject}`
            };

        } catch (error) {
            throw new Error(`Failed to get email: ${error.message}`);
        }
    }

    /**
     * List recent emails
     */
    async listEmails(maxResults = 10) {
        try {
            const response = await this.gmail.users.messages.list({
                userId: 'me',
                maxResults: maxResults,
                labelIds: ['INBOX']
            });

            if (!response.data.messages || response.data.messages.length === 0) {
                return {
                    success: true,
                    count: 0,
                    emails: [],
                    summary: 'No emails found in inbox'
                };
            }

            const emails = await Promise.all(
                response.data.messages.map(msg => this.getEmailDetails(msg.id))
            );

            return {
                success: true,
                count: emails.length,
                emails: emails,
                summary: `Retrieved ${emails.length} recent emails`
            };

        } catch (error) {
            throw new Error(`Failed to list emails: ${error.message}`);
        }
    }

    /**
     * Get email details
     */
    async getEmailDetails(messageId) {
        const response = await this.gmail.users.messages.get({
            userId: 'me',
            id: messageId,
            format: 'full'
        });

        const headers = response.data.payload.headers;
        const getHeader = (name) => headers.find(h => h.name === name)?.value || '';

        // Extract body
        let body = '';
        const extractBody = (parts) => {
            if (!parts) return '';
            
            for (const part of parts) {
                if (part.mimeType === 'text/plain' && part.body.data) {
                    body = Buffer.from(part.body.data, 'base64').toString();
                    break;
                } else if (part.parts) {
                    extractBody(part.parts);
                }
            }
        };

        if (response.data.payload.body?.data) {
            body = Buffer.from(response.data.payload.body.data, 'base64').toString();
        } else {
            extractBody([response.data.payload]);
        }

        return {
            id: messageId,
            threadId: response.data.threadId,
            subject: getHeader('Subject'),
            from: getHeader('From'),
            to: getHeader('To'),
            date: getHeader('Date'),
            snippet: response.data.snippet,
            body: body.substring(0, 500), // Limit body length
            labels: response.data.labelIds || []
        };
    }

    /**
     * Create email content
     */
    createEmailContent(emailData) {
        const boundary = `boundary_${Date.now()}`;
        let email = [];

        // Headers
        email.push(`To: ${emailData.to}`);
        if (emailData.cc) email.push(`Cc: ${emailData.cc}`);
        if (emailData.bcc) email.push(`Bcc: ${emailData.bcc}`);
        email.push(`Subject: ${emailData.subject}`);
        email.push('MIME-Version: 1.0');
        
        if (emailData.attachments && emailData.attachments.length > 0) {
            email.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
            email.push('');
            email.push(`--${boundary}`);
        }

        // Body
        if (emailData.isHtml) {
            email.push('Content-Type: text/html; charset=UTF-8');
        } else {
            email.push('Content-Type: text/plain; charset=UTF-8');
        }
        email.push('');
        email.push(emailData.body);

        // Attachments
        if (emailData.attachments) {
            for (const attachment of emailData.attachments) {
                email.push('');
                email.push(`--${boundary}`);
                email.push(`Content-Type: ${attachment.mimeType || 'application/octet-stream'}`);
                email.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
                email.push('Content-Transfer-Encoding: base64');
                email.push('');
                email.push(attachment.content);
            }
            email.push('');
            email.push(`--${boundary}--`);
        }

        return email.join('\r\n');
    }

    /**
     * Authenticate with Google
     */
    async authenticateGoogle(credentialsPath, tokenPath) {
        const { authenticate } = require('@google-cloud/local-auth');
        const fs = require('fs').promises;
        
        try {
            // Try to load existing token
            const token = await fs.readFile(tokenPath, 'utf-8');
            const credentials = await fs.readFile(credentialsPath, 'utf-8');
            
            const { client_secret, client_id, redirect_uris } = JSON.parse(credentials).installed;
            const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
            
            oAuth2Client.setCredentials(JSON.parse(token));
            return oAuth2Client;
        } catch (error) {
            // If no token, use local auth
            return authenticate({
                scopes: [
                    'https://www.googleapis.com/auth/gmail.send',
                    'https://www.googleapis.com/auth/gmail.readonly',
                    'https://www.googleapis.com/auth/gmail.compose'
                ],
                keyfilePath: credentialsPath
            });
        }
    }

    /**
     * Mock implementations
     */
    executeMock(operation, parameters) {
        switch (operation) {
            case 'sendEmail':
                return {
                    success: true,
                    messageId: `mock-msg-${Date.now()}`,
                    threadId: `mock-thread-${Date.now()}`,
                    summary: `[MOCK] Email sent to ${parameters.emailData.to}`,
                    details: {
                        to: parameters.emailData.to,
                        subject: parameters.emailData.subject,
                        timestamp: new Date().toISOString()
                    }
                };

            case 'createDraft':
                return {
                    success: true,
                    draftId: `mock-draft-${Date.now()}`,
                    summary: '[MOCK] Draft created successfully',
                    details: {
                        to: parameters.emailData.to,
                        subject: parameters.emailData.subject
                    }
                };

            case 'searchEmails':
                return {
                    success: true,
                    count: 2,
                    emails: [
                        {
                            id: 'mock-email-1',
                            subject: 'Re: Sales Proposal',
                            from: 'client@example.com',
                            to: 'sales@company.com',
                            date: new Date().toISOString(),
                            snippet: 'Thanks for the proposal. We would like to...'
                        },
                        {
                            id: 'mock-email-2',
                            subject: 'Meeting Tomorrow',
                            from: 'team@company.com',
                            to: 'you@company.com',
                            date: new Date().toISOString(),
                            snippet: 'Just a reminder about our meeting...'
                        }
                    ],
                    summary: '[MOCK] Found 2 emails'
                };

            case 'getEmail':
                return {
                    success: true,
                    email: {
                        id: parameters.emailId,
                        subject: 'Mock Email Subject',
                        from: 'sender@example.com',
                        to: 'recipient@example.com',
                        date: new Date().toISOString(),
                        body: 'This is a mock email body content...'
                    },
                    summary: '[MOCK] Retrieved email'
                };

            case 'listEmails':
                return {
                    success: true,
                    count: 3,
                    emails: [
                        {
                            id: 'mock-1',
                            subject: 'Welcome to Our Service',
                            from: 'welcome@service.com',
                            date: new Date().toISOString(),
                            snippet: 'Thank you for signing up...'
                        },
                        {
                            id: 'mock-2',
                            subject: 'Your Weekly Report',
                            from: 'reports@company.com',
                            date: new Date().toISOString(),
                            snippet: 'Here is your weekly performance...'
                        }
                    ],
                    summary: '[MOCK] Retrieved 2 recent emails'
                };

            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
    }
}

module.exports = GmailIntegration;