const { GoogleGenerativeAI } = require('@google/generative-ai');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

/**
 * Real Agent using Gemini SDK with Function Calling
 */
class GeminiAgent {
    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        
        // Define available tools/functions
        this.tools = [
            {
                functionDeclarations: [
                    {
                        name: "getCurrentWeather",
                        description: "Get the current weather in a given location",
                        parameters: {
                            type: "object",
                            properties: {
                                location: {
                                    type: "string",
                                    description: "The city and state, e.g. San Francisco, CA"
                                }
                            },
                            required: ["location"]
                        }
                    },
                    {
                        name: "searchWeb",
                        description: "Search the web for information",
                        parameters: {
                            type: "object",
                            properties: {
                                query: {
                                    type: "string",
                                    description: "The search query"
                                },
                                limit: {
                                    type: "number",
                                    description: "Maximum number of results"
                                }
                            },
                            required: ["query"]
                        }
                    },
                    {
                        name: "sendEmail",
                        description: "Send an email to someone",
                        parameters: {
                            type: "object",
                            properties: {
                                to: {
                                    type: "string",
                                    description: "Recipient email address"
                                },
                                subject: {
                                    type: "string",
                                    description: "Email subject"
                                },
                                body: {
                                    type: "string",
                                    description: "Email body content"
                                }
                            },
                            required: ["to", "subject", "body"]
                        }
                    },
                    {
                        name: "createCalendarEvent",
                        description: "Create a calendar event",
                        parameters: {
                            type: "object",
                            properties: {
                                title: {
                                    type: "string",
                                    description: "Event title"
                                },
                                date: {
                                    type: "string",
                                    description: "Event date (YYYY-MM-DD)"
                                },
                                time: {
                                    type: "string",
                                    description: "Event time (HH:MM)"
                                },
                                duration: {
                                    type: "number",
                                    description: "Duration in minutes"
                                }
                            },
                            required: ["title", "date", "time"]
                        }
                    },
                    {
                        name: "analyzeData",
                        description: "Analyze sales or business data",
                        parameters: {
                            type: "object",
                            properties: {
                                dataType: {
                                    type: "string",
                                    description: "Type of data (sales, leads, performance)"
                                },
                                period: {
                                    type: "string",
                                    description: "Time period (daily, weekly, monthly)"
                                },
                                metrics: {
                                    type: "array",
                                    items: {
                                        type: "string"
                                    },
                                    description: "Metrics to analyze"
                                }
                            },
                            required: ["dataType"]
                        }
                    },
                    {
                        name: "generateDocument",
                        description: "Generate a document (report, proposal, contract)",
                        parameters: {
                            type: "object",
                            properties: {
                                type: {
                                    type: "string",
                                    description: "Document type (report, proposal, contract)"
                                },
                                title: {
                                    type: "string",
                                    description: "Document title"
                                },
                                content: {
                                    type: "object",
                                    description: "Document content requirements"
                                }
                            },
                            required: ["type", "title"]
                        }
                    }
                ]
            }
        ];

        // Initialize model with tools
        this.model = this.genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            tools: this.tools
        });

        this.chat = null;
    }

    /**
     * Execute tool function
     */
    async executeFunction(functionCall) {
        const { name, args } = functionCall;
        console.log(`[Agent] Executing function: ${name}`, args);

        switch (name) {
            case "getCurrentWeather":
                return this.getWeather(args);
            
            case "searchWeb":
                return this.searchWeb(args);
            
            case "sendEmail":
                return this.sendEmail(args);
            
            case "createCalendarEvent":
                return this.createCalendarEvent(args);
            
            case "analyzeData":
                return this.analyzeData(args);
            
            case "generateDocument":
                return this.generateDocument(args);
            
            default:
                throw new Error(`Unknown function: ${name}`);
        }
    }

    /**
     * Tool implementations
     */
    async getWeather({ location }) {
        // In real implementation, call weather API
        const mockWeather = {
            location,
            temperature: Math.floor(Math.random() * 30) + 10,
            conditions: ["sunny", "cloudy", "rainy", "partly cloudy"][Math.floor(Math.random() * 4)],
            humidity: Math.floor(Math.random() * 40) + 40,
            wind: Math.floor(Math.random() * 20) + 5
        };
        
        return {
            success: true,
            data: mockWeather,
            message: `Weather in ${location}: ${mockWeather.temperature}°C, ${mockWeather.conditions}`
        };
    }

    async searchWeb({ query, limit = 5 }) {
        // Mock web search results
        const results = [
            {
                title: `Latest updates on "${query}"`,
                snippet: `Recent developments and news about ${query}...`,
                url: `https://example.com/search?q=${encodeURIComponent(query)}`
            },
            {
                title: `${query} - Complete Guide`,
                snippet: `Everything you need to know about ${query}...`,
                url: `https://guide.example.com/${encodeURIComponent(query)}`
            },
            {
                title: `Top 10 ${query} Resources`,
                snippet: `Curated list of the best resources for ${query}...`,
                url: `https://resources.example.com/${encodeURIComponent(query)}`
            }
        ];
        
        return {
            success: true,
            query,
            results: results.slice(0, limit),
            message: `Found ${results.length} results for "${query}"`
        };
    }

    async sendEmail({ to, subject, body }) {
        // Mock email sending
        const emailId = `email_${Date.now()}`;
        
        console.log(`[Email] Sending to: ${to}`);
        console.log(`[Email] Subject: ${subject}`);
        console.log(`[Email] Body: ${body.substring(0, 100)}...`);
        
        return {
            success: true,
            emailId,
            message: `Email sent to ${to} with subject "${subject}"`
        };
    }

    async createCalendarEvent({ title, date, time, duration = 60 }) {
        const eventId = `event_${Date.now()}`;
        
        return {
            success: true,
            eventId,
            event: {
                title,
                date,
                time,
                duration,
                location: "Online"
            },
            message: `Calendar event "${title}" created for ${date} at ${time}`
        };
    }

    async analyzeData({ dataType, period = "weekly", metrics = [] }) {
        // Mock data analysis
        const analysis = {
            dataType,
            period,
            summary: {
                totalSales: Math.floor(Math.random() * 100000) + 50000,
                conversion: (Math.random() * 30 + 10).toFixed(1),
                growth: (Math.random() * 20 - 10).toFixed(1),
                topPerformers: ["Product A", "Service B", "Package C"]
            },
            insights: [
                `${dataType} performance is trending upward this ${period}`,
                `Conversion rate improved by ${(Math.random() * 5 + 2).toFixed(1)}%`,
                `Key opportunity identified in segment X`
            ]
        };
        
        return {
            success: true,
            analysis,
            message: `Analysis complete for ${dataType} (${period})`
        };
    }

    async generateDocument({ type, title, content = {} }) {
        const documentId = `doc_${Date.now()}`;
        
        const templates = {
            report: `# ${title}\n\n## Executive Summary\n${content.summary || 'Summary here...'}\n\n## Key Findings\n${content.findings || 'Findings here...'}\n\n## Recommendations\n${content.recommendations || 'Recommendations here...'}`,
            proposal: `# ${title}\n\n## Overview\n${content.overview || 'Overview here...'}\n\n## Solution\n${content.solution || 'Solution here...'}\n\n## Pricing\n${content.pricing || 'Pricing here...'}`,
            contract: `# ${title}\n\n## Parties\n${content.parties || 'Parties here...'}\n\n## Terms\n${content.terms || 'Terms here...'}\n\n## Signatures\n${content.signatures || 'Signatures here...'}`
        };
        
        return {
            success: true,
            documentId,
            type,
            title,
            content: templates[type] || `# ${title}\n\nDocument content...`,
            message: `${type} "${title}" generated successfully`
        };
    }

    /**
     * Process message with tool calling
     */
    async processMessage(message, useStreaming = false) {
        try {
            // Start or continue chat
            if (!this.chat) {
                this.chat = this.model.startChat({
                    history: [],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 2048,
                    }
                });
            }

            console.log(`[Agent] User: ${message}`);

            // Send message and get response
            const result = await this.chat.sendMessage(message);
            const response = await result.response;

            // Check for function calls
            const functionCalls = response.functionCalls();
            if (functionCalls && functionCalls.length > 0) {
                console.log(`[Agent] Function calls detected: ${functionCalls.length}`);
                
                // Execute all function calls
                const functionResponses = [];
                for (const call of functionCalls) {
                    try {
                        const result = await this.executeFunction(call);
                        functionResponses.push({
                            name: call.name,
                            response: result
                        });
                    } catch (error) {
                        functionResponses.push({
                            name: call.name,
                            response: {
                                success: false,
                                error: error.message
                            }
                        });
                    }
                }

                // Send all function results back to continue the conversation
                const functionResponseParts = functionResponses.map(fr => ({
                    functionResponse: {
                        name: fr.name,
                        response: fr.response
                    }
                }));
                
                const functionResult = await this.chat.sendMessage(functionResponseParts);

                const finalResponse = await functionResult.response;
                return {
                    text: finalResponse.text(),
                    functionCalls: functionResponses,
                    usage: finalResponse.usageMetadata
                };
            }

            // No function calls, just return the text
            return {
                text: response.text(),
                functionCalls: [],
                usage: response.usageMetadata
            };

        } catch (error) {
            console.error('[Agent] Error:', error);
            throw error;
        }
    }

    /**
     * Reset chat session
     */
    resetChat() {
        this.chat = null;
        console.log('[Agent] Chat session reset');
    }
}

/**
 * Express server for the agent
 */
class AgentServer {
    constructor() {
        this.app = express();
        this.port = process.env.AGENT_PORT || 3005;
        this.agent = new GeminiAgent();
        
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
                service: 'Gemini Agent with Tools',
                model: 'gemini-1.5-flash',
                tools: this.agent.tools[0].functionDeclarations.map(f => f.name)
            });
        });

        // Chat endpoint
        this.app.post('/chat', async (req, res) => {
            try {
                const { message, resetSession = false } = req.body;
                
                if (resetSession) {
                    this.agent.resetChat();
                }

                const response = await this.agent.processMessage(message);
                
                res.json({
                    success: true,
                    response: response.text,
                    tools: response.functionCalls,
                    usage: response.usage
                });

            } catch (error) {
                console.error('[Server] Error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Available tools endpoint
        this.app.get('/tools', (req, res) => {
            res.json({
                success: true,
                tools: this.agent.tools[0].functionDeclarations.map(f => ({
                    name: f.name,
                    description: f.description,
                    parameters: f.parameters
                }))
            });
        });

        // Reset session
        this.app.post('/reset', (req, res) => {
            this.agent.resetChat();
            res.json({
                success: true,
                message: 'Chat session reset'
            });
        });

        // Root endpoint
        this.app.get('/', (req, res) => {
            res.redirect('/agent.html');
        });
    }

    start() {
        this.app.listen(this.port, () => {
            console.log(`
╔═══════════════════════════════════════════════════════════════╗
║               🤖 Gemini Agent with Tools                       ║
╠═══════════════════════════════════════════════════════════════╣
║  Status:     ✅ Running                                        ║
║  Port:       ${this.port}                                             ║
║  Model:      gemini-1.5-flash                                 ║
║                                                               ║
║  Available Tools:                                             ║
║    • getCurrentWeather - Get weather information              ║
║    • searchWeb - Search the internet                          ║
║    • sendEmail - Send emails                                  ║
║    • createCalendarEvent - Schedule events                    ║
║    • analyzeData - Analyze business data                      ║
║    • generateDocument - Create documents                      ║
║                                                               ║
║  Chat UI:    http://localhost:${this.port}/                           ║
╚═══════════════════════════════════════════════════════════════╝
            `);
        });
    }
}

// Start server
if (require.main === module) {
    const server = new AgentServer();
    server.start();
}

module.exports = { GeminiAgent, AgentServer };