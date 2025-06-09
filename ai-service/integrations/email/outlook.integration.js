const { Client } = require('@microsoft/microsoft-graph-client');
const { ConfidentialClientApplication } = require('@azure/msal-node');
const BaseTool = require('../../core/registry/tool-interface');

/**
 * Microsoft Outlook Integration
 * Send emails, manage folders, and search using Microsoft Graph API
 */
class OutlookIntegration extends BaseTool {
    constructor() {
        super({
            name: 'outlookIntegration',
            description: 'Send and manage emails through Microsoft Outlook/Exchange',
            category: 'integration',
            version: '1.0.0',
            
            parameters: {
                operation: {
                    type: 'string',
                    description: 'Operation: sendEmail, createDraft, searchEmails, getEmail, listEmails, createFolder, listFolders, moveEmail',
                    required: true,
                    validate: (value) => [
                        'sendEmail', 'createDraft', 'searchEmails', 'getEmail', 
                        'listEmails', 'createFolder', 'listFolders', 'moveEmail'
                    ].includes(value)
                },
                emailData: {
                    type: 'object',
                    description: 'Email data',
                    required: false,
                    properties: {
                        to: { type: 'array' },
                        cc: { type: 'array' },
                        bcc: { type: 'array' },
                        subject: { type: 'string' },
                        body: { type: 'string' },
                        isHtml: { type: 'boolean' },
                        attachments: { type: 'array' },
                        importance: { type: 'string' }, // low, normal, high
                        categories: { type: 'array' },
                        requestReadReceipt: { type: 'boolean' },
                        requestDeliveryReceipt: { type: 'boolean' }
                    }
                },
                searchQuery: {
                    type: 'string',
                    description: 'OData search query',
                    required: false
                },
                emailId: {
                    type: 'string',
                    description: 'Email message ID',
                    required: false
                },
                folderId: {
                    type: 'string',
                    description: 'Folder ID',
                    required: false
                },
                folderName: {
                    type: 'string',
                    description: 'Folder name',
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

        this.graphClient = null;
        this.authProvider = null;
        this.mockMode = process.env.NODE_ENV === 'development' || !process.env.OUTLOOK_CLIENT_ID;
    }

    /**
     * Initialize Microsoft Graph client
     */
    async initialize() {
        if (this.mockMode) {
            this.logger.info('Outlook integration running in mock mode');
            return;
        }

        try {
            // MSAL configuration
            const msalConfig = {
                auth: {
                    clientId: process.env.OUTLOOK_CLIENT_ID,
                    clientSecret: process.env.OUTLOOK_CLIENT_SECRET,
                    authority: `https://login.microsoftonline.com/${process.env.OUTLOOK_TENANT_ID || 'common'}`
                }
            };

            // Create MSAL instance
            const cca = new ConfidentialClientApplication(msalConfig);

            // Auth provider for Graph client
            this.authProvider = {
                getAccessToken: async () => {
                    const authResult = await cca.acquireTokenByClientCredential({
                        scopes: ['https://graph.microsoft.com/.default']
                    });
                    return authResult.accessToken;
                }
            };

            // Initialize Graph client
            this.graphClient = Client.initWithMiddleware({
                authProvider: this.authProvider
            });
            
            this.logger.info('Microsoft Graph client initialized');
        } catch (error) {
            this.logger.error('Failed to initialize Outlook', { error: error.message });
            this.mockMode = true;
        }
    }

    /**
     * Execute Outlook operation
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
                return this.listEmails(parameters.maxResults, parameters.folderId);
            
            case 'createFolder':
                return this.createFolder(parameters.folderName);
            
            case 'listFolders':
                return this.listFolders();
            
            case 'moveEmail':
                return this.moveEmail(parameters.emailId, parameters.folderId);
            
            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
    }

    /**
     * Send an email
     */
    async sendEmail(emailData, context) {
        try {
            const message = this.createMessage(emailData);
            
            // Upload attachments if any
            if (emailData.attachments && emailData.attachments.length > 0) {
                // Create draft first
                const draft = await this.graphClient
                    .api('/me/messages')
                    .post(message);
                
                // Add attachments
                for (const attachment of emailData.attachments) {
                    await this.addAttachment(draft.id, attachment);
                }
                
                // Send the draft
                await this.graphClient
                    .api(`/me/messages/${draft.id}/send`)
                    .post({});
                    
                return {
                    success: true,
                    messageId: draft.id,
                    summary: `Email sent successfully to ${emailData.to.join(', ')}`,
                    details: {
                        to: emailData.to,
                        subject: emailData.subject,
                        timestamp: new Date().toISOString(),
                        hasAttachments: true
                    }
                };
            } else {
                // Send directly without attachments
                await this.graphClient
                    .api('/me/sendMail')
                    .post({ message });

                return {
                    success: true,
                    summary: `Email sent successfully to ${emailData.to.join(', ')}`,
                    details: {
                        to: emailData.to,
                        subject: emailData.subject,
                        timestamp: new Date().toISOString()
                    }
                };
            }

        } catch (error) {
            throw new Error(`Failed to send email: ${error.message}`);
        }
    }

    /**
     * Create a draft
     */
    async createDraft(emailData, context) {
        try {
            const message = this.createMessage(emailData);
            
            const draft = await this.graphClient
                .api('/me/messages')
                .post(message);
            
            // Add attachments if any
            if (emailData.attachments && emailData.attachments.length > 0) {
                for (const attachment of emailData.attachments) {
                    await this.addAttachment(draft.id, attachment);
                }
            }

            return {
                success: true,
                draftId: draft.id,
                summary: `Draft created successfully`,
                details: {
                    to: emailData.to,
                    subject: emailData.subject,
                    hasAttachments: emailData.attachments?.length > 0
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
            const response = await this.graphClient
                .api('/me/messages')
                .filter(searchQuery)
                .top(maxResults)
                .select('id,subject,from,toRecipients,receivedDateTime,body,importance,categories')
                .orderby('receivedDateTime DESC')
                .get();

            if (!response.value || response.value.length === 0) {
                return {
                    success: true,
                    count: 0,
                    emails: [],
                    summary: 'No emails found matching the search criteria'
                };
            }

            const emails = response.value.map(this.formatEmail);

            return {
                success: true,
                count: emails.length,
                emails: emails,
                summary: `Found ${emails.length} emails matching the search`
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
            const email = await this.graphClient
                .api(`/me/messages/${emailId}`)
                .select('id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,importance,categories,hasAttachments')
                .get();
            
            // Get attachments if any
            let attachments = [];
            if (email.hasAttachments) {
                const attachmentResponse = await this.graphClient
                    .api(`/me/messages/${emailId}/attachments`)
                    .get();
                attachments = attachmentResponse.value.map(att => ({
                    id: att.id,
                    name: att.name,
                    contentType: att.contentType,
                    size: att.size
                }));
            }
            
            const formattedEmail = this.formatEmail(email);
            formattedEmail.attachments = attachments;

            return {
                success: true,
                email: formattedEmail,
                summary: `Retrieved email: ${email.subject}`
            };

        } catch (error) {
            throw new Error(`Failed to get email: ${error.message}`);
        }
    }

    /**
     * List recent emails
     */
    async listEmails(maxResults = 10, folderId = 'inbox') {
        try {
            const response = await this.graphClient
                .api(`/me/mailFolders/${folderId}/messages`)
                .top(maxResults)
                .select('id,subject,from,toRecipients,receivedDateTime,body,importance,categories')
                .orderby('receivedDateTime DESC')
                .get();

            if (!response.value || response.value.length === 0) {
                return {
                    success: true,
                    count: 0,
                    emails: [],
                    summary: 'No emails found'
                };
            }

            const emails = response.value.map(this.formatEmail);

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
     * Create a folder
     */
    async createFolder(folderName) {
        try {
            const folder = await this.graphClient
                .api('/me/mailFolders')
                .post({
                    displayName: folderName
                });

            return {
                success: true,
                folderId: folder.id,
                summary: `Folder "${folderName}" created successfully`,
                details: {
                    id: folder.id,
                    displayName: folder.displayName,
                    totalItemCount: folder.totalItemCount || 0
                }
            };

        } catch (error) {
            throw new Error(`Failed to create folder: ${error.message}`);
        }
    }

    /**
     * List folders
     */
    async listFolders() {
        try {
            const response = await this.graphClient
                .api('/me/mailFolders')
                .get();

            const folders = response.value.map(folder => ({
                id: folder.id,
                displayName: folder.displayName,
                totalItemCount: folder.totalItemCount,
                unreadItemCount: folder.unreadItemCount
            }));

            return {
                success: true,
                count: folders.length,
                folders: folders,
                summary: `Found ${folders.length} mail folders`
            };

        } catch (error) {
            throw new Error(`Failed to list folders: ${error.message}`);
        }
    }

    /**
     * Move email to folder
     */
    async moveEmail(emailId, folderId) {
        try {
            const movedEmail = await this.graphClient
                .api(`/me/messages/${emailId}/move`)
                .post({
                    destinationId: folderId
                });

            return {
                success: true,
                messageId: movedEmail.id,
                summary: `Email moved successfully`,
                details: {
                    newFolderId: folderId
                }
            };

        } catch (error) {
            throw new Error(`Failed to move email: ${error.message}`);
        }
    }

    /**
     * Create message object for Graph API
     */
    createMessage(emailData) {
        const message = {
            subject: emailData.subject,
            body: {
                contentType: emailData.isHtml ? 'HTML' : 'Text',
                content: emailData.body
            },
            toRecipients: this.formatRecipients(emailData.to)
        };

        if (emailData.cc) {
            message.ccRecipients = this.formatRecipients(emailData.cc);
        }

        if (emailData.bcc) {
            message.bccRecipients = this.formatRecipients(emailData.bcc);
        }

        if (emailData.importance) {
            message.importance = emailData.importance;
        }

        if (emailData.categories) {
            message.categories = emailData.categories;
        }

        if (emailData.requestReadReceipt) {
            message.isReadReceiptRequested = true;
        }

        if (emailData.requestDeliveryReceipt) {
            message.isDeliveryReceiptRequested = true;
        }

        return message;
    }

    /**
     * Format recipients for Graph API
     */
    formatRecipients(recipients) {
        if (!recipients) return [];
        
        const recipientArray = Array.isArray(recipients) ? recipients : [recipients];
        return recipientArray.map(email => ({
            emailAddress: {
                address: email
            }
        }));
    }

    /**
     * Format email for response
     */
    formatEmail(email) {
        return {
            id: email.id,
            subject: email.subject,
            from: email.from?.emailAddress?.address,
            to: email.toRecipients?.map(r => r.emailAddress.address),
            date: email.receivedDateTime,
            body: email.body?.content?.substring(0, 500),
            importance: email.importance,
            categories: email.categories || []
        };
    }

    /**
     * Add attachment to message
     */
    async addAttachment(messageId, attachment) {
        const attachmentData = {
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: attachment.filename,
            contentType: attachment.mimeType || 'application/octet-stream',
            contentBytes: attachment.content
        };

        if (attachment.isInline) {
            attachmentData.isInline = true;
            attachmentData.contentId = attachment.contentId;
        }

        return await this.graphClient
            .api(`/me/messages/${messageId}/attachments`)
            .post(attachmentData);
    }

    /**
     * Mock implementations
     */
    executeMock(operation, parameters) {
        switch (operation) {
            case 'sendEmail':
                return {
                    success: true,
                    messageId: `mock-outlook-${Date.now()}`,
                    summary: `[MOCK] Email sent to ${parameters.emailData.to}`,
                    details: {
                        to: parameters.emailData.to,
                        subject: parameters.emailData.subject,
                        timestamp: new Date().toISOString(),
                        importance: parameters.emailData.importance || 'normal'
                    }
                };

            case 'createDraft':
                return {
                    success: true,
                    draftId: `mock-draft-${Date.now()}`,
                    summary: '[MOCK] Draft created successfully',
                    details: {
                        to: parameters.emailData.to,
                        subject: parameters.emailData.subject,
                        categories: parameters.emailData.categories || []
                    }
                };

            case 'searchEmails':
                return {
                    success: true,
                    count: 2,
                    emails: [
                        {
                            id: 'mock-outlook-1',
                            subject: 'Quarterly Report',
                            from: 'manager@company.com',
                            to: ['team@company.com'],
                            date: new Date().toISOString(),
                            body: 'Please review the attached quarterly report...',
                            importance: 'high',
                            categories: ['Reports']
                        },
                        {
                            id: 'mock-outlook-2',
                            subject: 'Team Meeting',
                            from: 'hr@company.com',
                            to: ['all@company.com'],
                            date: new Date().toISOString(),
                            body: 'Reminder: Team meeting at 3 PM...',
                            importance: 'normal',
                            categories: ['Meetings']
                        }
                    ],
                    summary: '[MOCK] Found 2 emails'
                };

            case 'getEmail':
                return {
                    success: true,
                    email: {
                        id: parameters.emailId,
                        subject: 'Mock Outlook Email',
                        from: 'sender@outlook.com',
                        to: ['recipient@outlook.com'],
                        date: new Date().toISOString(),
                        body: 'This is a mock Outlook email body...',
                        importance: 'normal',
                        categories: ['Mock'],
                        attachments: []
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
                            subject: 'Welcome to Outlook',
                            from: 'welcome@outlook.com',
                            date: new Date().toISOString(),
                            body: 'Welcome to Microsoft Outlook...',
                            importance: 'low'
                        },
                        {
                            id: 'mock-2',
                            subject: 'Security Alert',
                            from: 'security@microsoft.com',
                            date: new Date().toISOString(),
                            body: 'A new sign-in was detected...',
                            importance: 'high'
                        }
                    ],
                    summary: '[MOCK] Retrieved 2 recent emails'
                };

            case 'createFolder':
                return {
                    success: true,
                    folderId: `mock-folder-${Date.now()}`,
                    summary: `[MOCK] Folder "${parameters.folderName}" created`,
                    details: {
                        id: `mock-folder-${Date.now()}`,
                        displayName: parameters.folderName,
                        totalItemCount: 0
                    }
                };

            case 'listFolders':
                return {
                    success: true,
                    count: 5,
                    folders: [
                        { id: 'inbox', displayName: 'Inbox', totalItemCount: 25, unreadItemCount: 3 },
                        { id: 'sent', displayName: 'Sent Items', totalItemCount: 100, unreadItemCount: 0 },
                        { id: 'drafts', displayName: 'Drafts', totalItemCount: 5, unreadItemCount: 5 },
                        { id: 'deleted', displayName: 'Deleted Items', totalItemCount: 10, unreadItemCount: 2 },
                        { id: 'archive', displayName: 'Archive', totalItemCount: 500, unreadItemCount: 0 }
                    ],
                    summary: '[MOCK] Found 5 mail folders'
                };

            case 'moveEmail':
                return {
                    success: true,
                    messageId: parameters.emailId,
                    summary: '[MOCK] Email moved successfully',
                    details: {
                        newFolderId: parameters.folderId
                    }
                };

            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
    }
}

module.exports = OutlookIntegration;