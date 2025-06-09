/**
 * HubSpot CRM Integration
 * Supports HubSpot API v3 with OAuth2 and API key authentication
 * Manages contacts, companies, deals, tickets, and engagements
 */

const axios = require('axios');
const { BaseTool } = require('../../tools-agent');

class HubSpotIntegration extends BaseTool {
    constructor(config = {}) {
        super();
        this.name = 'HubSpot CRM';
        this.description = 'Integrates with HubSpot CRM for managing contacts, companies, deals, and engagements';
        
        // Configuration
        this.config = {
            apiKey: config.apiKey || process.env.HUBSPOT_API_KEY,
            accessToken: config.accessToken || process.env.HUBSPOT_ACCESS_TOKEN,
            baseUrl: 'https://api.hubapi.com',
            mockMode: config.mockMode || false,
            rateLimitDelay: config.rateLimitDelay || 110, // HubSpot has 10 requests/second limit
            retryAttempts: config.retryAttempts || 3,
            pageSize: config.pageSize || 100
        };

        // Use access token if available, otherwise fall back to API key
        this.authHeader = this.config.accessToken 
            ? { 'Authorization': `Bearer ${this.config.accessToken}` }
            : { 'hapikey': this.config.apiKey };

        // Mock data for development
        this.mockData = {
            contacts: [
                {
                    id: '101',
                    properties: {
                        firstname: 'John',
                        lastname: 'Doe',
                        email: 'john.doe@example.com',
                        phone: '+1234567890',
                        company: 'Acme Corp',
                        lifecyclestage: 'lead'
                    },
                    createdAt: '2024-01-15T10:00:00Z',
                    updatedAt: '2024-01-20T15:30:00Z'
                },
                {
                    id: '102',
                    properties: {
                        firstname: 'Jane',
                        lastname: 'Smith',
                        email: 'jane.smith@example.com',
                        phone: '+0987654321',
                        company: 'Tech Solutions',
                        lifecyclestage: 'customer'
                    },
                    createdAt: '2024-01-10T09:00:00Z',
                    updatedAt: '2024-01-25T14:00:00Z'
                }
            ],
            companies: [
                {
                    id: '201',
                    properties: {
                        name: 'Acme Corp',
                        domain: 'acme.com',
                        industry: 'Technology',
                        numberofemployees: '100',
                        annualrevenue: '10000000'
                    }
                },
                {
                    id: '202',
                    properties: {
                        name: 'Tech Solutions',
                        domain: 'techsolutions.com',
                        industry: 'Software',
                        numberofemployees: '50',
                        annualrevenue: '5000000'
                    }
                }
            ],
            deals: [
                {
                    id: '301',
                    properties: {
                        dealname: 'Enterprise License - Acme Corp',
                        amount: '50000',
                        dealstage: 'qualifiedtobuy',
                        pipeline: 'default',
                        closedate: '2024-03-31T00:00:00Z'
                    },
                    associations: {
                        contacts: ['101'],
                        companies: ['201']
                    }
                }
            ]
        };
    }

    /**
     * Execute HubSpot operations
     */
    async execute(params) {
        const { operation, entity, data, filters, options } = params;

        try {
            switch (operation) {
                // Contact operations
                case 'getContacts':
                    return await this.getContacts(filters, options);
                case 'getContact':
                    return await this.getContact(data.id || data.email);
                case 'createContact':
                    return await this.createContact(data);
                case 'updateContact':
                    return await this.updateContact(data.id || data.email, data.properties);
                case 'deleteContact':
                    return await this.deleteContact(data.id || data.email);

                // Company operations
                case 'getCompanies':
                    return await this.getCompanies(filters, options);
                case 'getCompany':
                    return await this.getCompany(data.id || data.domain);
                case 'createCompany':
                    return await this.createCompany(data);
                case 'updateCompany':
                    return await this.updateCompany(data.id, data.properties);
                case 'deleteCompany':
                    return await this.deleteCompany(data.id);

                // Deal operations
                case 'getDeals':
                    return await this.getDeals(filters, options);
                case 'getDeal':
                    return await this.getDeal(data.id);
                case 'createDeal':
                    return await this.createDeal(data);
                case 'updateDeal':
                    return await this.updateDeal(data.id, data.properties);
                case 'deleteDeal':
                    return await this.deleteDeal(data.id);

                // Ticket operations
                case 'getTickets':
                    return await this.getTickets(filters, options);
                case 'createTicket':
                    return await this.createTicket(data);
                case 'updateTicket':
                    return await this.updateTicket(data.id, data.properties);

                // Engagement operations
                case 'createEngagement':
                    return await this.createEngagement(data);
                case 'getEngagements':
                    return await this.getEngagements(data.objectType, data.objectId);

                // Association operations
                case 'createAssociation':
                    return await this.createAssociation(data);
                case 'getAssociations':
                    return await this.getAssociations(data);

                // Search operations
                case 'search':
                    return await this.search(entity, filters, options);

                // Bulk operations
                case 'bulkCreate':
                    return await this.bulkCreate(entity, data);
                case 'bulkUpdate':
                    return await this.bulkUpdate(entity, data);

                default:
                    throw new Error(`Unknown operation: ${operation}`);
            }
        } catch (error) {
            this.logger.error('HubSpot operation failed:', error);
            throw error;
        }
    }

    /**
     * Contact Management
     */
    async getContacts(filters = {}, options = {}) {
        if (this.config.mockMode) {
            return { success: true, data: this.mockData.contacts };
        }

        try {
            const params = {
                limit: options.limit || this.config.pageSize,
                properties: options.properties || ['firstname', 'lastname', 'email', 'phone', 'company', 'lifecyclestage'],
                ...filters
            };

            const response = await this.makeRequest('GET', '/crm/v3/objects/contacts', params);
            return {
                success: true,
                data: response.results,
                paging: response.paging
            };
        } catch (error) {
            return this.handleError(error);
        }
    }

    async getContact(identifier) {
        if (this.config.mockMode) {
            const contact = this.mockData.contacts.find(c => 
                c.id === identifier || c.properties.email === identifier
            );
            return { success: !!contact, data: contact };
        }

        try {
            const isEmail = identifier.includes('@');
            const endpoint = isEmail 
                ? `/crm/v3/objects/contacts/${identifier}?idProperty=email`
                : `/crm/v3/objects/contacts/${identifier}`;

            const response = await this.makeRequest('GET', endpoint);
            return { success: true, data: response };
        } catch (error) {
            return this.handleError(error);
        }
    }

    async createContact(data) {
        if (this.config.mockMode) {
            const newContact = {
                id: Date.now().toString(),
                properties: data,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            this.mockData.contacts.push(newContact);
            return { success: true, data: newContact };
        }

        try {
            const response = await this.makeRequest('POST', '/crm/v3/objects/contacts', {
                properties: data
            });
            return { success: true, data: response };
        } catch (error) {
            return this.handleError(error);
        }
    }

    async updateContact(identifier, properties) {
        if (this.config.mockMode) {
            const contact = this.mockData.contacts.find(c => 
                c.id === identifier || c.properties.email === identifier
            );
            if (contact) {
                Object.assign(contact.properties, properties);
                contact.updatedAt = new Date().toISOString();
                return { success: true, data: contact };
            }
            return { success: false, error: 'Contact not found' };
        }

        try {
            const isEmail = identifier.includes('@');
            const endpoint = isEmail 
                ? `/crm/v3/objects/contacts/${identifier}?idProperty=email`
                : `/crm/v3/objects/contacts/${identifier}`;

            const response = await this.makeRequest('PATCH', endpoint, {
                properties
            });
            return { success: true, data: response };
        } catch (error) {
            return this.handleError(error);
        }
    }

    async deleteContact(identifier) {
        if (this.config.mockMode) {
            const index = this.mockData.contacts.findIndex(c => 
                c.id === identifier || c.properties.email === identifier
            );
            if (index !== -1) {
                this.mockData.contacts.splice(index, 1);
                return { success: true };
            }
            return { success: false, error: 'Contact not found' };
        }

        try {
            const isEmail = identifier.includes('@');
            const endpoint = isEmail 
                ? `/crm/v3/objects/contacts/${identifier}?idProperty=email`
                : `/crm/v3/objects/contacts/${identifier}`;

            await this.makeRequest('DELETE', endpoint);
            return { success: true };
        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * Company Management
     */
    async getCompanies(filters = {}, options = {}) {
        if (this.config.mockMode) {
            return { success: true, data: this.mockData.companies };
        }

        try {
            const params = {
                limit: options.limit || this.config.pageSize,
                properties: options.properties || ['name', 'domain', 'industry', 'numberofemployees', 'annualrevenue'],
                ...filters
            };

            const response = await this.makeRequest('GET', '/crm/v3/objects/companies', params);
            return {
                success: true,
                data: response.results,
                paging: response.paging
            };
        } catch (error) {
            return this.handleError(error);
        }
    }

    async getCompany(identifier) {
        if (this.config.mockMode) {
            const company = this.mockData.companies.find(c => 
                c.id === identifier || c.properties.domain === identifier
            );
            return { success: !!company, data: company };
        }

        try {
            const endpoint = `/crm/v3/objects/companies/${identifier}`;
            const response = await this.makeRequest('GET', endpoint);
            return { success: true, data: response };
        } catch (error) {
            return this.handleError(error);
        }
    }

    async createCompany(data) {
        if (this.config.mockMode) {
            const newCompany = {
                id: Date.now().toString(),
                properties: data,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            this.mockData.companies.push(newCompany);
            return { success: true, data: newCompany };
        }

        try {
            const response = await this.makeRequest('POST', '/crm/v3/objects/companies', {
                properties: data
            });
            return { success: true, data: response };
        } catch (error) {
            return this.handleError(error);
        }
    }

    async updateCompany(id, properties) {
        if (this.config.mockMode) {
            const company = this.mockData.companies.find(c => c.id === id);
            if (company) {
                Object.assign(company.properties, properties);
                company.updatedAt = new Date().toISOString();
                return { success: true, data: company };
            }
            return { success: false, error: 'Company not found' };
        }

        try {
            const response = await this.makeRequest('PATCH', `/crm/v3/objects/companies/${id}`, {
                properties
            });
            return { success: true, data: response };
        } catch (error) {
            return this.handleError(error);
        }
    }

    async deleteCompany(id) {
        if (this.config.mockMode) {
            const index = this.mockData.companies.findIndex(c => c.id === id);
            if (index !== -1) {
                this.mockData.companies.splice(index, 1);
                return { success: true };
            }
            return { success: false, error: 'Company not found' };
        }

        try {
            await this.makeRequest('DELETE', `/crm/v3/objects/companies/${id}`);
            return { success: true };
        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * Deal Management
     */
    async getDeals(filters = {}, options = {}) {
        if (this.config.mockMode) {
            return { success: true, data: this.mockData.deals };
        }

        try {
            const params = {
                limit: options.limit || this.config.pageSize,
                properties: options.properties || ['dealname', 'amount', 'dealstage', 'closedate', 'pipeline'],
                associations: options.associations || ['contacts', 'companies'],
                ...filters
            };

            const response = await this.makeRequest('GET', '/crm/v3/objects/deals', params);
            return {
                success: true,
                data: response.results,
                paging: response.paging
            };
        } catch (error) {
            return this.handleError(error);
        }
    }

    async getDeal(id) {
        if (this.config.mockMode) {
            const deal = this.mockData.deals.find(d => d.id === id);
            return { success: !!deal, data: deal };
        }

        try {
            const response = await this.makeRequest('GET', `/crm/v3/objects/deals/${id}`, {
                associations: ['contacts', 'companies']
            });
            return { success: true, data: response };
        } catch (error) {
            return this.handleError(error);
        }
    }

    async createDeal(data) {
        if (this.config.mockMode) {
            const newDeal = {
                id: Date.now().toString(),
                properties: data.properties || data,
                associations: data.associations || {},
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            this.mockData.deals.push(newDeal);
            return { success: true, data: newDeal };
        }

        try {
            const response = await this.makeRequest('POST', '/crm/v3/objects/deals', {
                properties: data.properties || data,
                associations: data.associations
            });
            return { success: true, data: response };
        } catch (error) {
            return this.handleError(error);
        }
    }

    async updateDeal(id, properties) {
        if (this.config.mockMode) {
            const deal = this.mockData.deals.find(d => d.id === id);
            if (deal) {
                Object.assign(deal.properties, properties);
                deal.updatedAt = new Date().toISOString();
                return { success: true, data: deal };
            }
            return { success: false, error: 'Deal not found' };
        }

        try {
            const response = await this.makeRequest('PATCH', `/crm/v3/objects/deals/${id}`, {
                properties
            });
            return { success: true, data: response };
        } catch (error) {
            return this.handleError(error);
        }
    }

    async deleteDeal(id) {
        if (this.config.mockMode) {
            const index = this.mockData.deals.findIndex(d => d.id === id);
            if (index !== -1) {
                this.mockData.deals.splice(index, 1);
                return { success: true };
            }
            return { success: false, error: 'Deal not found' };
        }

        try {
            await this.makeRequest('DELETE', `/crm/v3/objects/deals/${id}`);
            return { success: true };
        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * Ticket Management
     */
    async getTickets(filters = {}, options = {}) {
        if (this.config.mockMode) {
            return {
                success: true,
                data: [
                    {
                        id: '401',
                        properties: {
                            subject: 'Technical Support Request',
                            content: 'Need help with API integration',
                            hs_pipeline: 'support',
                            hs_pipeline_stage: 'new',
                            hs_ticket_priority: 'HIGH'
                        }
                    }
                ]
            };
        }

        try {
            const params = {
                limit: options.limit || this.config.pageSize,
                properties: options.properties || ['subject', 'content', 'hs_pipeline', 'hs_pipeline_stage', 'hs_ticket_priority'],
                ...filters
            };

            const response = await this.makeRequest('GET', '/crm/v3/objects/tickets', params);
            return {
                success: true,
                data: response.results,
                paging: response.paging
            };
        } catch (error) {
            return this.handleError(error);
        }
    }

    async createTicket(data) {
        if (this.config.mockMode) {
            return {
                success: true,
                data: {
                    id: Date.now().toString(),
                    properties: data,
                    createdAt: new Date().toISOString()
                }
            };
        }

        try {
            const response = await this.makeRequest('POST', '/crm/v3/objects/tickets', {
                properties: data
            });
            return { success: true, data: response };
        } catch (error) {
            return this.handleError(error);
        }
    }

    async updateTicket(id, properties) {
        if (this.config.mockMode) {
            return {
                success: true,
                data: {
                    id,
                    properties,
                    updatedAt: new Date().toISOString()
                }
            };
        }

        try {
            const response = await this.makeRequest('PATCH', `/crm/v3/objects/tickets/${id}`, {
                properties
            });
            return { success: true, data: response };
        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * Engagement Management
     */
    async createEngagement(data) {
        if (this.config.mockMode) {
            return {
                success: true,
                data: {
                    id: Date.now().toString(),
                    type: data.type,
                    metadata: data.metadata,
                    associations: data.associations,
                    createdAt: new Date().toISOString()
                }
            };
        }

        try {
            // Map engagement type to the correct endpoint
            const typeMap = {
                'email': 'emails',
                'call': 'calls',
                'meeting': 'meetings',
                'note': 'notes',
                'task': 'tasks'
            };

            const endpoint = `/crm/v3/objects/${typeMap[data.type] || data.type}`;
            
            const response = await this.makeRequest('POST', endpoint, {
                properties: data.metadata || data.properties,
                associations: data.associations
            });
            
            return { success: true, data: response };
        } catch (error) {
            return this.handleError(error);
        }
    }

    async getEngagements(objectType, objectId) {
        if (this.config.mockMode) {
            return {
                success: true,
                data: [
                    {
                        id: '501',
                        type: 'email',
                        metadata: {
                            subject: 'Follow-up on proposal',
                            body: 'Thank you for your time...'
                        },
                        createdAt: '2024-01-20T10:00:00Z'
                    }
                ]
            };
        }

        try {
            const response = await this.makeRequest('GET', `/crm/v3/objects/${objectType}/${objectId}/associations/engagements`);
            return { success: true, data: response.results };
        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * Association Management
     */
    async createAssociation(data) {
        const { fromObjectType, fromObjectId, toObjectType, toObjectId, associationType } = data;

        if (this.config.mockMode) {
            return { success: true, data: { created: true } };
        }

        try {
            const response = await this.makeRequest(
                'PUT',
                `/crm/v3/objects/${fromObjectType}/${fromObjectId}/associations/${toObjectType}/${toObjectId}/${associationType}`
            );
            return { success: true, data: response };
        } catch (error) {
            return this.handleError(error);
        }
    }

    async getAssociations(data) {
        const { objectType, objectId, toObjectType } = data;

        if (this.config.mockMode) {
            return {
                success: true,
                data: {
                    results: [
                        { id: '101', type: toObjectType },
                        { id: '102', type: toObjectType }
                    ]
                }
            };
        }

        try {
            const response = await this.makeRequest(
                'GET',
                `/crm/v3/objects/${objectType}/${objectId}/associations/${toObjectType}`
            );
            return { success: true, data: response };
        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * Search Operations
     */
    async search(objectType, filters = {}, options = {}) {
        if (this.config.mockMode) {
            // Simple mock search implementation
            const data = this.mockData[objectType] || [];
            return { success: true, data };
        }

        try {
            const searchBody = {
                filterGroups: [{
                    filters: Object.entries(filters).map(([property, value]) => ({
                        propertyName: property,
                        operator: 'EQ',
                        value
                    }))
                }],
                properties: options.properties || [],
                limit: options.limit || this.config.pageSize,
                after: options.after || 0
            };

            const response = await this.makeRequest('POST', `/crm/v3/objects/${objectType}/search`, searchBody);
            return {
                success: true,
                data: response.results,
                paging: response.paging
            };
        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * Bulk Operations
     */
    async bulkCreate(objectType, records) {
        if (this.config.mockMode) {
            const created = records.map((record, index) => ({
                id: (Date.now() + index).toString(),
                properties: record,
                createdAt: new Date().toISOString()
            }));
            return { success: true, data: created };
        }

        try {
            // HubSpot batch API has a limit of 100 records per request
            const batches = this.chunkArray(records, 100);
            const results = [];

            for (const batch of batches) {
                const response = await this.makeRequest('POST', `/crm/v3/objects/${objectType}/batch/create`, {
                    inputs: batch.map(properties => ({ properties }))
                });
                results.push(...response.results);
                
                // Rate limiting between batches
                if (batches.length > 1) {
                    await this.delay(this.config.rateLimitDelay);
                }
            }

            return { success: true, data: results };
        } catch (error) {
            return this.handleError(error);
        }
    }

    async bulkUpdate(objectType, updates) {
        if (this.config.mockMode) {
            return {
                success: true,
                data: updates.map(update => ({
                    id: update.id,
                    properties: update.properties,
                    updatedAt: new Date().toISOString()
                }))
            };
        }

        try {
            const batches = this.chunkArray(updates, 100);
            const results = [];

            for (const batch of batches) {
                const response = await this.makeRequest('POST', `/crm/v3/objects/${objectType}/batch/update`, {
                    inputs: batch
                });
                results.push(...response.results);
                
                if (batches.length > 1) {
                    await this.delay(this.config.rateLimitDelay);
                }
            }

            return { success: true, data: results };
        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * Custom Properties Management
     */
    async getCustomProperties(objectType) {
        if (this.config.mockMode) {
            return {
                success: true,
                data: [
                    {
                        name: 'custom_field_1',
                        label: 'Custom Field 1',
                        type: 'string',
                        fieldType: 'text'
                    }
                ]
            };
        }

        try {
            const response = await this.makeRequest('GET', `/crm/v3/properties/${objectType}`);
            return { success: true, data: response.results };
        } catch (error) {
            return this.handleError(error);
        }
    }

    async createCustomProperty(objectType, property) {
        if (this.config.mockMode) {
            return {
                success: true,
                data: {
                    name: property.name,
                    label: property.label,
                    type: property.type,
                    fieldType: property.fieldType
                }
            };
        }

        try {
            const response = await this.makeRequest('POST', `/crm/v3/properties/${objectType}`, property);
            return { success: true, data: response };
        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * HTTP Request Helper
     */
    async makeRequest(method, endpoint, data = null, retryCount = 0) {
        try {
            const config = {
                method,
                url: `${this.config.baseUrl}${endpoint}`,
                headers: {
                    'Content-Type': 'application/json',
                    ...this.authHeader
                }
            };

            if (method === 'GET' && data) {
                config.params = data;
            } else if (data) {
                config.data = data;
            }

            const response = await axios(config);
            return response.data;
        } catch (error) {
            // Handle rate limiting
            if (error.response?.status === 429 && retryCount < this.config.retryAttempts) {
                const retryAfter = error.response.headers['retry-after'] || 1;
                await this.delay(retryAfter * 1000);
                return this.makeRequest(method, endpoint, data, retryCount + 1);
            }

            throw error;
        }
    }

    /**
     * Utility Methods
     */
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    handleError(error) {
        const errorMessage = error.response?.data?.message || error.message;
        const errorCode = error.response?.status;
        
        this.logger.error('HubSpot API Error:', {
            code: errorCode,
            message: errorMessage,
            endpoint: error.config?.url
        });

        return {
            success: false,
            error: errorMessage,
            code: errorCode
        };
    }

    /**
     * OAuth2 Helper Methods
     */
    static getAuthorizationUrl(clientId, redirectUri, scopes = []) {
        const baseUrl = 'https://app.hubspot.com/oauth/authorize';
        const scopeString = scopes.join(' ') || 'crm.objects.contacts.read crm.objects.contacts.write';
        
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            scope: scopeString
        });

        return `${baseUrl}?${params.toString()}`;
    }

    static async exchangeCodeForToken(clientId, clientSecret, redirectUri, code) {
        try {
            const response = await axios.post('https://api.hubapi.com/oauth/v1/token', {
                grant_type: 'authorization_code',
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                code: code
            });

            return {
                success: true,
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token,
                expiresIn: response.data.expires_in
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    static async refreshAccessToken(clientId, clientSecret, refreshToken) {
        try {
            const response = await axios.post('https://api.hubapi.com/oauth/v1/token', {
                grant_type: 'refresh_token',
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken
            });

            return {
                success: true,
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token,
                expiresIn: response.data.expires_in
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }
}

module.exports = HubSpotIntegration;