const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

/**
 * Simple Chat Server
 * Focused only on AI chat functionality
 */
class ChatServer {
    constructor() {
        this.app = express();
        this.port = process.env.CHAT_PORT || 3003;
        
        // Initialize Gemini
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ 
            model: process.env.AI_MODEL || 'gemini-1.5-flash'
        });
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static('demo'));
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                service: 'Chat Server',
                model: process.env.AI_MODEL || 'gemini-1.5-flash',
                timestamp: new Date().toISOString()
            });
        });

        // Simple chat endpoint
        this.app.post('/chat', async (req, res) => {
            try {
                const { message } = req.body;
                
                if (!message) {
                    return res.status(400).json({
                        success: false,
                        error: 'Message is required'
                    });
                }

                console.log(`[Chat] User: ${message}`);

                // Generate response
                const result = await this.model.generateContent(message);
                const response = await result.response;
                const text = response.text();

                console.log(`[Chat] AI: ${text.substring(0, 50)}...`);

                res.json({
                    success: true,
                    response: text,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('[Chat] Error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Streaming chat endpoint
        this.app.post('/chat/stream', async (req, res) => {
            try {
                const { message } = req.body;
                
                if (!message) {
                    return res.status(400).json({
                        success: false,
                        error: 'Message is required'
                    });
                }

                // Set SSE headers
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');

                console.log(`[Stream] User: ${message}`);

                // Generate streaming response
                const result = await this.model.generateContentStream(message);

                for await (const chunk of result.stream) {
                    const text = chunk.text();
                    res.write(`data: ${JSON.stringify({ chunk: text })}\n\n`);
                }

                res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                res.end();

            } catch (error) {
                console.error('[Stream] Error:', error);
                res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
                res.end();
            }
        });

        // Root redirects to chat
        this.app.get('/', (req, res) => {
            res.redirect('/simple-chat.html');
        });
    }

    start() {
        this.app.listen(this.port, () => {
            console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                   💬 Chat Server                               ║
╠═══════════════════════════════════════════════════════════════╣
║  Status:     ✅ Running                                        ║
║  Port:       ${this.port}                                             ║
║  Model:      ${process.env.AI_MODEL || 'gemini-1.5-flash'}                         ║
║  Chat UI:    http://localhost:${this.port}/                           ║
╚═══════════════════════════════════════════════════════════════╝
            `);
        });
    }
}

// Start server
if (require.main === module) {
    const server = new ChatServer();
    server.start();
}

module.exports = ChatServer;