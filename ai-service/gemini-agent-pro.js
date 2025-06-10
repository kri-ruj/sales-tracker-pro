const { GoogleGenerativeAI } = require('@google/generative-ai');
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

/**
 * Enhanced Gemini Agent with Extended Tool Set
 * Using Gemini 2.0 Pro for advanced capabilities
 */
class GeminiAgentPro {
    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        
        // Extended tool set
        this.tools = [
            {
                functionDeclarations: [
                    // Original tools
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
                                    description: "Maximum number of results (default: 5)"
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
                                },
                                attendees: {
                                    type: "array",
                                    items: { type: "string" },
                                    description: "List of attendee emails"
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
                                    items: { type: "string" },
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
                    },
                    // New advanced tools
                    {
                        name: "executeCode",
                        description: "Execute Python or JavaScript code for calculations or data processing",
                        parameters: {
                            type: "object",
                            properties: {
                                language: {
                                    type: "string",
                                    description: "Programming language (python, javascript)"
                                },
                                code: {
                                    type: "string",
                                    description: "Code to execute"
                                }
                            },
                            required: ["language", "code"]
                        }
                    },
                    {
                        name: "readFile",
                        description: "Read content from a file",
                        parameters: {
                            type: "object",
                            properties: {
                                path: {
                                    type: "string",
                                    description: "File path to read"
                                }
                            },
                            required: ["path"]
                        }
                    },
                    {
                        name: "writeFile",
                        description: "Write content to a file",
                        parameters: {
                            type: "object",
                            properties: {
                                path: {
                                    type: "string",
                                    description: "File path to write"
                                },
                                content: {
                                    type: "string",
                                    description: "Content to write"
                                }
                            },
                            required: ["path", "content"]
                        }
                    },
                    {
                        name: "queryDatabase",
                        description: "Query a database with SQL",
                        parameters: {
                            type: "object",
                            properties: {
                                query: {
                                    type: "string",
                                    description: "SQL query to execute"
                                },
                                database: {
                                    type: "string",
                                    description: "Database name (default: main)"
                                }
                            },
                            required: ["query"]
                        }
                    },
                    {
                        name: "callAPI",
                        description: "Make an HTTP API call",
                        parameters: {
                            type: "object",
                            properties: {
                                url: {
                                    type: "string",
                                    description: "API endpoint URL"
                                },
                                method: {
                                    type: "string",
                                    description: "HTTP method (GET, POST, PUT, DELETE)"
                                },
                                headers: {
                                    type: "object",
                                    description: "Request headers"
                                },
                                body: {
                                    type: "object",
                                    description: "Request body for POST/PUT"
                                }
                            },
                            required: ["url", "method"]
                        }
                    },
                    {
                        name: "translateText",
                        description: "Translate text between languages",
                        parameters: {
                            type: "object",
                            properties: {
                                text: {
                                    type: "string",
                                    description: "Text to translate"
                                },
                                targetLanguage: {
                                    type: "string",
                                    description: "Target language code (e.g., es, fr, ja)"
                                },
                                sourceLanguage: {
                                    type: "string",
                                    description: "Source language code (auto-detect if not specified)"
                                }
                            },
                            required: ["text", "targetLanguage"]
                        }
                    },
                    {
                        name: "analyzeImage",
                        description: "Analyze an image and extract information",
                        parameters: {
                            type: "object",
                            properties: {
                                imagePath: {
                                    type: "string",
                                    description: "Path to the image file"
                                },
                                analysisType: {
                                    type: "string",
                                    description: "Type of analysis (objects, text, faces, labels)"
                                }
                            },
                            required: ["imagePath"]
                        }
                    },
                    {
                        name: "generateImage",
                        description: "Generate an image from text description",
                        parameters: {
                            type: "object",
                            properties: {
                                prompt: {
                                    type: "string",
                                    description: "Description of the image to generate"
                                },
                                style: {
                                    type: "string",
                                    description: "Art style (realistic, cartoon, abstract)"
                                }
                            },
                            required: ["prompt"]
                        }
                    },
                    {
                        name: "summarizeText",
                        description: "Summarize long text or documents",
                        parameters: {
                            type: "object",
                            properties: {
                                text: {
                                    type: "string",
                                    description: "Text to summarize"
                                },
                                length: {
                                    type: "string",
                                    description: "Summary length (short, medium, long)"
                                }
                            },
                            required: ["text"]
                        }
                    },
                    {
                        name: "createReminder",
                        description: "Set a reminder for a specific time",
                        parameters: {
                            type: "object",
                            properties: {
                                message: {
                                    type: "string",
                                    description: "Reminder message"
                                },
                                datetime: {
                                    type: "string",
                                    description: "When to remind (ISO datetime)"
                                }
                            },
                            required: ["message", "datetime"]
                        }
                    },
                    {
                        name: "calculateExpression",
                        description: "Perform complex mathematical calculations",
                        parameters: {
                            type: "object",
                            properties: {
                                expression: {
                                    type: "string",
                                    description: "Mathematical expression to evaluate"
                                }
                            },
                            required: ["expression"]
                        }
                    },
                    {
                        name: "convertUnits",
                        description: "Convert between different units of measurement",
                        parameters: {
                            type: "object",
                            properties: {
                                value: {
                                    type: "number",
                                    description: "Value to convert"
                                },
                                fromUnit: {
                                    type: "string",
                                    description: "Source unit"
                                },
                                toUnit: {
                                    type: "string",
                                    description: "Target unit"
                                }
                            },
                            required: ["value", "fromUnit", "toUnit"]
                        }
                    },
                    {
                        name: "getCryptoPrice",
                        description: "Get current cryptocurrency prices",
                        parameters: {
                            type: "object",
                            properties: {
                                symbol: {
                                    type: "string",
                                    description: "Crypto symbol (BTC, ETH, etc.)"
                                },
                                currency: {
                                    type: "string",
                                    description: "Fiat currency (USD, EUR, etc.)"
                                }
                            },
                            required: ["symbol"]
                        }
                    },
                    {
                        name: "getStockPrice",
                        description: "Get current stock market prices",
                        parameters: {
                            type: "object",
                            properties: {
                                symbol: {
                                    type: "string",
                                    description: "Stock symbol (AAPL, GOOGL, etc.)"
                                }
                            },
                            required: ["symbol"]
                        }
                    }
                ]
            }
        ];

        // Initialize model with Gemini 2.0 Pro
        this.model = this.genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp", // Using latest available model
            tools: this.tools,
            generationConfig: {
                temperature: 0.7,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 8192,
            }
        });

        this.chat = null;
        this.reminders = [];
    }

    /**
     * Execute tool function
     */
    async executeFunction(functionCall) {
        const { name, args } = functionCall;
        console.log(`[Agent] Executing function: ${name}`, args);

        try {
            switch (name) {
                // Original tools
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
                
                // New tools
                case "executeCode":
                    return this.executeCode(args);
                case "readFile":
                    return this.readFile(args);
                case "writeFile":
                    return this.writeFile(args);
                case "queryDatabase":
                    return this.queryDatabase(args);
                case "callAPI":
                    return this.callAPI(args);
                case "translateText":
                    return this.translateText(args);
                case "analyzeImage":
                    return this.analyzeImage(args);
                case "generateImage":
                    return this.generateImage(args);
                case "summarizeText":
                    return this.summarizeText(args);
                case "createReminder":
                    return this.createReminder(args);
                case "calculateExpression":
                    return this.calculateExpression(args);
                case "convertUnits":
                    return this.convertUnits(args);
                case "getCryptoPrice":
                    return this.getCryptoPrice(args);
                case "getStockPrice":
                    return this.getStockPrice(args);
                
                default:
                    throw new Error(`Unknown function: ${name}`);
            }
        } catch (error) {
            console.error(`[Agent] Function execution error:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Original tool implementations
    async getWeather({ location }) {
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
        const results = [];
        for (let i = 0; i < limit; i++) {
            results.push({
                title: `Result ${i + 1}: ${query}`,
                snippet: `Information about ${query} from source ${i + 1}...`,
                url: `https://example.com/search?q=${encodeURIComponent(query)}&page=${i + 1}`
            });
        }
        
        return {
            success: true,
            query,
            results,
            message: `Found ${results.length} results for "${query}"`
        };
    }

    async sendEmail({ to, subject, body }) {
        const emailId = `email_${Date.now()}`;
        console.log(`[Email] Sending to: ${to}`);
        console.log(`[Email] Subject: ${subject}`);
        
        return {
            success: true,
            emailId,
            message: `Email sent to ${to} with subject "${subject}"`
        };
    }

    async createCalendarEvent({ title, date, time, duration = 60, attendees = [] }) {
        const eventId = `event_${Date.now()}`;
        
        return {
            success: true,
            eventId,
            event: {
                title,
                date,
                time,
                duration,
                attendees,
                location: "Conference Room / Online"
            },
            message: `Calendar event "${title}" created for ${date} at ${time}`
        };
    }

    async analyzeData({ dataType, period = "weekly", metrics = [] }) {
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

    // New tool implementations
    async executeCode({ language, code }) {
        // Safety check
        if (code.includes('require') || code.includes('import') || code.includes('exec')) {
            return {
                success: false,
                error: "Code execution restricted for security reasons"
            };
        }

        try {
            let result;
            if (language === 'javascript') {
                // Simple JS evaluation
                result = eval(code);
            } else {
                result = "Python execution not available in this environment";
            }

            return {
                success: true,
                result: String(result),
                message: `Code executed successfully`
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async readFile({ path: filePath }) {
        try {
            // Safety check - only allow reading from demo directory
            const safePath = path.join(__dirname, 'demo', path.basename(filePath));
            const content = await fs.readFile(safePath, 'utf8');
            
            return {
                success: true,
                content: content.substring(0, 1000), // Limit response size
                message: `File read successfully: ${path.basename(filePath)}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to read file: ${error.message}`
            };
        }
    }

    async writeFile({ path: filePath, content }) {
        try {
            // Safety check - only allow writing to temp directory
            const safePath = path.join(__dirname, 'temp', `${Date.now()}_${path.basename(filePath)}`);
            await fs.mkdir(path.dirname(safePath), { recursive: true });
            await fs.writeFile(safePath, content);
            
            return {
                success: true,
                path: safePath,
                message: `File written successfully`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to write file: ${error.message}`
            };
        }
    }

    async queryDatabase({ query, database = "main" }) {
        // Mock database query
        const mockResults = [
            { id: 1, name: "John Doe", sales: 150000 },
            { id: 2, name: "Jane Smith", sales: 175000 },
            { id: 3, name: "Bob Johnson", sales: 125000 }
        ];

        return {
            success: true,
            results: mockResults,
            rowCount: mockResults.length,
            message: `Query executed successfully`
        };
    }

    async callAPI({ url, method, headers = {}, body = null }) {
        try {
            // Mock API call for demo
            const mockResponse = {
                status: 200,
                data: {
                    message: "Mock API response",
                    timestamp: new Date().toISOString(),
                    endpoint: url
                }
            };

            return {
                success: true,
                response: mockResponse,
                message: `API call to ${url} successful`
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async translateText({ text, targetLanguage, sourceLanguage = "auto" }) {
        // Mock translation
        const translations = {
            es: "Texto traducido al español",
            fr: "Texte traduit en français",
            ja: "日本語に翻訳されたテキスト",
            de: "Ins Deutsche übersetzter Text"
        };

        return {
            success: true,
            originalText: text,
            translatedText: translations[targetLanguage] || `[Translated to ${targetLanguage}]: ${text}`,
            sourceLanguage: sourceLanguage === "auto" ? "en" : sourceLanguage,
            targetLanguage,
            message: `Text translated to ${targetLanguage}`
        };
    }

    async analyzeImage({ imagePath, analysisType = "general" }) {
        // Mock image analysis
        return {
            success: true,
            analysis: {
                type: analysisType,
                objects: ["person", "laptop", "coffee cup"],
                text: analysisType === "text" ? "Sample text detected in image" : null,
                labels: ["indoor", "office", "work"],
                confidence: 0.92
            },
            message: `Image analyzed successfully`
        };
    }

    async generateImage({ prompt, style = "realistic" }) {
        // Mock image generation
        const imageId = `img_${Date.now()}`;
        
        return {
            success: true,
            imageId,
            url: `https://placeholder.com/512x512?text=${encodeURIComponent(prompt)}`,
            style,
            message: `Image generated from prompt: "${prompt}"`
        };
    }

    async summarizeText({ text, length = "medium" }) {
        const lengthMap = {
            short: 50,
            medium: 150,
            long: 300
        };

        const words = text.split(' ');
        const summaryLength = Math.min(words.length, lengthMap[length] || 150);
        const summary = words.slice(0, summaryLength).join(' ') + '...';

        return {
            success: true,
            originalLength: text.length,
            summary,
            compressionRatio: (summary.length / text.length * 100).toFixed(1) + '%',
            message: `Text summarized to ${length} length`
        };
    }

    async createReminder({ message, datetime }) {
        const reminderId = `reminder_${Date.now()}`;
        const reminder = {
            id: reminderId,
            message,
            datetime,
            created: new Date().toISOString()
        };
        
        this.reminders.push(reminder);
        
        return {
            success: true,
            reminderId,
            reminder,
            message: `Reminder set for ${datetime}`
        };
    }

    async calculateExpression({ expression }) {
        try {
            // Safe math evaluation
            const result = Function('"use strict"; return (' + expression + ')')();
            
            return {
                success: true,
                expression,
                result,
                message: `${expression} = ${result}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Invalid expression: ${error.message}`
            };
        }
    }

    async convertUnits({ value, fromUnit, toUnit }) {
        // Simple unit conversion
        const conversions = {
            "m_ft": 3.28084,
            "ft_m": 0.3048,
            "kg_lb": 2.20462,
            "lb_kg": 0.453592,
            "c_f": (c) => c * 9/5 + 32,
            "f_c": (f) => (f - 32) * 5/9
        };

        const key = `${fromUnit}_${toUnit}`;
        let result;

        if (typeof conversions[key] === 'function') {
            result = conversions[key](value);
        } else if (conversions[key]) {
            result = value * conversions[key];
        } else {
            return {
                success: false,
                error: `Conversion from ${fromUnit} to ${toUnit} not supported`
            };
        }

        return {
            success: true,
            original: { value, unit: fromUnit },
            converted: { value: result.toFixed(2), unit: toUnit },
            message: `${value} ${fromUnit} = ${result.toFixed(2)} ${toUnit}`
        };
    }

    async getCryptoPrice({ symbol, currency = "USD" }) {
        // Mock crypto prices
        const prices = {
            BTC: 43250.50,
            ETH: 2280.75,
            BNB: 315.20,
            SOL: 98.45,
            ADA: 0.58
        };

        const price = prices[symbol.toUpperCase()];
        if (!price) {
            return {
                success: false,
                error: `Unknown cryptocurrency: ${symbol}`
            };
        }

        return {
            success: true,
            symbol: symbol.toUpperCase(),
            price,
            currency,
            change24h: (Math.random() * 10 - 5).toFixed(2) + '%',
            message: `${symbol.toUpperCase()} is currently $${price} ${currency}`
        };
    }

    async getStockPrice({ symbol }) {
        // Mock stock prices
        const stocks = {
            AAPL: 195.89,
            GOOGL: 158.32,
            MSFT: 430.52,
            AMZN: 186.74,
            TSLA: 238.45
        };

        const price = stocks[symbol.toUpperCase()];
        if (!price) {
            return {
                success: false,
                error: `Unknown stock symbol: ${symbol}`
            };
        }

        return {
            success: true,
            symbol: symbol.toUpperCase(),
            price,
            change: (Math.random() * 5 - 2.5).toFixed(2),
            changePercent: (Math.random() * 3 - 1.5).toFixed(2) + '%',
            message: `${symbol.toUpperCase()} is trading at $${price}`
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

    resetChat() {
        this.chat = null;
        console.log('[Agent] Chat session reset');
    }
}

/**
 * Express server for the enhanced agent
 */
class AgentProServer {
    constructor() {
        this.app = express();
        this.port = process.env.AGENT_PORT || 3006;
        this.agent = new GeminiAgentPro();
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.static('demo'));
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                service: 'Gemini Agent Pro',
                model: 'gemini-2.0-flash-exp',
                toolCount: this.agent.tools[0].functionDeclarations.length,
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
            const tools = this.agent.tools[0].functionDeclarations.map(f => ({
                name: f.name,
                description: f.description,
                parameters: f.parameters
            }));

            // Group tools by category
            const categories = {
                communication: ['sendEmail', 'translateText'],
                productivity: ['createCalendarEvent', 'createReminder', 'generateDocument'],
                data: ['analyzeData', 'queryDatabase', 'readFile', 'writeFile'],
                web: ['searchWeb', 'callAPI', 'getStockPrice', 'getCryptoPrice'],
                intelligence: ['summarizeText', 'analyzeImage', 'generateImage'],
                utilities: ['getCurrentWeather', 'calculateExpression', 'convertUnits', 'executeCode']
            };

            res.json({
                success: true,
                totalTools: tools.length,
                categories,
                tools
            });
        });

        // Get reminders
        this.app.get('/reminders', (req, res) => {
            res.json({
                success: true,
                reminders: this.agent.reminders
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
            res.redirect('/agent-pro.html');
        });
    }

    start() {
        this.app.listen(this.port, () => {
            console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              🚀 Gemini Agent Pro with Extended Tools           ║
╠═══════════════════════════════════════════════════════════════╣
║  Status:     ✅ Running                                        ║
║  Port:       ${this.port}                                             ║
║  Model:      gemini-2.0-flash-exp                             ║
║  Tools:      20 available functions                           ║
║                                                               ║
║  Categories:                                                  ║
║    📧 Communication - Email, Translation                       ║
║    📅 Productivity - Calendar, Reminders, Documents           ║
║    📊 Data - Analysis, Database, Files                        ║
║    🌐 Web - Search, APIs, Crypto, Stocks                      ║
║    🧠 Intelligence - Summarize, Images                        ║
║    🛠️  Utilities - Weather, Math, Units, Code                 ║
║                                                               ║
║  Chat UI:    http://localhost:${this.port}/                           ║
╚═══════════════════════════════════════════════════════════════╝
            `);
        });
    }
}

// Start server
if (require.main === module) {
    const server = new AgentProServer();
    server.start();
}

module.exports = { GeminiAgentPro, AgentProServer };