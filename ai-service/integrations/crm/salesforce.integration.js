const axios = require('axios');
const BaseTool = require('../../core/registry/tool-interface');

/**
 * Salesforce CRM Integration
 * Connects to Salesforce API for lead and contact management
 */
class SalesforceIntegration extends BaseTool {
    constructor() {
        super({
            name: 'salesforceCRM',
            description: 'Integrate with Salesforce CRM for lead and contact management',
            category: 'integration',
            version: '1.0.0',
            
            parameters: {
                operation: {
                    type: 'string',
                    description: 'Operation: getLeads, createLead, updateLead, getContacts, createActivity',
                    required: true,
                    validate: (value) => ['getLeads', 'createLead', 'updateLead', 'getContacts', 'createActivity'].includes(value)
                },
                data: {
                    type: 'object',
                    description: 'Data for the operation',
                    required: false
                },
                filters: {
                    type: 'object',
                    description: 'Filters for queries',
                    required: false
                }
            },
            
            requiresAuth: true,
            timeout: 30000,
            retryable: true
        });

        this.accessToken = null;
        this.instanceUrl = null;
        this.refreshToken = process.env.SALESFORCE_REFRESH_TOKEN;
        this.clientId = process.env.SALESFORCE_CLIENT_ID;
        this.clientSecret = process.env.SALESFORCE_CLIENT_SECRET;
        this.baseUrl = 'https://login.salesforce.com';
    }

    /**
     * Initialize and authenticate
     */
    async initialize() {
        if (!this.clientId || !this.clientSecret) {
            this.logger.warn('Salesforce credentials not configured, using mock mode');
            this.mockMode = true;
            return;
        }

        try {
            await this.authenticate();
        } catch (error) {
            this.logger.error('Salesforce authentication failed', { error: error.message });
            this.mockMode = true;
        }
    }

    /**
     * Authenticate with Salesforce
     */
    async authenticate() {
        try {
            const response = await axios.post(`${this.baseUrl}/services/oauth2/token`, null, {
                params: {
                    grant_type: 'refresh_token',
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    refresh_token: this.refreshToken
                }
            });

            this.accessToken = response.data.access_token;
            this.instanceUrl = response.data.instance_url;
            
            this.logger.info('Salesforce authentication successful');
        } catch (error) {
            if (error.response?.status === 400) {
                // Try password flow as fallback
                await this.authenticateWithPassword();
            } else {
                throw error;
            }
        }
    }

    /**
     * Execute Salesforce operation
     */
    async execute(parameters, context) {
        const { operation, data, filters } = parameters;

        if (this.mockMode) {
            return this.executeMock(operation, data, filters);
        }

        // Ensure we're authenticated
        if (!this.accessToken) {
            await this.authenticate();
        }

        switch (operation) {
            case 'getLeads':
                return this.getLeads(filters);
            
            case 'createLead':
                return this.createLead(data);
            
            case 'updateLead':
                return this.updateLead(data.id, data.updates);
            
            case 'getContacts':
                return this.getContacts(filters);
            
            case 'createActivity':
                return this.createActivity(data);
            
            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
    }

    /**
     * Get leads from Salesforce
     */
    async getLeads(filters = {}) {
        try {
            // Build SOQL query
            let query = 'SELECT Id, Name, Company, Email, Phone, Status, Rating, AnnualRevenue FROM Lead';
            const conditions = [];

            if (filters.status) {
                conditions.push(`Status = '${filters.status}'`);
            }
            if (filters.rating) {
                conditions.push(`Rating = '${filters.rating}'`);
            }
            if (filters.minRevenue) {
                conditions.push(`AnnualRevenue >= ${filters.minRevenue}`);
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            query += ' ORDER BY CreatedDate DESC LIMIT 50';

            const response = await this.makeRequest('GET', `/services/data/v59.0/query`, {
                params: { q: query }
            });

            const leads = response.data.records.map(lead => ({
                id: lead.Id,
                name: lead.Name,
                company: lead.Company,
                email: lead.Email,
                phone: lead.Phone,
                status: lead.Status,
                rating: lead.Rating,
                revenue: lead.AnnualRevenue,
                source: 'Salesforce'
            }));

            return {
                success: true,
                count: leads.length,
                leads,
                summary: `Retrieved ${leads.length} leads from Salesforce`
            };

        } catch (error) {
            throw new Error(`Failed to get leads: ${error.message}`);
        }
    }

    /**
     * Create a new lead
     */
    async createLead(leadData) {
        try {
            const salesforceLead = {
                FirstName: leadData.firstName,
                LastName: leadData.lastName,
                Company: leadData.company,
                Email: leadData.email,
                Phone: leadData.phone,
                Title: leadData.title,
                Status: leadData.status || 'New',
                LeadSource: leadData.source || 'Web',
                Industry: leadData.industry,
                AnnualRevenue: leadData.revenue,
                Description: leadData.description
            };

            const response = await this.makeRequest('POST', '/services/data/v59.0/sobjects/Lead', salesforceLead);

            return {
                success: true,
                leadId: response.data.id,
                summary: `Lead "${leadData.firstName} ${leadData.lastName}" created successfully in Salesforce`
            };

        } catch (error) {
            throw new Error(`Failed to create lead: ${error.message}`);
        }
    }

    /**
     * Update an existing lead
     */
    async updateLead(leadId, updates) {
        try {
            const salesforceUpdates = {};
            
            if (updates.status) salesforceUpdates.Status = updates.status;
            if (updates.rating) salesforceUpdates.Rating = updates.rating;
            if (updates.phone) salesforceUpdates.Phone = updates.phone;
            if (updates.email) salesforceUpdates.Email = updates.email;
            if (updates.description) salesforceUpdates.Description = updates.description;

            await this.makeRequest('PATCH', `/services/data/v59.0/sobjects/Lead/${leadId}`, salesforceUpdates);

            return {
                success: true,
                leadId,
                updates: Object.keys(updates),
                summary: `Lead ${leadId} updated successfully`
            };

        } catch (error) {
            throw new Error(`Failed to update lead: ${error.message}`);
        }
    }

    /**
     * Get contacts from Salesforce
     */
    async getContacts(filters = {}) {
        try {
            let query = 'SELECT Id, Name, Email, Phone, Title, Account.Name FROM Contact';
            const conditions = [];

            if (filters.accountId) {
                conditions.push(`AccountId = '${filters.accountId}'`);
            }
            if (filters.email) {
                conditions.push(`Email LIKE '%${filters.email}%'`);
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            query += ' ORDER BY LastModifiedDate DESC LIMIT 50';

            const response = await this.makeRequest('GET', '/services/data/v59.0/query', {
                params: { q: query }
            });

            const contacts = response.data.records.map(contact => ({
                id: contact.Id,
                name: contact.Name,
                email: contact.Email,
                phone: contact.Phone,
                title: contact.Title,
                company: contact.Account?.Name,
                source: 'Salesforce'
            }));

            return {
                success: true,
                count: contacts.length,
                contacts,
                summary: `Retrieved ${contacts.length} contacts from Salesforce`
            };

        } catch (error) {
            throw new Error(`Failed to get contacts: ${error.message}`);
        }
    }

    /**
     * Create an activity (task)
     */
    async createActivity(activityData) {
        try {
            const task = {
                Subject: activityData.subject,
                Description: activityData.description,
                Status: activityData.status || 'Not Started',
                Priority: activityData.priority || 'Normal',
                ActivityDate: activityData.dueDate || new Date().toISOString().split('T')[0],
                WhoId: activityData.contactId || activityData.leadId,
                WhatId: activityData.relatedToId
            };

            const response = await this.makeRequest('POST', '/services/data/v59.0/sobjects/Task', task);

            return {
                success: true,
                activityId: response.data.id,
                summary: `Activity "${activityData.subject}" created successfully`
            };

        } catch (error) {
            throw new Error(`Failed to create activity: ${error.message}`);
        }
    }

    /**
     * Make authenticated request to Salesforce
     */
    async makeRequest(method, path, data = null, options = {}) {
        const config = {
            method,
            url: `${this.instanceUrl}${path}`,
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            },
            ...options
        };

        if (data && (method === 'POST' || method === 'PATCH')) {
            config.data = data;
        }

        try {
            const response = await axios(config);
            return response;
        } catch (error) {
            if (error.response?.status === 401) {
                // Token expired, re-authenticate
                await this.authenticate();
                // Retry request
                config.headers.Authorization = `Bearer ${this.accessToken}`;
                return axios(config);
            }
            throw error;
        }
    }

    /**
     * Mock implementations for development
     */
    executeMock(operation, data, filters) {
        switch (operation) {
            case 'getLeads':
                return {
                    success: true,
                    count: 3,
                    leads: [
                        {
                            id: 'mock-lead-1',
                            name: 'John Smith',
                            company: 'Tech Solutions Inc',
                            email: 'john@techsolutions.com',
                            phone: '+1234567890',
                            status: 'Qualified',
                            rating: 'Hot',
                            revenue: 500000,
                            source: 'Salesforce (Mock)'
                        },
                        {
                            id: 'mock-lead-2',
                            name: 'Jane Doe',
                            company: 'Digital Innovations',
                            email: 'jane@digitalinnovations.com',
                            phone: '+0987654321',
                            status: 'Working',
                            rating: 'Warm',
                            revenue: 300000,
                            source: 'Salesforce (Mock)'
                        }
                    ],
                    summary: '[MOCK] Retrieved 2 leads from Salesforce'
                };

            case 'createLead':
                return {
                    success: true,
                    leadId: `mock-lead-${Date.now()}`,
                    summary: `[MOCK] Lead created successfully`
                };

            case 'updateLead':
                return {
                    success: true,
                    leadId: data.id,
                    updates: Object.keys(data.updates || {}),
                    summary: `[MOCK] Lead updated successfully`
                };

            case 'getContacts':
                return {
                    success: true,
                    count: 2,
                    contacts: [
                        {
                            id: 'mock-contact-1',
                            name: 'Alice Johnson',
                            email: 'alice@company.com',
                            phone: '+1122334455',
                            title: 'CEO',
                            company: 'Growth Corp',
                            source: 'Salesforce (Mock)'
                        }
                    ],
                    summary: '[MOCK] Retrieved 1 contact from Salesforce'
                };

            case 'createActivity':
                return {
                    success: true,
                    activityId: `mock-activity-${Date.now()}`,
                    summary: `[MOCK] Activity created successfully`
                };

            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
    }

    /**
     * Authenticate with username/password (fallback)
     */
    async authenticateWithPassword() {
        const username = process.env.SALESFORCE_USERNAME;
        const password = process.env.SALESFORCE_PASSWORD;
        const securityToken = process.env.SALESFORCE_SECURITY_TOKEN;

        if (!username || !password) {
            throw new Error('Salesforce username/password not configured');
        }

        try {
            const response = await axios.post(`${this.baseUrl}/services/oauth2/token`, null, {
                params: {
                    grant_type: 'password',
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    username: username,
                    password: password + (securityToken || '')
                }
            });

            this.accessToken = response.data.access_token;
            this.instanceUrl = response.data.instance_url;
            
            this.logger.info('Salesforce password authentication successful');
        } catch (error) {
            throw new Error(`Salesforce authentication failed: ${error.message}`);
        }
    }
}

module.exports = SalesforceIntegration;