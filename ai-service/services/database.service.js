const { Pool } = require('pg');
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console()
    ]
});

class DatabaseService {
    constructor() {
        this.pool = null;
        this.connected = false;
        this.init();
    }

    async init() {
        // Check if database should be disabled
        if (process.env.DISABLE_DATABASE === 'true') {
            logger.info('Database persistence disabled by configuration');
            this.connected = false;
            this.useInMemoryStorage();
            return;
        }

        try {
            // Database connection configuration
            this.pool = new Pool({
                user: process.env.DB_USER || 'postgres',
                host: process.env.DB_HOST || 'localhost',
                database: process.env.DB_NAME || 'ai_agent',
                password: process.env.DB_PASSWORD || 'postgres',
                port: process.env.DB_PORT || 5432,
                max: 20, // maximum number of clients in the pool
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            });

            // Test connection
            await this.pool.query('SELECT NOW()');
            this.connected = true;
            logger.info('PostgreSQL connected successfully, persistence enabled');

            // Create tables if they don't exist
            await this.createTables();
        } catch (error) {
            // Database not available, but that's okay
            if (error.code === '3D000') {
                logger.info('Database "ai_agent" does not exist. Using in-memory storage.');
            } else {
                logger.info(`PostgreSQL not available: ${error.message}. Using in-memory storage.`);
            }
            this.connected = false;
            
            // Close pool to prevent further connection attempts
            if (this.pool) {
                await this.pool.end().catch(() => {});
                this.pool = null;
            }
            
            // Fallback to in-memory storage if DB is not available
            this.useInMemoryStorage();
        }
    }

    async createTables() {
        const queries = [
            // Users table (extends existing auth service)
            `CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(255) PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255),
                password_hash TEXT NOT NULL,
                api_key VARCHAR(255) UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // Sessions table
            `CREATE TABLE IF NOT EXISTS sessions (
                id VARCHAR(255) PRIMARY KEY,
                user_id VARCHAR(255) REFERENCES users(id),
                token TEXT,
                expires_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // Chat history table
            `CREATE TABLE IF NOT EXISTS chat_history (
                id SERIAL PRIMARY KEY,
                session_id VARCHAR(255),
                user_id VARCHAR(255) REFERENCES users(id),
                message_type VARCHAR(50) NOT NULL, -- 'user' or 'assistant'
                content TEXT NOT NULL,
                metadata JSONB, -- Store thoughts, actions, execution trace
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // Execution logs table
            `CREATE TABLE IF NOT EXISTS execution_logs (
                id SERIAL PRIMARY KEY,
                session_id VARCHAR(255),
                user_id VARCHAR(255) REFERENCES users(id),
                query TEXT NOT NULL,
                answer TEXT,
                thought_history JSONB,
                action_history JSONB,
                execution_trace JSONB,
                iterations INTEGER,
                execution_time INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // Webhooks table
            `CREATE TABLE IF NOT EXISTS webhooks (
                id VARCHAR(255) PRIMARY KEY,
                user_id VARCHAR(255) REFERENCES users(id),
                url TEXT NOT NULL,
                events TEXT[] NOT NULL,
                secret VARCHAR(255) NOT NULL,
                headers JSONB,
                active BOOLEAN DEFAULT true,
                description TEXT,
                metadata JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // Webhook delivery history table
            `CREATE TABLE IF NOT EXISTS webhook_deliveries (
                id VARCHAR(255) PRIMARY KEY,
                webhook_id VARCHAR(255) REFERENCES webhooks(id) ON DELETE CASCADE,
                event_type VARCHAR(100) NOT NULL,
                event_id VARCHAR(255) NOT NULL,
                status VARCHAR(50) NOT NULL, -- 'pending', 'success', 'failed'
                attempts INTEGER DEFAULT 0,
                response_status INTEGER,
                response_data JSONB,
                error_message TEXT,
                delivered_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // Webhook events table
            `CREATE TABLE IF NOT EXISTS webhook_events (
                id VARCHAR(255) PRIMARY KEY,
                type VARCHAR(100) NOT NULL,
                payload JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // Create indexes
            `CREATE INDEX IF NOT EXISTS idx_chat_history_session ON chat_history(session_id)`,
            `CREATE INDEX IF NOT EXISTS idx_chat_history_user ON chat_history(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_execution_logs_session ON execution_logs(session_id)`,
            `CREATE INDEX IF NOT EXISTS idx_execution_logs_user ON execution_logs(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_webhooks_user ON webhooks(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(active)`,
            `CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id)`,
            `CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status)`,
            `CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(type)`,
            `CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON webhook_events(created_at)`
        ];

        for (const query of queries) {
            try {
                await this.pool.query(query);
            } catch (error) {
                logger.error('Error creating table:', error);
            }
        }
    }

    // Chat history methods
    async saveChatMessage({ sessionId, userId, messageType, content, metadata = {} }) {
        if (!this.connected) {
            return this.inMemorySaveChatMessage({ sessionId, userId, messageType, content, metadata });
        }

        try {
            const query = `
                INSERT INTO chat_history (session_id, user_id, message_type, content, metadata)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, created_at
            `;
            const values = [sessionId, userId, messageType, content, JSON.stringify(metadata)];
            const result = await this.pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error saving chat message:', error);
            throw error;
        }
    }

    async getChatHistory(userId, sessionId = null, limit = 50) {
        if (!this.connected) {
            return this.inMemoryGetChatHistory(userId, sessionId, limit);
        }

        try {
            let query = `
                SELECT * FROM chat_history
                WHERE user_id = $1
            `;
            const values = [userId];

            if (sessionId) {
                query += ` AND session_id = $2`;
                values.push(sessionId);
            }

            query += ` ORDER BY created_at DESC LIMIT $${values.length + 1}`;
            values.push(limit);

            const result = await this.pool.query(query, values);
            return result.rows.reverse(); // Return in chronological order
        } catch (error) {
            logger.error('Error getting chat history:', error);
            throw error;
        }
    }

    // Session Management Methods
    async createSession(userId, sessionId) {
        if (!this.connected) {
            return this.inMemoryCreateSession(userId, sessionId);
        }

        try {
            const query = `
                INSERT INTO sessions (id, user_id, created_at)
                VALUES ($1, $2, CURRENT_TIMESTAMP)
                ON CONFLICT (id) DO NOTHING
                RETURNING id
            `;
            const result = await this.pool.query(query, [sessionId, userId]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error creating session:', error);
            return null;
        }
    }

    async getRecentSessions(userId, limit = 10) {
        if (!this.connected) {
            return this.inMemoryGetRecentSessions(userId, limit);
        }

        try {
            const query = `
                SELECT DISTINCT ch.session_id, 
                       MIN(ch.created_at) as started_at,
                       MAX(ch.created_at) as last_message_at,
                       COUNT(*) as message_count,
                       SUBSTRING(MAX(CASE WHEN ch.message_type = 'user' THEN ch.content END), 1, 100) as last_query
                FROM chat_history ch
                WHERE ch.user_id = $1
                GROUP BY ch.session_id
                ORDER BY MAX(ch.created_at) DESC
                LIMIT $2
            `;
            const result = await this.pool.query(query, [userId, limit]);
            return result.rows;
        } catch (error) {
            logger.error('Error getting recent sessions:', error);
            return [];
        }
    }

    async getSessionContext(sessionId, limit = 10) {
        if (!this.connected) {
            return this.inMemoryGetSessionContext(sessionId, limit);
        }

        try {
            // Get last N messages from the session for context
            const query = `
                SELECT content, message_type, metadata, created_at
                FROM chat_history
                WHERE session_id = $1
                ORDER BY created_at DESC
                LIMIT $2
            `;
            const result = await this.pool.query(query, [sessionId, limit]);
            return result.rows.reverse(); // Return in chronological order
        } catch (error) {
            logger.error('Error getting session context:', error);
            return [];
        }
    }

    async getConversationSummary(sessionId) {
        if (!this.connected) {
            return this.inMemoryGetConversationSummary(sessionId);
        }

        try {
            const query = `
                SELECT 
                    COUNT(*) as total_messages,
                    SUM(CASE WHEN message_type = 'user' THEN 1 ELSE 0 END) as user_messages,
                    SUM(CASE WHEN message_type = 'assistant' THEN 1 ELSE 0 END) as assistant_messages,
                    MIN(created_at) as started_at,
                    MAX(created_at) as last_message_at,
                    json_agg(DISTINCT 
                        CASE 
                            WHEN metadata->>'tool' IS NOT NULL 
                            THEN metadata->>'tool' 
                        END
                    ) FILTER (WHERE metadata->>'tool' IS NOT NULL) as tools_used
                FROM chat_history
                WHERE session_id = $1
            `;
            const result = await this.pool.query(query, [sessionId]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error getting conversation summary:', error);
            return null;
        }
    }

    async getSessionMetadata(sessionId) {
        if (!this.connected) {
            // In-memory fallback
            const messages = this.inMemoryStorage.chatHistory.get(sessionId) || [];
            return {
                sessionId,
                title: messages[0]?.content?.substring(0, 50) || `Session ${sessionId}`,
                created_at: messages[0]?.created_at || new Date(),
                message_count: messages.length
            };
        }

        try {
            const query = `
                SELECT 
                    session_id,
                    MIN(created_at) as created_at,
                    MAX(created_at) as last_message_at,
                    COUNT(*) as message_count
                FROM chat_history
                WHERE session_id = $1
                GROUP BY session_id
            `;
            
            const result = await this.pool.query(query, [sessionId]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            const data = result.rows[0];
            
            // Get first user message as title
            const titleQuery = `
                SELECT content 
                FROM chat_history 
                WHERE session_id = $1 AND message_type = 'user'
                ORDER BY created_at
                LIMIT 1
            `;
            
            const titleResult = await this.pool.query(titleQuery, [sessionId]);
            const title = titleResult.rows[0]?.content?.substring(0, 50) || `Session ${sessionId}`;
            
            return {
                ...data,
                title
            };
        } catch (error) {
            logger.error('Failed to get session metadata:', error);
            return null;
        }
    }

    async saveExecutionLog(data) {
        if (!this.connected) {
            return this.inMemorySaveExecutionLog(data);
        }

        try {
            const query = `
                INSERT INTO execution_logs 
                (session_id, user_id, query, answer, thought_history, action_history, 
                 execution_trace, iterations, execution_time)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING id
            `;
            const values = [
                data.sessionId,
                data.userId,
                data.query,
                data.answer,
                JSON.stringify(data.thoughtHistory || []),
                JSON.stringify(data.actionHistory || []),
                JSON.stringify(data.executionTrace || []),
                data.iterations,
                data.executionTime
            ];
            const result = await this.pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error saving execution log:', error);
            throw error;
        }
    }

    async getExecutionLogs(userId, limit = 20) {
        if (!this.connected) {
            return this.inMemoryGetExecutionLogs(userId, limit);
        }

        try {
            const query = `
                SELECT * FROM execution_logs
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT $2
            `;
            const result = await this.pool.query(query, [userId, limit]);
            return result.rows;
        } catch (error) {
            logger.error('Error getting execution logs:', error);
            throw error;
        }
    }

    // User management methods (integrate with auth service)
    async saveUser(user) {
        if (!this.connected) {
            return null; // Let auth service handle in-memory storage
        }

        try {
            const query = `
                INSERT INTO users (id, username, email, password_hash, api_key)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (username) DO NOTHING
                RETURNING id
            `;
            const values = [user.id, user.username, user.email, user.password, user.apiKey];
            const result = await this.pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error saving user:', error);
            return null;
        }
    }

    async getUser(username) {
        if (!this.connected) {
            return null;
        }

        try {
            const query = `SELECT * FROM users WHERE username = $1`;
            const result = await this.pool.query(query, [username]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error getting user:', error);
            return null;
        }
    }

    // In-memory fallback storage
    useInMemoryStorage() {
        this.inMemoryStorage = {
            chatHistory: [],
            executionLogs: [],
            users: new Map(),
            sessions: new Map(),
            sessionContexts: new Map()
        };
        logger.info('Using in-memory storage as fallback');
    }

    inMemorySaveChatMessage(data) {
        const message = {
            id: Date.now(),
            ...data,
            created_at: new Date()
        };
        this.inMemoryStorage.chatHistory.push(message);
        
        // Keep only last 1000 messages in memory
        if (this.inMemoryStorage.chatHistory.length > 1000) {
            this.inMemoryStorage.chatHistory = this.inMemoryStorage.chatHistory.slice(-1000);
        }
        
        return message;
    }

    inMemoryGetChatHistory(userId, sessionId, limit) {
        let history = this.inMemoryStorage.chatHistory.filter(msg => msg.userId === userId);
        
        if (sessionId) {
            history = history.filter(msg => msg.sessionId === sessionId);
        }
        
        return history.slice(-limit);
    }

    inMemorySaveExecutionLog(data) {
        const log = {
            id: Date.now(),
            ...data,
            created_at: new Date()
        };
        this.inMemoryStorage.executionLogs.push(log);
        
        // Keep only last 100 logs in memory
        if (this.inMemoryStorage.executionLogs.length > 100) {
            this.inMemoryStorage.executionLogs = this.inMemoryStorage.executionLogs.slice(-100);
        }
        
        return log;
    }

    inMemoryGetExecutionLogs(userId, limit) {
        return this.inMemoryStorage.executionLogs
            .filter(log => log.userId === userId)
            .slice(-limit);
    }

    // In-memory session management
    inMemoryCreateSession(userId, sessionId) {
        const session = {
            id: sessionId,
            userId,
            created_at: new Date()
        };
        this.inMemoryStorage.sessions.set(sessionId, session);
        return session;
    }

    inMemoryGetRecentSessions(userId, limit) {
        const userSessions = [];
        const sessionGroups = new Map();

        // Group messages by session
        for (const msg of this.inMemoryStorage.chatHistory) {
            if (msg.userId === userId && msg.sessionId) {
                if (!sessionGroups.has(msg.sessionId)) {
                    sessionGroups.set(msg.sessionId, {
                        session_id: msg.sessionId,
                        messages: [],
                        started_at: msg.created_at,
                        last_message_at: msg.created_at
                    });
                }
                const group = sessionGroups.get(msg.sessionId);
                group.messages.push(msg);
                if (msg.created_at > group.last_message_at) {
                    group.last_message_at = msg.created_at;
                }
                if (msg.created_at < group.started_at) {
                    group.started_at = msg.created_at;
                }
            }
        }

        // Convert to array and add summary info
        for (const [sessionId, data] of sessionGroups) {
            const lastUserMessage = data.messages
                .filter(m => m.messageType === 'user')
                .pop();
            
            userSessions.push({
                session_id: sessionId,
                started_at: data.started_at,
                last_message_at: data.last_message_at,
                message_count: data.messages.length,
                last_query: lastUserMessage ? lastUserMessage.content.substring(0, 100) : null
            });
        }

        // Sort by last message time and limit
        return userSessions
            .sort((a, b) => b.last_message_at - a.last_message_at)
            .slice(0, limit);
    }

    inMemoryGetSessionContext(sessionId, limit) {
        return this.inMemoryStorage.chatHistory
            .filter(msg => msg.sessionId === sessionId)
            .slice(-limit)
            .map(msg => ({
                content: msg.content,
                message_type: msg.messageType,
                metadata: msg.metadata,
                created_at: msg.created_at
            }));
    }

    inMemoryGetConversationSummary(sessionId) {
        const messages = this.inMemoryStorage.chatHistory
            .filter(msg => msg.sessionId === sessionId);
        
        if (messages.length === 0) return null;

        const toolsUsed = new Set();
        let userMessages = 0;
        let assistantMessages = 0;

        for (const msg of messages) {
            if (msg.messageType === 'user') userMessages++;
            if (msg.messageType === 'assistant') assistantMessages++;
            if (msg.metadata?.tool) toolsUsed.add(msg.metadata.tool);
        }

        return {
            total_messages: messages.length,
            user_messages: userMessages,
            assistant_messages: assistantMessages,
            started_at: messages[0].created_at,
            last_message_at: messages[messages.length - 1].created_at,
            tools_used: Array.from(toolsUsed)
        };
    }

    // Webhook methods
    async saveWebhook(webhook) {
        if (!this.connected) {
            return this.inMemorySaveWebhook(webhook);
        }

        try {
            const query = `
                INSERT INTO webhooks (id, user_id, url, events, secret, headers, active, description, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `;
            const values = [
                webhook.id,
                webhook.userId,
                webhook.url,
                webhook.events,
                webhook.secret,
                JSON.stringify(webhook.headers || {}),
                webhook.active,
                webhook.description,
                JSON.stringify(webhook.metadata || {})
            ];
            const result = await this.pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error saving webhook:', error);
            throw error;
        }
    }

    async updateWebhook(webhookId, updates) {
        if (!this.connected) {
            return this.inMemoryUpdateWebhook(webhookId, updates);
        }

        try {
            const setClause = [];
            const values = [];
            let paramIndex = 1;

            const allowedFields = ['url', 'events', 'secret', 'headers', 'active', 'description', 'metadata'];
            
            for (const field of allowedFields) {
                if (updates.hasOwnProperty(field)) {
                    setClause.push(`${field} = $${paramIndex}`);
                    if (field === 'headers' || field === 'metadata') {
                        values.push(JSON.stringify(updates[field]));
                    } else {
                        values.push(updates[field]);
                    }
                    paramIndex++;
                }
            }

            if (setClause.length > 0) {
                setClause.push(`updated_at = CURRENT_TIMESTAMP`);
                values.push(webhookId);

                const query = `
                    UPDATE webhooks 
                    SET ${setClause.join(', ')}
                    WHERE id = $${paramIndex}
                    RETURNING *
                `;

                const result = await this.pool.query(query, values);
                return result.rows[0];
            }

            return null;
        } catch (error) {
            logger.error('Error updating webhook:', error);
            throw error;
        }
    }

    async getWebhook(webhookId) {
        if (!this.connected) {
            return this.inMemoryGetWebhook(webhookId);
        }

        try {
            const query = `SELECT * FROM webhooks WHERE id = $1`;
            const result = await this.pool.query(query, [webhookId]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error getting webhook:', error);
            throw error;
        }
    }

    async listWebhooks(userId, filters = {}) {
        if (!this.connected) {
            return this.inMemoryListWebhooks(userId, filters);
        }

        try {
            let query = `SELECT * FROM webhooks WHERE user_id = $1`;
            const values = [userId];
            let paramIndex = 2;

            if (filters.active !== undefined) {
                query += ` AND active = $${paramIndex}`;
                values.push(filters.active);
                paramIndex++;
            }

            if (filters.event) {
                query += ` AND $${paramIndex} = ANY(events)`;
                values.push(filters.event);
                paramIndex++;
            }

            query += ` ORDER BY created_at DESC`;

            if (filters.limit) {
                query += ` LIMIT $${paramIndex}`;
                values.push(filters.limit);
            }

            const result = await this.pool.query(query, values);
            return result.rows;
        } catch (error) {
            logger.error('Error listing webhooks:', error);
            throw error;
        }
    }

    async deleteWebhook(webhookId) {
        if (!this.connected) {
            return this.inMemoryDeleteWebhook(webhookId);
        }

        try {
            const query = `DELETE FROM webhooks WHERE id = $1 RETURNING id`;
            const result = await this.pool.query(query, [webhookId]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error deleting webhook:', error);
            throw error;
        }
    }

    async saveWebhookDelivery(delivery) {
        if (!this.connected) {
            return this.inMemorySaveWebhookDelivery(delivery);
        }

        try {
            const query = `
                INSERT INTO webhook_deliveries 
                (id, webhook_id, event_type, event_id, status, attempts, 
                 response_status, response_data, error_message, delivered_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `;
            const values = [
                delivery.id,
                delivery.webhookId,
                delivery.eventType,
                delivery.eventId,
                delivery.status,
                delivery.attempts,
                delivery.responseStatus,
                JSON.stringify(delivery.responseData),
                delivery.errorMessage,
                delivery.deliveredAt
            ];
            const result = await this.pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error saving webhook delivery:', error);
            throw error;
        }
    }

    async getWebhookDeliveries(webhookId, limit = 100) {
        if (!this.connected) {
            return this.inMemoryGetWebhookDeliveries(webhookId, limit);
        }

        try {
            const query = `
                SELECT * FROM webhook_deliveries 
                WHERE webhook_id = $1 
                ORDER BY created_at DESC 
                LIMIT $2
            `;
            const result = await this.pool.query(query, [webhookId, limit]);
            return result.rows;
        } catch (error) {
            logger.error('Error getting webhook deliveries:', error);
            throw error;
        }
    }

    async saveWebhookEvent(event) {
        if (!this.connected) {
            return this.inMemorySaveWebhookEvent(event);
        }

        try {
            const query = `
                INSERT INTO webhook_events (id, type, payload)
                VALUES ($1, $2, $3)
                RETURNING *
            `;
            const values = [
                event.id,
                event.type,
                JSON.stringify(event.payload)
            ];
            const result = await this.pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error saving webhook event:', error);
            throw error;
        }
    }

    // In-memory webhook methods
    inMemorySaveWebhook(webhook) {
        if (!this.inMemoryStorage.webhooks) {
            this.inMemoryStorage.webhooks = new Map();
        }
        this.inMemoryStorage.webhooks.set(webhook.id, webhook);
        return webhook;
    }

    inMemoryUpdateWebhook(webhookId, updates) {
        if (!this.inMemoryStorage.webhooks) {
            return null;
        }
        const webhook = this.inMemoryStorage.webhooks.get(webhookId);
        if (webhook) {
            Object.assign(webhook, updates, { updatedAt: new Date() });
            return webhook;
        }
        return null;
    }

    inMemoryGetWebhook(webhookId) {
        if (!this.inMemoryStorage.webhooks) {
            return null;
        }
        return this.inMemoryStorage.webhooks.get(webhookId);
    }

    inMemoryListWebhooks(userId, filters) {
        if (!this.inMemoryStorage.webhooks) {
            return [];
        }
        let webhooks = Array.from(this.inMemoryStorage.webhooks.values())
            .filter(w => w.userId === userId);

        if (filters.active !== undefined) {
            webhooks = webhooks.filter(w => w.active === filters.active);
        }

        if (filters.event) {
            webhooks = webhooks.filter(w => w.events.includes(filters.event));
        }

        if (filters.limit) {
            webhooks = webhooks.slice(0, filters.limit);
        }

        return webhooks;
    }

    inMemoryDeleteWebhook(webhookId) {
        if (!this.inMemoryStorage.webhooks) {
            return null;
        }
        const webhook = this.inMemoryStorage.webhooks.get(webhookId);
        if (webhook) {
            this.inMemoryStorage.webhooks.delete(webhookId);
            return { id: webhookId };
        }
        return null;
    }

    inMemorySaveWebhookDelivery(delivery) {
        if (!this.inMemoryStorage.webhookDeliveries) {
            this.inMemoryStorage.webhookDeliveries = [];
        }
        this.inMemoryStorage.webhookDeliveries.push(delivery);
        
        // Keep only last 1000 deliveries
        if (this.inMemoryStorage.webhookDeliveries.length > 1000) {
            this.inMemoryStorage.webhookDeliveries = 
                this.inMemoryStorage.webhookDeliveries.slice(-1000);
        }
        
        return delivery;
    }

    inMemoryGetWebhookDeliveries(webhookId, limit) {
        if (!this.inMemoryStorage.webhookDeliveries) {
            return [];
        }
        return this.inMemoryStorage.webhookDeliveries
            .filter(d => d.webhookId === webhookId)
            .slice(-limit);
    }

    inMemorySaveWebhookEvent(event) {
        if (!this.inMemoryStorage.webhookEvents) {
            this.inMemoryStorage.webhookEvents = [];
        }
        this.inMemoryStorage.webhookEvents.push(event);
        
        // Keep only last 100 events
        if (this.inMemoryStorage.webhookEvents.length > 100) {
            this.inMemoryStorage.webhookEvents = 
                this.inMemoryStorage.webhookEvents.slice(-100);
        }
        
        return event;
    }

    // Cleanup
    async close() {
        if (this.pool) {
            await this.pool.end();
            logger.info('Database connection closed');
        }
    }
}

module.exports = new DatabaseService();