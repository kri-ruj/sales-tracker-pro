const { GoogleGenerativeAI } = require('@google/generative-ai');
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');
require('dotenv').config();

/**
 * ReAct Agent Implementation
 * Reasoning + Acting framework for step-by-step problem solving
 */
class ReActAgent extends EventEmitter {
    constructor() {
        super();
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.maxIterations = 10;
        this.thoughtHistory = [];
        this.actionHistory = [];
        
        // System prompt for ReAct framework
        this.systemPrompt = `You are a ReAct agent that follows the Reasoning and Acting framework.

For each user request, you will:
1. Thought: Analyze what the user wants and plan your approach
2. Action: Decide which tool to use and with what parameters
3. Observation: Process the tool result
4. Thought: Reflect on the result and decide next steps
5. Repeat until you have a complete answer

Always structure your response in this format:
Thought: [Your reasoning about the current situation]
Action: [Tool name and parameters to use]
Observation: [What you learned from the tool result]
... (repeat as needed)
Thought: [Final conclusion]
Answer: [Final response to the user]

Available tools and their purposes:
- getCurrentWeather: Get weather information for planning and recommendations
- searchWeb: Find current information not in your training data
- sendEmail: Compose and send emails for communication tasks
- createCalendarEvent: Schedule meetings and events
- analyzeData: Process and analyze business data
- generateDocument: Create structured documents
- executeCode: Run calculations or data processing
- readFile/writeFile: Manage file operations
- queryDatabase: Retrieve structured data
- callAPI: Integrate with external services
- translateText: Handle multilingual requirements
- analyzeImage: Extract information from images
- summarizeText: Condense long content
- createReminder: Set time-based alerts
- calculateExpression: Perform complex math
- convertUnits: Handle unit conversions
- getCryptoPrice/getStockPrice: Get financial data

Be thorough but efficient. Chain tools when necessary to achieve complex goals.`;

        // Define available tools
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
                    {
                        name: "executeCode",
                        description: "Execute Python or JavaScript code for calculations",
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
                                    description: "Database name"
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
                                    description: "HTTP method"
                                },
                                headers: {
                                    type: "object",
                                    description: "Request headers"
                                },
                                body: {
                                    type: "object",
                                    description: "Request body"
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
                                    description: "Target language code"
                                },
                                sourceLanguage: {
                                    type: "string",
                                    description: "Source language code"
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
                                    description: "Type of analysis"
                                }
                            },
                            required: ["imagePath"]
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
                                    description: "Summary length"
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
                                    description: "When to remind"
                                }
                            },
                            required: ["message", "datetime"]
                        }
                    },
                    {
                        name: "calculateExpression",
                        description: "Perform mathematical calculations",
                        parameters: {
                            type: "object",
                            properties: {
                                expression: {
                                    type: "string",
                                    description: "Mathematical expression"
                                }
                            },
                            required: ["expression"]
                        }
                    },
                    {
                        name: "convertUnits",
                        description: "Convert between units of measurement",
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
                        description: "Get cryptocurrency prices",
                        parameters: {
                            type: "object",
                            properties: {
                                symbol: {
                                    type: "string",
                                    description: "Crypto symbol"
                                },
                                currency: {
                                    type: "string",
                                    description: "Fiat currency"
                                }
                            },
                            required: ["symbol"]
                        }
                    },
                    {
                        name: "getStockPrice",
                        description: "Get stock market prices",
                        parameters: {
                            type: "object",
                            properties: {
                                symbol: {
                                    type: "string",
                                    description: "Stock symbol"
                                }
                            },
                            required: ["symbol"]
                        }
                    }
                ]
            }
        ];

        // Initialize model
        this.model = this.genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            tools: this.tools,
            systemInstruction: this.systemPrompt
        });

        this.chat = null;
        this.executionTrace = [];
    }

    /**
     * Execute ReAct loop
     */
    async executeReAct(userQuery) {
        console.log(`[ReAct] Starting execution for: "${userQuery}"`);
        
        this.thoughtHistory = [];
        this.actionHistory = [];
        this.executionTrace = [];
        
        // Start new chat with system prompt
        this.chat = this.model.startChat({
            history: [],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 4096,
            }
        });

        // Initial prompt with ReAct instructions
        const initialPrompt = `User Query: ${userQuery}

Please solve this step by step using the ReAct framework. Start with a Thought about what needs to be done.`;

        let iteration = 0;
        let finalAnswer = null;
        let currentContext = initialPrompt;

        while (iteration < this.maxIterations && !finalAnswer) {
            iteration++;
            console.log(`[ReAct] Iteration ${iteration}`);

            try {
                // Get agent's response
                const result = await this.chat.sendMessage(currentContext);
                const response = await result.response;
                const responseText = response.text();
                
                console.log(`[ReAct] Response: ${responseText.substring(0, 200)}...`);

                // Parse the response to extract thoughts and actions
                const { thought, action, answer } = this.parseReActResponse(responseText);

                if (thought) {
                    this.thoughtHistory.push({ iteration, thought });
                    this.executionTrace.push({ type: 'thought', content: thought, iteration });
                    this.emit('thought', { iteration, thought });
                }

                // Check if we have a final answer
                if (answer) {
                    finalAnswer = answer;
                    this.executionTrace.push({ type: 'answer', content: answer, iteration });
                    break;
                }

                // Check for function calls
                const functionCalls = response.functionCalls();
                if (functionCalls && functionCalls.length > 0) {
                    console.log(`[ReAct] Executing ${functionCalls.length} function(s)`);
                    
                    const observations = [];
                    for (const call of functionCalls) {
                        const observation = await this.executeFunction(call);
                        observations.push({
                            tool: call.name,
                            args: call.args,
                            result: observation
                        });
                        
                        this.actionHistory.push({
                            iteration,
                            action: call.name,
                            args: call.args,
                            result: observation
                        });
                        
                        this.executionTrace.push({
                            type: 'action',
                            tool: call.name,
                            args: call.args,
                            result: observation,
                            iteration
                        });
                        
                        this.emit('action', {
                            iteration,
                            tool: call.name,
                            args: call.args,
                            result: observation
                        });
                    }

                    // Send function results back
                    const functionResponseParts = observations.map(obs => ({
                        functionResponse: {
                            name: obs.tool,
                            response: obs.result
                        }
                    }));
                    
                    const observationResult = await this.chat.sendMessage(functionResponseParts);
                    const observationText = observationResult.response.text();
                    
                    currentContext = `Based on the tool results, continue with your reasoning. ${observationText}`;
                    
                    // Parse observation response
                    const obsResponse = this.parseReActResponse(observationText);
                    if (obsResponse.answer) {
                        finalAnswer = obsResponse.answer;
                        this.executionTrace.push({ type: 'answer', content: finalAnswer, iteration });
                    }
                } else if (action) {
                    // If action was mentioned but no function call, prompt for it
                    currentContext = "Please execute the action you mentioned using the appropriate tool.";
                } else {
                    // Continue reasoning
                    currentContext = "Continue with your next thought or action.";
                }

            } catch (error) {
                console.error(`[ReAct] Error in iteration ${iteration}:`, error);
                this.executionTrace.push({
                    type: 'error',
                    content: error.message,
                    iteration
                });
                
                // Try to recover
                currentContext = `An error occurred: ${error.message}. Please continue with an alternative approach.`;
            }
        }

        if (!finalAnswer) {
            finalAnswer = "I've reached the maximum number of iterations. Here's what I've discovered so far: " + 
                         this.summarizeProgress();
        }

        return {
            answer: finalAnswer,
            thoughtHistory: this.thoughtHistory,
            actionHistory: this.actionHistory,
            executionTrace: this.executionTrace,
            iterations: iteration
        };
    }

    /**
     * Parse ReAct response format
     */
    parseReActResponse(text) {
        const thought = this.extractSection(text, 'Thought:');
        const action = this.extractSection(text, 'Action:');
        const observation = this.extractSection(text, 'Observation:');
        const answer = this.extractSection(text, 'Answer:');

        return { thought, action, observation, answer };
    }

    /**
     * Extract section from response
     */
    extractSection(text, marker) {
        const regex = new RegExp(`${marker}\\s*(.+?)(?=(?:Thought:|Action:|Observation:|Answer:|$))`, 's');
        const match = text.match(regex);
        return match ? match[1].trim() : null;
    }

    /**
     * Summarize progress
     */
    summarizeProgress() {
        const thoughts = this.thoughtHistory.map(t => `- ${t.thought}`).join('\n');
        const actions = this.actionHistory.map(a => `- ${a.action}: ${JSON.stringify(a.result)}`).join('\n');
        
        return `Thoughts:\n${thoughts}\n\nActions taken:\n${actions}`;
    }

    /**
     * Execute tool function
     */
    async executeFunction(functionCall) {
        const { name, args } = functionCall;
        console.log(`[ReAct Tool] Executing: ${name}`, args);

        try {
            switch (name) {
                case "getCurrentWeather":
                    return await this.getWeather(args);
                case "searchWeb":
                    return await this.searchWeb(args);
                case "sendEmail":
                    return await this.sendEmail(args);
                case "createCalendarEvent":
                    return await this.createCalendarEvent(args);
                case "analyzeData":
                    return await this.analyzeData(args);
                case "generateDocument":
                    return await this.generateDocument(args);
                case "executeCode":
                    return await this.executeCode(args);
                case "readFile":
                    return await this.readFile(args);
                case "writeFile":
                    return await this.writeFile(args);
                case "queryDatabase":
                    return await this.queryDatabase(args);
                case "callAPI":
                    return await this.callAPI(args);
                case "translateText":
                    return await this.translateText(args);
                case "analyzeImage":
                    return await this.analyzeImage(args);
                case "summarizeText":
                    return await this.summarizeText(args);
                case "createReminder":
                    return await this.createReminder(args);
                case "calculateExpression":
                    return await this.calculateExpression(args);
                case "convertUnits":
                    return await this.convertUnits(args);
                case "getCryptoPrice":
                    return await this.getCryptoPrice(args);
                case "getStockPrice":
                    return await this.getStockPrice(args);
                default:
                    throw new Error(`Unknown function: ${name}`);
            }
        } catch (error) {
            console.error(`[ReAct Tool] Error:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Tool implementations (simplified versions)
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
            data: mockWeather
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
            results
        };
    }

    async sendEmail({ to, subject, body }) {
        return {
            success: true,
            emailId: `email_${Date.now()}`,
            message: `Email sent to ${to}`
        };
    }

    async createCalendarEvent({ title, date, time, duration = 60, attendees = [] }) {
        return {
            success: true,
            eventId: `event_${Date.now()}`,
            event: { title, date, time, duration, attendees }
        };
    }

    async analyzeData({ dataType, period = "weekly", metrics = [] }) {
        return {
            success: true,
            analysis: {
                dataType,
                period,
                totalSales: Math.floor(Math.random() * 100000) + 50000,
                conversion: (Math.random() * 30 + 10).toFixed(1),
                growth: (Math.random() * 20 - 10).toFixed(1)
            }
        };
    }

    async generateDocument({ type, title, content = {} }) {
        const templates = {
            report: `# ${title}\n\n## Summary\n${content.summary || 'Generated summary...'}\n\n## Details\n${content.details || 'Generated details...'}`,
            proposal: `# ${title}\n\n## Overview\n${content.overview || 'Generated overview...'}\n\n## Solution\n${content.solution || 'Generated solution...'}`,
            contract: `# ${title}\n\n## Terms\n${content.terms || 'Generated terms...'}\n\n## Conditions\n${content.conditions || 'Generated conditions...'}`
        };
        
        return {
            success: true,
            document: templates[type] || `# ${title}\n\nGenerated content...`
        };
    }

    async executeCode({ language, code }) {
        if (code.includes('require') || code.includes('import') || code.includes('exec')) {
            return { success: false, error: "Code execution restricted" };
        }

        try {
            let result;
            if (language === 'javascript') {
                result = eval(code);
            } else {
                result = "Python execution not available";
            }
            return { success: true, result: String(result) };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async readFile({ path: filePath }) {
        try {
            const safePath = path.join(__dirname, 'demo', path.basename(filePath));
            const content = await fs.readFile(safePath, 'utf8');
            return { success: true, content: content.substring(0, 1000) };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async writeFile({ path: filePath, content }) {
        try {
            const safePath = path.join(__dirname, 'temp', `${Date.now()}_${path.basename(filePath)}`);
            await fs.mkdir(path.dirname(safePath), { recursive: true });
            await fs.writeFile(safePath, content);
            return { success: true, path: safePath };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async queryDatabase({ query, database = "main" }) {
        return {
            success: true,
            results: [
                { id: 1, name: "John Doe", value: 150000 },
                { id: 2, name: "Jane Smith", value: 175000 }
            ]
        };
    }

    async callAPI({ url, method, headers = {}, body = null }) {
        return {
            success: true,
            response: {
                status: 200,
                data: { message: "Mock API response", url, method }
            }
        };
    }

    async translateText({ text, targetLanguage, sourceLanguage = "auto" }) {
        const translations = {
            es: "Texto traducido al español",
            fr: "Texte traduit en français",
            ja: "日本語に翻訳されたテキスト"
        };
        
        return {
            success: true,
            translatedText: translations[targetLanguage] || `[${targetLanguage}] ${text}`
        };
    }

    async analyzeImage({ imagePath, analysisType = "general" }) {
        return {
            success: true,
            analysis: {
                objects: ["person", "laptop", "coffee"],
                text: analysisType === "text" ? "Detected text" : null,
                labels: ["indoor", "office", "work"]
            }
        };
    }

    async summarizeText({ text, length = "medium" }) {
        const words = text.split(' ');
        const summaryLength = { short: 50, medium: 150, long: 300 }[length] || 150;
        return {
            success: true,
            summary: words.slice(0, Math.min(words.length, summaryLength)).join(' ') + '...'
        };
    }

    async createReminder({ message, datetime }) {
        return {
            success: true,
            reminderId: `reminder_${Date.now()}`,
            reminder: { message, datetime }
        };
    }

    async calculateExpression({ expression }) {
        try {
            const result = Function('"use strict"; return (' + expression + ')')();
            return { success: true, result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async convertUnits({ value, fromUnit, toUnit }) {
        const conversions = {
            "m_ft": 3.28084,
            "ft_m": 0.3048,
            "kg_lb": 2.20462,
            "lb_kg": 0.453592
        };
        
        const key = `${fromUnit}_${toUnit}`;
        if (conversions[key]) {
            return {
                success: true,
                result: value * conversions[key]
            };
        }
        
        return { success: false, error: "Conversion not supported" };
    }

    async getCryptoPrice({ symbol, currency = "USD" }) {
        const prices = {
            BTC: 43250.50,
            ETH: 2280.75,
            BNB: 315.20
        };
        
        return {
            success: true,
            price: prices[symbol.toUpperCase()] || 0,
            currency
        };
    }

    async getStockPrice({ symbol }) {
        const stocks = {
            AAPL: 195.89,
            GOOGL: 158.32,
            MSFT: 430.52
        };
        
        return {
            success: true,
            price: stocks[symbol.toUpperCase()] || 0
        };
    }
}

/**
 * ReAct Agent Server
 */
class ReActServer {
    constructor() {
        this.app = express();
        this.port = process.env.REACT_PORT || 3007;
        this.agent = new ReActAgent();
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupEventHandlers();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.static('demo'));
    }

    setupEventHandlers() {
        this.agent.on('thought', (data) => {
            console.log(`[Thought ${data.iteration}] ${data.thought}`);
        });

        this.agent.on('action', (data) => {
            console.log(`[Action ${data.iteration}] ${data.tool}(${JSON.stringify(data.args)})`);
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                service: 'ReAct Agent',
                framework: 'Reasoning + Acting',
                model: 'gemini-1.5-flash',
                maxIterations: this.agent.maxIterations
            });
        });

        // Execute ReAct flow
        this.app.post('/react', async (req, res) => {
            try {
                const { query } = req.body;
                
                if (!query) {
                    return res.status(400).json({
                        success: false,
                        error: 'Query is required'
                    });
                }

                console.log(`[Server] Processing query: "${query}"`);
                
                // Execute ReAct loop
                const result = await this.agent.executeReAct(query);
                
                res.json({
                    success: true,
                    result
                });

            } catch (error) {
                console.error('[Server] Error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Get execution trace
        this.app.get('/trace', (req, res) => {
            res.json({
                success: true,
                trace: this.agent.executionTrace,
                thoughtCount: this.agent.thoughtHistory.length,
                actionCount: this.agent.actionHistory.length
            });
        });

        // Available tools
        this.app.get('/tools', (req, res) => {
            const tools = this.agent.tools[0].functionDeclarations.map(f => ({
                name: f.name,
                description: f.description,
                parameters: f.parameters
            }));

            res.json({
                success: true,
                tools,
                count: tools.length
            });
        });

        // Root endpoint
        this.app.get('/', (req, res) => {
            res.redirect('/react-agent.html');
        });
    }

    start() {
        this.app.listen(this.port, () => {
            console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                   🧠 ReAct Agent Framework                     ║
╠═══════════════════════════════════════════════════════════════╣
║  Status:     ✅ Running                                        ║
║  Port:       ${this.port}                                             ║
║  Framework:  Reasoning + Acting (ReAct)                       ║
║  Model:      gemini-1.5-flash                                 ║
║                                                               ║
║  Features:                                                    ║
║    • Step-by-step reasoning                                   ║
║    • Tool execution with observations                         ║
║    • Thought → Action → Observation loops                     ║
║    • Maximum ${this.agent.maxIterations} iterations per query                          ║
║    • Execution trace tracking                                 ║
║                                                               ║
║  UI:         http://localhost:${this.port}/                           ║
╚═══════════════════════════════════════════════════════════════╝
            `);
        });
    }
}

// Start server
if (require.main === module) {
    const server = new ReActServer();
    server.start();
}

module.exports = { ReActAgent, ReActServer };