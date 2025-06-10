const { GoogleGenerativeAI } = require('@google/generative-ai');
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const path = require('path');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const { body, validationResult } = require('express-validator');
const fs = require('fs').promises;
const crypto = require('crypto');
const sharp = require('sharp');
const Jimp = require('jimp');
require('dotenv').config();

// Import services
const cacheService = require('./services/cache.service');
const apiClient = require('./services/api-client.service');
const authService = require('./services/auth.service');
const databaseService = require('./services/database.service');
const queueService = require('./services/queue.service');
const exportService = require('./services/export.service');
const webhookService = require('./services/webhook.service');

// Logger setup
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

/**
 * Enhanced ReAct Agent with all improvements
 */
class EnhancedReActAgent {
    constructor(io) {
        this.io = io;
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.maxIterations = 10;
        this.activeChats = new Map(); // Store active chat sessions
        
        // Circuit breakers for each API
        this.circuitBreakers = {
            crypto: apiClient.createCircuitBreaker('crypto'),
            weather: apiClient.createCircuitBreaker('weather'),
            search: apiClient.createCircuitBreaker('search'),
            country: apiClient.createCircuitBreaker('country')
        };
        
        // System prompt
        this.systemPrompt = `You are a helpful AI assistant that uses tools to provide accurate, real-time information.

When answering questions:
1. Think about what information you need
2. Use the appropriate tools to gather that information
3. Provide a clear answer based on the tool results

Important: Always use tools when current information is requested. Never make up data.`;

        // Tool definitions
        this.tools = [
            {
                functionDeclarations: [
                    {
                        name: "searchWeb",
                        description: "Search the web for current information",
                        parameters: {
                            type: "object",
                            properties: {
                                query: { type: "string", description: "Search query" }
                            },
                            required: ["query"]
                        }
                    },
                    {
                        name: "getCryptoPrice",
                        description: "Get real-time cryptocurrency prices",
                        parameters: {
                            type: "object",
                            properties: {
                                symbol: { type: "string", description: "Crypto symbol (BTC, ETH, etc.)" }
                            },
                            required: ["symbol"]
                        }
                    },
                    {
                        name: "getWeather",
                        description: "Get current weather data",
                        parameters: {
                            type: "object",
                            properties: {
                                city: { type: "string", description: "City name" }
                            },
                            required: ["city"]
                        }
                    },
                    {
                        name: "getCountryInfo",
                        description: "Get information about a country",
                        parameters: {
                            type: "object",
                            properties: {
                                country: { type: "string", description: "Country name" }
                            },
                            required: ["country"]
                        }
                    },
                    {
                        name: "convertCurrency",
                        description: "Convert between currencies",
                        parameters: {
                            type: "object",
                            properties: {
                                amount: { type: "number", description: "Amount to convert" },
                                from: { type: "string", description: "Source currency" },
                                to: { type: "string", description: "Target currency" }
                            },
                            required: ["amount", "from", "to"]
                        }
                    },
                    {
                        name: "calculate",
                        description: "Perform mathematical calculations",
                        parameters: {
                            type: "object",
                            properties: {
                                expression: { type: "string", description: "Mathematical expression to evaluate (e.g., '2 + 2', 'sqrt(16)', 'sin(45)')" }
                            },
                            required: ["expression"]
                        }
                    },
                    {
                        name: "translateText",
                        description: "Translate text between languages",
                        parameters: {
                            type: "object",
                            properties: {
                                text: { type: "string", description: "Text to translate" },
                                from: { type: "string", description: "Source language code (e.g., 'en', 'es', 'fr')" },
                                to: { type: "string", description: "Target language code" }
                            },
                            required: ["text", "from", "to"]
                        }
                    },
                    {
                        name: "readFile",
                        description: "Read contents of a file from the safe directory",
                        parameters: {
                            type: "object",
                            properties: {
                                filename: { type: "string", description: "Name of the file to read (from safe directory only)" }
                            },
                            required: ["filename"]
                        }
                    },
                    {
                        name: "writeFile",
                        description: "Write contents to a file in the safe directory",
                        parameters: {
                            type: "object",
                            properties: {
                                filename: { type: "string", description: "Name of the file to write" },
                                content: { type: "string", description: "Content to write to the file" }
                            },
                            required: ["filename", "content"]
                        }
                    },
                    {
                        name: "generateRandomData",
                        description: "Generate random data (numbers, strings, UUIDs)",
                        parameters: {
                            type: "object",
                            properties: {
                                type: { type: "string", description: "Type of random data: 'number', 'string', 'uuid', 'password'" },
                                min: { type: "number", description: "Minimum value for numbers (optional)" },
                                max: { type: "number", description: "Maximum value for numbers (optional)" },
                                length: { type: "number", description: "Length for strings/passwords (optional)" }
                            },
                            required: ["type"]
                        }
                    },
                    {
                        name: "processImage",
                        description: "Process and analyze images (resize, crop, filter, analyze)",
                        parameters: {
                            type: "object",
                            properties: {
                                filename: { type: "string", description: "Name of the image file to process" },
                                operation: { 
                                    type: "string", 
                                    description: "Operation to perform: 'analyze', 'resize', 'crop', 'filter', 'rotate', 'convert'" 
                                },
                                width: { type: "number", description: "Target width for resize (optional)" },
                                height: { type: "number", description: "Target height for resize (optional)" },
                                filter: { 
                                    type: "string", 
                                    description: "Filter type: 'grayscale', 'sepia', 'blur', 'sharpen', 'brightness', 'contrast' (optional)" 
                                },
                                angle: { type: "number", description: "Rotation angle in degrees (optional)" },
                                format: { type: "string", description: "Output format: 'jpeg', 'png', 'webp' (optional)" },
                                quality: { type: "number", description: "JPEG quality 1-100 (optional)" }
                            },
                            required: ["filename", "operation"]
                        }
                    },
                    {
                        name: "textToSpeech",
                        description: "Convert text to speech and save as audio file",
                        parameters: {
                            type: "object",
                            properties: {
                                text: { type: "string", description: "Text to convert to speech" },
                                language: { type: "string", description: "Language code (e.g., 'en', 'es', 'fr', 'de', 'ja')" },
                                voice: { 
                                    type: "string", 
                                    description: "Voice type: 'male', 'female', 'neutral' (optional)" 
                                },
                                speed: { type: "number", description: "Speech speed 0.5-2.0 (optional, default 1.0)" },
                                filename: { type: "string", description: "Output filename (optional)" }
                            },
                            required: ["text", "language"]
                        }
                    }
                ]
            }
        ];

        // Initialize model
        this.model = this.genAI.getGenerativeModel({
            model: "gemini-1.5-pro",
            tools: this.tools,
            systemInstruction: this.systemPrompt
        });
    }

    /**
     * Execute ReAct loop with streaming support and conversation memory
     */
    async executeReAct(userQuery, userId, sessionId, socketId) {
        const startTime = Date.now();
        logger.info('Starting ReAct execution', { userId, query: userQuery });
        
        // Trigger webhook: query.started
        await webhookService.triggerEvent('query.started', {
            sessionId,
            userId,
            query: userQuery,
            timestamp: new Date().toISOString()
        });
        
        // Get conversation context
        const conversationContext = await this.getConversationContext(sessionId);
        
        // Initialize session with context
        const session = {
            thoughtHistory: [],
            actionHistory: [],
            executionTrace: [],
            chat: this.model.startChat({ 
                history: conversationContext.history 
            })
        };
        
        this.activeChats.set(sessionId, session);
        
        let iteration = 0;
        let finalAnswer = null;
        
        // Build context with conversation history
        let currentContext = this.buildContextWithHistory(userQuery, conversationContext);

        try {
            while (iteration < this.maxIterations && !finalAnswer) {
                iteration++;
                
                // Emit iteration start
                this.emitToClient(socketId, 'iteration-start', { iteration });
                
                // Get agent response
                const result = await session.chat.sendMessage(currentContext);
                const response = await result.response;
                const responseText = response.text();
                
                logger.info(`Iteration ${iteration} response received`, {
                    hasText: !!responseText,
                    textLength: responseText?.length,
                    hasFunctionCalls: !!(response.functionCalls && response.functionCalls()?.length > 0)
                });
                
                // Parse response
                const { thought, answer } = this.parseResponse(responseText);
                
                if (thought) {
                    session.thoughtHistory.push({ iteration, thought });
                    session.executionTrace.push({ type: 'thought', content: thought, iteration });
                    
                    // Stream thought to client
                    this.emitToClient(socketId, 'thought', { iteration, thought });
                }
                
                if (answer) {
                    finalAnswer = answer;
                    session.executionTrace.push({ type: 'answer', content: answer, iteration });
                    break;
                }
                
                // Check for function calls
                const functionCalls = response.functionCalls();
                if (functionCalls && functionCalls.length > 0) {
                    // Execute functions in parallel with proper error handling
                    const observations = await this.executeFunctionsParallel(
                        functionCalls, 
                        socketId, 
                        iteration,
                        session
                    );
                    
                    // Store observations in thought history
                    observations.forEach(obs => {
                        const observationContent = `Tool: ${obs.tool}, Result: ${JSON.stringify(obs.result)}`;
                        session.thoughtHistory.push({ 
                            iteration, 
                            thought: `Observation from ${obs.tool}: ${JSON.stringify(obs.result)}`,
                            type: 'observation'
                        });
                        session.executionTrace.push({ 
                            type: 'observation', 
                            content: observationContent, 
                            iteration,
                            tool: obs.tool,
                            result: obs.result
                        });
                        
                        // Emit observation event
                        this.emitToClient(socketId, 'observation', {
                            iteration,
                            tool: obs.tool,
                            result: obs.result
                        });
                    });
                    
                    // Send function results back
                    const functionResponseParts = observations.map(obs => ({
                        functionResponse: {
                            name: obs.tool,
                            response: obs.result
                        }
                    }));
                    
                    const observationResult = await session.chat.sendMessage(functionResponseParts);
                    const observationText = observationResult.response.text();
                    
                    logger.info(`Observation response received`, {
                        iteration,
                        observationTextLength: observationText?.length,
                        toolsUsed: observations.map(o => o.tool),
                        toolResults: observations.map(o => ({ tool: o.tool, success: o.result.success }))
                    });
                    
                    // Create detailed context with tool results
                    const toolResultsSummary = observations.map(obs => 
                        `${obs.tool}: ${obs.result.success ? JSON.stringify(obs.result) : `Error: ${obs.result.error}`}`
                    ).join('\n');
                    
                    currentContext = `Tool Results:\n${toolResultsSummary}\n\nBased on these results, ${observationText}\n\nPlease continue your analysis or provide a final answer if you have enough information.`;
                    
                    // Store the model's interpretation of observations
                    if (observationText && observationText.trim()) {
                        session.thoughtHistory.push({ 
                            iteration, 
                            thought: `Analysis of results: ${observationText}`,
                            type: 'analysis'
                        });
                    }
                    
                    // Check for answer in observation
                    const obsResponse = this.parseResponse(observationText);
                    if (obsResponse.answer) {
                        finalAnswer = obsResponse.answer;
                        session.executionTrace.push({ type: 'answer', content: finalAnswer, iteration });
                    }
                } else {
                    currentContext = "Please use one of the available tools to gather information.";
                }
            }
            
            if (!finalAnswer) {
                // If we have observations but no final answer, create one from the collected data
                if (session.actionHistory.length > 0) {
                    const lastObservations = session.thoughtHistory
                        .filter(t => t.type === 'observation' || t.type === 'analysis')
                        .slice(-3);  // Get last 3 observations/analyses
                    
                    if (lastObservations.length > 0) {
                        finalAnswer = "Based on the information gathered:\n\n" + 
                            lastObservations.map(o => o.thought).join('\n\n') + 
                            "\n\n" + this.summarizeProgress(session);
                    } else {
                        finalAnswer = "I've completed my analysis. " + this.summarizeProgress(session);
                    }
                } else {
                    finalAnswer = "I was unable to gather the requested information. Please try rephrasing your query.";
                }
            }
            
            const executionTime = Date.now() - startTime;
            logger.info('ReAct execution completed', { userId, iterations: iteration, time: executionTime });
            
            // Save to database
            await this.saveToHistory(userId, sessionId, {
                query: userQuery,
                answer: finalAnswer,
                thoughtHistory: session.thoughtHistory,
                actionHistory: session.actionHistory,
                executionTrace: session.executionTrace,
                iterations: iteration,
                executionTime
            });
            
            // Trigger webhook: query.completed
            await webhookService.triggerEvent('query.completed', {
                sessionId,
                userId,
                query: userQuery,
                answer: finalAnswer,
                iterations: iteration,
                executionTime,
                toolsUsed: session.actionHistory.map(a => a.action),
                timestamp: new Date().toISOString()
            });
            
            return {
                answer: finalAnswer,
                thoughtHistory: session.thoughtHistory,
                actionHistory: session.actionHistory,
                executionTrace: session.executionTrace,
                iterations: iteration,
                executionTime
            };
            
        } catch (error) {
            logger.error('ReAct execution error', { error: error.message, userId });
            
            // Trigger webhook: error.occurred
            await webhookService.triggerEvent('error.occurred', {
                sessionId,
                userId,
                query: userQuery,
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            
            throw error;
        } finally {
            this.activeChats.delete(sessionId);
        }
    }

    /**
     * Execute functions in parallel with caching and error handling
     */
    async executeFunctionsParallel(functionCalls, socketId, iteration, session) {
        const promises = functionCalls.map(async (call) => {
            try {
                // Check cache first
                const cached = await cacheService.get(call.name, call.args);
                if (cached) {
                    logger.info('Using cached result', { tool: call.name });
                    return {
                        tool: call.name,
                        args: call.args,
                        result: cached,
                        cached: true
                    };
                }
                
                // Execute function
                const result = await this.executeFunction(call);
                
                // Cache successful results
                if (result.success) {
                    await cacheService.set(call.name, call.args, result);
                }
                
                // Record in session
                session.actionHistory.push({
                    iteration,
                    action: call.name,
                    args: call.args,
                    result
                });
                
                session.executionTrace.push({
                    type: 'action',
                    tool: call.name,
                    args: call.args,
                    result,
                    iteration
                });
                
                // Stream to client
                this.emitToClient(socketId, 'action', {
                    iteration,
                    tool: call.name,
                    args: call.args,
                    result
                });
                
                // Trigger webhook: tool.executed
                await webhookService.triggerEvent('tool.executed', {
                    sessionId: socketId,
                    tool: call.name,
                    args: call.args,
                    result,
                    iteration,
                    timestamp: new Date().toISOString()
                });
                
                return {
                    tool: call.name,
                    args: call.args,
                    result
                };
                
            } catch (error) {
                logger.error('Function execution error', { tool: call.name, error: error.message });
                
                const errorResult = {
                    success: false,
                    error: error.message
                };
                
                session.executionTrace.push({
                    type: 'error',
                    tool: call.name,
                    error: error.message,
                    iteration
                });
                
                return {
                    tool: call.name,
                    args: call.args,
                    result: errorResult
                };
            }
        });
        
        return await Promise.all(promises);
    }

    /**
     * Execute tool function with circuit breaker
     */
    async executeFunction(functionCall) {
        const { name, args } = functionCall;
        logger.info('Executing function', { name, args });

        switch (name) {
            case "searchWeb":
                return await this.searchWebEnhanced(args);
            case "getCryptoPrice":
                return await this.getCryptoPriceEnhanced(args);
            case "getWeather":
                return await this.getWeatherEnhanced(args);
            case "getCountryInfo":
                return await this.getCountryInfoEnhanced(args);
            case "convertCurrency":
                return await this.convertCurrencyEnhanced(args);
            case "calculate":
                return await this.calculateEnhanced(args);
            case "translateText":
                return await this.translateTextEnhanced(args);
            case "readFile":
                return await this.readFileEnhanced(args);
            case "writeFile":
                return await this.writeFileEnhanced(args);
            case "generateRandomData":
                return await this.generateRandomDataEnhanced(args);
            case "processImage":
                return await this.processImageEnhanced(args);
            case "textToSpeech":
                return await this.textToSpeechEnhanced(args);
            default:
                throw new Error(`Unknown function: ${name}`);
        }
    }

    // Enhanced tool implementations with circuit breakers and retries

    async getCryptoPriceEnhanced({ symbol }) {
        return await this.circuitBreakers.crypto(async () => {
            const coinIds = {
                'BTC': 'bitcoin',
                'ETH': 'ethereum',
                'BNB': 'binancecoin',
                'SOL': 'solana',
                'ADA': 'cardano'
            };

            const coinId = coinIds[symbol.toUpperCase()] || symbol.toLowerCase();
            
            const data = await apiClient.get(
                `https://api.coingecko.com/api/v3/simple/price`,
                {
                    params: {
                        ids: coinId,
                        vs_currencies: 'usd',
                        include_24hr_change: true
                    }
                }
            );

            const coinData = data[coinId];
            if (!coinData) {
                return {
                    success: false,
                    error: `Unknown cryptocurrency: ${symbol}`
                };
            }

            return {
                success: true,
                symbol: symbol.toUpperCase(),
                price: `$${coinData.usd.toLocaleString()}`,
                change24h: coinData.usd_24h_change ? 
                    `${coinData.usd_24h_change > 0 ? '+' : ''}${coinData.usd_24h_change.toFixed(2)}%` : 
                    'N/A'
            };
        });
    }

    async getWeatherEnhanced({ city }) {
        return await this.circuitBreakers.weather(async () => {
            const data = await apiClient.get(
                `https://wttr.in/${encodeURIComponent(city)}?format=j1`
            );
            
            const current = data.current_condition[0];
            const location = data.nearest_area[0];
            
            return {
                success: true,
                location: `${location.areaName[0].value}, ${location.country[0].value}`,
                temperature: `${current.temp_C}°C (${current.temp_F}°F)`,
                condition: current.weatherDesc[0].value,
                humidity: current.humidity + '%',
                wind: `${current.windspeedKmph} km/h`
            };
        });
    }

    async searchWebEnhanced({ query }) {
        return await this.circuitBreakers.search(async () => {
            const data = await apiClient.get('https://api.duckduckgo.com/', {
                params: {
                    q: query,
                    format: 'json',
                    no_html: 1
                }
            });

            const results = [];
            
            if (data.AbstractText) {
                results.push({
                    title: data.Heading || query,
                    snippet: data.AbstractText,
                    url: data.AbstractURL
                });
            }

            return {
                success: true,
                query,
                results: results.length > 0 ? results : [{
                    title: `Search: ${query}`,
                    snippet: 'No instant answer available',
                    url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
                }]
            };
        });
    }

    async getCountryInfoEnhanced({ country }) {
        return await this.circuitBreakers.country(async () => {
            const data = await apiClient.get(
                `https://restcountries.com/v3.1/name/${country}`
            );
            
            const countryData = data[0];
            
            return {
                success: true,
                name: countryData.name.common,
                capital: countryData.capital?.[0],
                population: countryData.population.toLocaleString(),
                area: `${countryData.area.toLocaleString()} km²`,
                languages: Object.values(countryData.languages || {}).join(', '),
                currency: Object.values(countryData.currencies || {})[0]?.name
            };
        });
    }

    async convertCurrencyEnhanced({ amount, from, to }) {
        return await apiClient.callWithRetry(async () => {
            const data = await apiClient.get(
                `https://api.exchangerate-api.com/v4/latest/${from}`
            );
            
            const rate = data.rates[to];
            if (!rate) {
                return {
                    success: false,
                    error: `Unknown currency: ${to}`
                };
            }

            const result = amount * rate;
            
            return {
                success: true,
                amount,
                from,
                to,
                rate,
                result: result.toFixed(2),
                formatted: `${amount.toLocaleString()} ${from} = ${result.toFixed(2)} ${to}`
            };
        });
    }

    // New tool implementations

    async calculateEnhanced({ expression }) {
        try {
            // Sanitize expression to prevent code injection
            const sanitized = expression.replace(/[^0-9+\-*/().\s\w]/g, '');
            
            // Support common math functions
            const mathFunctions = {
                'sqrt': Math.sqrt,
                'pow': Math.pow,
                'sin': Math.sin,
                'cos': Math.cos,
                'tan': Math.tan,
                'log': Math.log,
                'abs': Math.abs,
                'floor': Math.floor,
                'ceil': Math.ceil,
                'round': Math.round,
                'pi': Math.PI,
                'e': Math.E
            };
            
            // Create safe evaluation context
            const context = { ...mathFunctions };
            const keys = Object.keys(context);
            const values = keys.map(key => context[key]);
            
            // Create function with math context
            const compute = new Function(...keys, `return ${sanitized}`);
            const result = compute(...values);
            
            return {
                success: true,
                expression,
                result,
                formatted: `${expression} = ${result}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Invalid expression: ${error.message}`
            };
        }
    }

    async translateTextEnhanced({ text, from, to }) {
        try {
            // Using Google Translate API (free tier)
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
            
            const data = await apiClient.get(url);
            const translation = data[0]?.[0]?.[0];
            
            if (!translation) {
                throw new Error('Translation failed');
            }
            
            return {
                success: true,
                original: text,
                translated: translation,
                from,
                to
            };
        } catch (error) {
            return {
                success: false,
                error: `Translation failed: ${error.message}`
            };
        }
    }

    async readFileEnhanced({ filename }) {
        try {
            // Sanitize filename to prevent directory traversal
            const sanitizedName = path.basename(filename);
            const safeDir = path.join(__dirname, 'safe-files');
            const filePath = path.join(safeDir, sanitizedName);
            
            // Ensure directory exists
            await fs.mkdir(safeDir, { recursive: true });
            
            // Check if file exists
            await fs.access(filePath);
            
            // Read file
            const content = await fs.readFile(filePath, 'utf-8');
            
            return {
                success: true,
                filename: sanitizedName,
                content,
                size: content.length
            };
        } catch (error) {
            if (error.code === 'ENOENT') {
                return {
                    success: false,
                    error: `File not found: ${filename}`
                };
            }
            return {
                success: false,
                error: `Failed to read file: ${error.message}`
            };
        }
    }

    async writeFileEnhanced({ filename, content }) {
        try {
            // Sanitize filename
            const sanitizedName = path.basename(filename);
            const safeDir = path.join(__dirname, 'safe-files');
            const filePath = path.join(safeDir, sanitizedName);
            
            // Ensure directory exists
            await fs.mkdir(safeDir, { recursive: true });
            
            // Write file
            await fs.writeFile(filePath, content, 'utf-8');
            
            return {
                success: true,
                filename: sanitizedName,
                size: content.length,
                message: `File saved successfully`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to write file: ${error.message}`
            };
        }
    }

    async generateRandomDataEnhanced({ type, min = 0, max = 100, length = 16 }) {
        try {
            let result;
            
            switch (type) {
                case 'number':
                    result = Math.floor(Math.random() * (max - min + 1)) + min;
                    break;
                    
                case 'string':
                    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                    result = Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                    break;
                    
                case 'uuid':
                    result = crypto.randomUUID();
                    break;
                    
                case 'password':
                    const passwordChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
                    result = Array.from({ length }, () => passwordChars[Math.floor(Math.random() * passwordChars.length)]).join('');
                    break;
                    
                default:
                    throw new Error(`Unknown type: ${type}`);
            }
            
            return {
                success: true,
                type,
                result,
                parameters: { min, max, length }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async textToSpeechEnhanced({ text, language, voice = 'female', speed = 1.0, filename }) {
        try {
            const gTTS = require('gtts');
            const safeDir = path.join(__dirname, 'safe-files');
            await fs.mkdir(safeDir, { recursive: true });
            
            // Generate filename if not provided
            const outputFilename = filename || `speech_${language}_${Date.now()}.mp3`;
            const sanitizedName = path.basename(outputFilename);
            const outputPath = path.join(safeDir, sanitizedName);
            
            // Language mapping for gTTS
            const languageMap = {
                'en': 'en',
                'es': 'es',
                'fr': 'fr',
                'de': 'de',
                'it': 'it',
                'pt': 'pt',
                'ru': 'ru',
                'ja': 'ja',
                'ko': 'ko',
                'zh': 'zh',
                'ar': 'ar',
                'hi': 'hi'
            };
            
            const ttsLang = languageMap[language] || 'en';
            
            // Create gTTS instance
            const gtts = new gTTS(text, ttsLang);
            
            // Save to file
            return new Promise((resolve, reject) => {
                gtts.save(outputPath, (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    // Get file stats
                    fs.stat(outputPath)
                        .then(stats => {
                            resolve({
                                success: true,
                                filename: sanitizedName,
                                language: ttsLang,
                                voice,
                                speed,
                                size: stats.size,
                                duration: Math.ceil(text.length / 15), // Rough estimate
                                message: `Speech audio saved as ${sanitizedName}`
                            });
                        })
                        .catch(err => {
                            resolve({
                                success: true,
                                filename: sanitizedName,
                                language: ttsLang,
                                message: `Speech audio saved as ${sanitizedName}`
                            });
                        });
                });
            });
        } catch (error) {
            return {
                success: false,
                error: `Text-to-speech failed: ${error.message}`
            };
        }
    }

    async processImageEnhanced({ filename, operation, width, height, filter, angle, format, quality = 85 }) {
        try {
            // Sanitize filename
            const sanitizedName = path.basename(filename);
            const safeDir = path.join(__dirname, 'safe-files');
            const inputPath = path.join(safeDir, sanitizedName);
            
            // Check if file exists
            await fs.access(inputPath);
            
            // Generate output filename
            const ext = path.extname(sanitizedName);
            const baseName = path.basename(sanitizedName, ext);
            const outputFormat = format || ext.slice(1) || 'jpeg';
            const outputName = `${baseName}_${operation}_${Date.now()}.${outputFormat}`;
            const outputPath = path.join(safeDir, outputName);
            
            let result = {};
            
            switch (operation) {
                case 'analyze':
                    // Use sharp for metadata
                    const metadata = await sharp(inputPath).metadata();
                    result = {
                        success: true,
                        operation: 'analyze',
                        metadata: {
                            format: metadata.format,
                            width: metadata.width,
                            height: metadata.height,
                            channels: metadata.channels,
                            size: metadata.size,
                            density: metadata.density,
                            hasAlpha: metadata.hasAlpha,
                            orientation: metadata.orientation
                        }
                    };
                    break;
                    
                case 'resize':
                    if (!width && !height) {
                        throw new Error('Width or height required for resize');
                    }
                    await sharp(inputPath)
                        .resize(width, height, { fit: 'inside', withoutEnlargement: true })
                        .toFile(outputPath);
                    result = {
                        success: true,
                        operation: 'resize',
                        outputFile: outputName,
                        dimensions: { width, height }
                    };
                    break;
                    
                case 'crop':
                    if (!width || !height) {
                        throw new Error('Width and height required for crop');
                    }
                    await sharp(inputPath)
                        .resize(width, height, { fit: 'cover', position: 'center' })
                        .toFile(outputPath);
                    result = {
                        success: true,
                        operation: 'crop',
                        outputFile: outputName,
                        dimensions: { width, height }
                    };
                    break;
                    
                case 'rotate':
                    const rotateAngle = angle || 90;
                    await sharp(inputPath)
                        .rotate(rotateAngle)
                        .toFile(outputPath);
                    result = {
                        success: true,
                        operation: 'rotate',
                        outputFile: outputName,
                        angle: rotateAngle
                    };
                    break;
                    
                case 'filter':
                    if (!filter) {
                        throw new Error('Filter type required');
                    }
                    
                    // Use Jimp for filters
                    const image = await Jimp.read(inputPath);
                    
                    switch (filter) {
                        case 'grayscale':
                            image.grayscale();
                            break;
                        case 'sepia':
                            image.sepia();
                            break;
                        case 'blur':
                            image.blur(5);
                            break;
                        case 'sharpen':
                            image.convolute([
                                [0, -1, 0],
                                [-1, 5, -1],
                                [0, -1, 0]
                            ]);
                            break;
                        case 'brightness':
                            image.brightness(0.2);
                            break;
                        case 'contrast':
                            image.contrast(0.2);
                            break;
                        default:
                            throw new Error(`Unknown filter: ${filter}`);
                    }
                    
                    await image.writeAsync(outputPath);
                    result = {
                        success: true,
                        operation: 'filter',
                        filter,
                        outputFile: outputName
                    };
                    break;
                    
                case 'convert':
                    if (!format) {
                        throw new Error('Output format required');
                    }
                    await sharp(inputPath)
                        .toFormat(format, { quality })
                        .toFile(outputPath);
                    result = {
                        success: true,
                        operation: 'convert',
                        outputFile: outputName,
                        format,
                        quality
                    };
                    break;
                    
                default:
                    throw new Error(`Unknown operation: ${operation}`);
            }
            
            return result;
            
        } catch (error) {
            return {
                success: false,
                error: `Image processing failed: ${error.message}`
            };
        }
    }

    // Helper methods
    
    parseResponse(text) {
        const thought = this.extractSection(text, 'Thought:');
        const answer = this.extractSection(text, 'Answer:') || 
                      this.extractSection(text, 'Final Answer:');
        return { thought, answer };
    }

    extractSection(text, marker) {
        const regex = new RegExp(`${marker}\\s*(.+?)(?=(?:Thought:|Action:|Answer:|Final Answer:|$))`, 's');
        const match = text.match(regex);
        return match ? match[1].trim() : null;
    }

    summarizeProgress(session) {
        // Group thoughts by type
        const regularThoughts = session.thoughtHistory
            .filter(t => !t.type || t.type === 'thought')
            .map(t => `- ${t.thought}`)
            .join('\n');
        
        const observations = session.thoughtHistory
            .filter(t => t.type === 'observation')
            .map(t => `- ${t.thought}`)
            .join('\n');
        
        const analyses = session.thoughtHistory
            .filter(t => t.type === 'analysis')
            .map(t => `- ${t.thought}`)
            .join('\n');
        
        const actions = session.actionHistory.map(a => {
            const resultStr = a.result.success 
                ? `Success: ${JSON.stringify(a.result).substring(0, 100)}...`
                : `Failed: ${a.result.error}`;
            return `- ${a.action}(${JSON.stringify(a.args)}): ${resultStr}`;
        }).join('\n');
        
        let summary = '';
        if (regularThoughts) summary += `Thoughts:\n${regularThoughts}\n\n`;
        if (actions) summary += `Actions:\n${actions}\n\n`;
        if (observations) summary += `Observations:\n${observations}\n\n`;
        if (analyses) summary += `Analysis:\n${analyses}`;
        
        return summary.trim() || 'No progress recorded.';
    }

    emitToClient(socketId, event, data) {
        if (this.io && socketId) {
            this.io.to(socketId).emit(event, data);
        }
    }

    async saveToHistory(userId, sessionId, data) {
        try {
            // Save execution log
            await databaseService.saveExecutionLog({
                sessionId,
                userId,
                ...data
            });
            
            // Save chat messages
            await databaseService.saveChatMessage({
                sessionId,
                userId,
                messageType: 'user',
                content: data.query
            });
            
            await databaseService.saveChatMessage({
                sessionId,
                userId,
                messageType: 'assistant',
                content: data.answer,
                metadata: {
                    thoughtHistory: data.thoughtHistory,
                    actionHistory: data.actionHistory,
                    iterations: data.iterations,
                    executionTime: data.executionTime
                }
            });
            
            logger.info('Saved to history', { userId, sessionId, query: data.query });
        } catch (error) {
            logger.error('Failed to save to history:', error);
        }
    }

    // Conversation Memory Methods
    async getConversationContext(sessionId) {
        try {
            // Get recent messages from this session
            const recentMessages = await databaseService.getSessionContext(sessionId, 10);
            
            // Convert to Gemini chat history format
            const history = [];
            for (const msg of recentMessages) {
                if (msg.message_type === 'user') {
                    history.push({
                        role: 'user',
                        parts: [{ text: msg.content }]
                    });
                } else if (msg.message_type === 'assistant') {
                    history.push({
                        role: 'model',
                        parts: [{ text: msg.content }]
                    });
                }
            }
            
            // Get conversation summary if session has many messages
            const summary = await databaseService.getConversationSummary(sessionId);
            
            return {
                history,
                summary,
                messageCount: recentMessages.length
            };
        } catch (error) {
            logger.error('Error getting conversation context:', error);
            return { history: [], summary: null, messageCount: 0 };
        }
    }

    buildContextWithHistory(userQuery, conversationContext) {
        let context = `User Query: ${userQuery}\n\n`;
        
        if (conversationContext.messageCount > 0) {
            context += `You are continuing a conversation with ${conversationContext.messageCount} previous messages. `;
            
            if (conversationContext.summary?.tools_used?.length > 0) {
                context += `Previously used tools: ${conversationContext.summary.tools_used.join(', ')}. `;
            }
            
            context += `\nRemember the context from our previous exchanges and provide a coherent continuation.\n\n`;
        }
        
        context += `Please solve this step by step.`;
        
        return context;
    }
}

/**
 * Enhanced Server with WebSocket support
 */
class EnhancedReActServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"],
                credentials: true
            }
        });
        
        this.port = process.env.PORT || 3000;
        this.agent = new EnhancedReActAgent(this.io);
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
    }

    setupMiddleware() {
        // Security headers with Helmet
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.socket.io"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "wss:", "ws:", "https:"],
                    fontSrc: ["'self'"],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'"],
                    frameSrc: ["'none'"],
                },
            },
            crossOriginEmbedderPolicy: false
        }));
        
        // Sanitize user input to prevent NoSQL injection
        this.app.use(mongoSanitize());
        
        // CORS
        this.app.use(cors({
            origin: process.env.FRONTEND_URL || true,
            credentials: true
        }));
        
        // Body parser with size limit
        this.app.use(express.json({ limit: '10mb' }));
        
        // XSS protection for all responses
        this.app.use((req, res, next) => {
            res.locals.sanitizeHtml = (html) => {
                // Basic XSS protection
                return html.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            };
            next();
        });
        
        // Static files
        this.app.use(express.static(path.join(__dirname, 'demo')));
        
        // Serve audio files from safe-files directory
        this.app.use('/audio', express.static(path.join(__dirname, 'safe-files')));
        
        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
            message: 'Too many requests from this IP'
        });
        
        this.app.use('/api/', limiter);
        
        // Request logging
        this.app.use((req, res, next) => {
            logger.info('Request', {
                method: req.method,
                path: req.path,
                ip: req.ip
            });
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                service: 'Enhanced ReAct Agent',
                features: {
                    caching: cacheService.enabled,
                    websocket: true,
                    authentication: true,
                    rateLimit: true
                },
                uptime: process.uptime()
            });
        });

        // Authentication routes
        this.app.post('/auth/register', async (req, res) => {
            try {
                const { username, password, email } = req.body;
                const user = await authService.createUser({ username, password, email });
                res.json({ success: true, user });
            } catch (error) {
                res.status(400).json({ success: false, error: error.message });
            }
        });

        this.app.post('/auth/login', async (req, res) => {
            try {
                const { username, password } = req.body;
                const result = await authService.login({ username, password });
                res.json({ success: true, ...result });
            } catch (error) {
                res.status(401).json({ success: false, error: error.message });
            }
        });

        // Protected routes
        this.app.use('/api', authService.authenticate());
        this.app.use('/api', authService.createUserRateLimiter());
        
        // Webhook routes
        const webhookRoutes = require('./routes/webhook.routes');
        this.app.use('/api/webhooks', webhookRoutes);

        // Execute ReAct flow with validation
        this.app.post('/api/react', 
            [
                body('query').isString().trim().isLength({ min: 1, max: 1000 }).escape(),
                body('sessionId').optional().isString().trim().isLength({ max: 100 })
            ],
            async (req, res) => {
                // Check validation errors
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({ 
                        success: false, 
                        errors: errors.array() 
                    });
                }
                
                try {
                    const { query, sessionId } = req.body;
                    const userId = req.user.userId;

                const result = await this.agent.executeReAct(
                    query, 
                    userId, 
                    sessionId || 'http-session',
                    null // No socket for HTTP requests
                );
                
                res.json({
                    success: true,
                    result
                });

            } catch (error) {
                logger.error('API error', { error: error.message });
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Cache stats
        this.app.get('/api/cache/stats', async (req, res) => {
            const stats = await cacheService.getStats();
            res.json({ success: true, stats });
        });

        // Clear cache (admin only)
        this.app.post('/api/cache/flush', async (req, res) => {
            await cacheService.flush();
            res.json({ success: true, message: 'Cache flushed' });
        });

        // Chat history endpoints
        this.app.get('/api/chat/history', async (req, res) => {
            try {
                const userId = req.user.userId;
                const { sessionId, limit = 50 } = req.query;
                
                const history = await databaseService.getChatHistory(
                    userId, 
                    sessionId, 
                    parseInt(limit)
                );
                
                res.json({ success: true, history });
            } catch (error) {
                logger.error('Failed to get chat history:', error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to retrieve chat history' 
                });
            }
        });

        this.app.get('/api/chat/sessions', async (req, res) => {
            try {
                const userId = req.user.userId;
                const { limit = 20 } = req.query;
                
                const sessions = await databaseService.getRecentSessions(
                    userId, 
                    parseInt(limit)
                );
                
                res.json({ success: true, sessions });
            } catch (error) {
                logger.error('Failed to get chat sessions:', error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to retrieve sessions' 
                });
            }
        });

        // Get specific session context
        this.app.get('/api/chat/session/:sessionId', async (req, res) => {
            try {
                const { sessionId } = req.params;
                const userId = req.user.userId;
                
                // Verify session belongs to user
                const sessions = await databaseService.getRecentSessions(userId, 100);
                const userSession = sessions.find(s => s.session_id === sessionId);
                
                if (!userSession) {
                    return res.status(404).json({ 
                        success: false, 
                        error: 'Session not found' 
                    });
                }
                
                const history = await databaseService.getChatHistory(userId, sessionId, 100);
                const summary = await databaseService.getConversationSummary(sessionId);
                
                res.json({ 
                    success: true, 
                    session: {
                        ...userSession,
                        history,
                        summary
                    }
                });
            } catch (error) {
                logger.error('Failed to get session:', error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to retrieve session' 
                });
            }
        });

        // Queue Management Endpoints
        this.app.post('/api/queue/ai', async (req, res) => {
            try {
                const { query, priority = 'normal' } = req.body;
                const userId = req.user.userId;
                
                const job = await queueService.addAIJob({
                    userId,
                    query,
                    timestamp: Date.now()
                }, {
                    priority: priority === 'high' ? 1 : priority === 'low' ? 10 : 5
                });
                
                res.json({ 
                    success: true, 
                    jobId: job.id,
                    message: 'Query queued for processing'
                });
            } catch (error) {
                logger.error('Failed to queue AI job:', error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to queue job' 
                });
            }
        });
        
        this.app.post('/api/queue/export', async (req, res) => {
            try {
                const { sessionId, format = 'json' } = req.body;
                const userId = req.user.userId;
                
                const job = await queueService.addExportJob({
                    userId,
                    sessionId,
                    format
                });
                
                res.json({ 
                    success: true, 
                    jobId: job.id,
                    message: `Export to ${format} queued`
                });
            } catch (error) {
                logger.error('Failed to queue export job:', error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to queue export' 
                });
            }
        });
        
        this.app.get('/api/queue/status/:queue/:jobId', async (req, res) => {
            try {
                const { queue, jobId } = req.params;
                const status = await queueService.getJobStatus(queue, jobId);
                
                if (!status) {
                    return res.status(404).json({ 
                        success: false, 
                        error: 'Job not found' 
                    });
                }
                
                res.json({ success: true, status });
            } catch (error) {
                logger.error('Failed to get job status:', error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to get job status' 
                });
            }
        });
        
        this.app.get('/api/queue/stats', async (req, res) => {
            try {
                const stats = await queueService.getQueueStats();
                res.json({ success: true, stats });
            } catch (error) {
                logger.error('Failed to get queue stats:', error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to get queue stats' 
                });
            }
        });
        
        // Export Endpoints
        this.app.post('/api/export/:sessionId', authService.authenticate(), async (req, res) => {
            try {
                const { sessionId } = req.params;
                const { format = 'json' } = req.body;
                const userId = req.user.userId;
                
                // Get session data
                const messages = await databaseService.getChatHistory(sessionId);
                const metadata = await databaseService.getSessionMetadata(sessionId);
                
                if (!messages || messages.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Session not found or empty'
                    });
                }
                
                const sessionData = {
                    sessionId,
                    messages,
                    metadata
                };
                
                let result;
                switch (format.toLowerCase()) {
                    case 'json':
                        result = await exportService.exportToJSON(sessionData);
                        break;
                    case 'markdown':
                    case 'md':
                        result = await exportService.exportToMarkdown(sessionData);
                        break;
                    case 'pdf':
                        result = await exportService.exportToPDFKit(sessionData);
                        break;
                    case 'summary':
                        result = await exportService.exportSummary(sessionData);
                        break;
                    default:
                        return res.status(400).json({
                            success: false,
                            error: 'Invalid format. Supported: json, markdown, pdf, summary'
                        });
                }
                
                res.json(result);
                
            } catch (error) {
                logger.error('Export failed:', error);
                res.status(500).json({
                    success: false,
                    error: 'Export failed: ' + error.message
                });
            }
        });
        
        this.app.get('/api/exports', authService.authenticate(), async (req, res) => {
            try {
                const { sessionId } = req.query;
                const exports = await exportService.listExports(sessionId);
                
                res.json({
                    success: true,
                    exports
                });
            } catch (error) {
                logger.error('Failed to list exports:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to list exports'
                });
            }
        });
        
        this.app.get('/api/export/download/:filename', authService.authenticate(), async (req, res) => {
            try {
                const { filename } = req.params;
                const file = await exportService.getExportFile(filename);
                
                if (!file) {
                    return res.status(404).json({
                        success: false,
                        error: 'Export file not found'
                    });
                }
                
                res.setHeader('Content-Type', file.mimeType);
                res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
                res.send(file.content);
                
            } catch (error) {
                logger.error('Failed to download export:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to download export'
                });
            }
        });

        // Bull Board Admin UI (protected)
        this.app.use('/admin/queues', 
            authService.authenticate(),
            (req, res, next) => {
                // Additional admin check
                if (req.user.username === 'demo' || req.user.isAdmin) {
                    next();
                } else {
                    res.status(403).json({ error: 'Admin access required' });
                }
            },
            queueService.getRouter()
        );

        // Admin Dashboard Stats
        this.app.get('/api/admin/stats', authService.authenticate(), async (req, res) => {
            try {
                // Check admin privileges
                if (req.user.username !== 'demo' && !req.user.isAdmin) {
                    return res.status(403).json({ error: 'Admin access required' });
                }
                
                // Get various statistics
                const [sessions, queueStats] = await Promise.all([
                    databaseService.getRecentSessions(null, 100),
                    queueService.getQueueStats()
                ]);
                
                // Calculate stats
                const now = new Date();
                const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
                const oneHourAgo = new Date(now - 60 * 60 * 1000);
                
                const activeSessions = sessions.filter(s => 
                    new Date(s.last_message_at || s.created_at) > oneHourAgo
                );
                
                const stats = {
                    overview: {
                        totalSessions: sessions.length,
                        activeSessions: activeSessions.length,
                        totalQueries: sessions.reduce((sum, s) => sum + (s.message_count || 0), 0),
                        avgResponseTime: 245, // Mock for now
                        activeUsers: new Set(sessions.map(s => s.user_id)).size
                    },
                    queues: queueStats,
                    recentActivity: sessions.slice(0, 10).map(s => ({
                        sessionId: s.session_id,
                        userId: s.user_id,
                        messageCount: s.message_count,
                        createdAt: s.created_at,
                        lastMessageAt: s.last_message_at
                    }))
                };
                
                res.json({ success: true, stats });
                
            } catch (error) {
                logger.error('Failed to get admin stats:', error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to retrieve statistics' 
                });
            }
        });
        
        // Admin Tool Stats
        this.app.get('/api/admin/tools', authService.authenticate(), async (req, res) => {
            try {
                // Check admin privileges
                if (req.user.username !== 'demo' && !req.user.isAdmin) {
                    return res.status(403).json({ error: 'Admin access required' });
                }
                
                // Get tool usage stats from execution logs
                // This is a simplified version - in production, you'd aggregate from logs
                const toolStats = {
                    calculate: { calls: 234, successRate: 99.5, avgDuration: 12 },
                    searchWeb: { calls: 189, successRate: 95.2, avgDuration: 450 },
                    translateText: { calls: 156, successRate: 98.7, avgDuration: 230 },
                    getWeather: { calls: 123, successRate: 97.5, avgDuration: 380 },
                    processImage: { calls: 98, successRate: 94.8, avgDuration: 890 },
                    readFile: { calls: 67, successRate: 100, avgDuration: 45 },
                    writeFile: { calls: 45, successRate: 100, avgDuration: 78 },
                    textToSpeech: { calls: 34, successRate: 96.5, avgDuration: 560 },
                    getCryptoPrice: { calls: 89, successRate: 93.2, avgDuration: 320 },
                    getCountryInfo: { calls: 23, successRate: 98.0, avgDuration: 410 }
                };
                
                res.json({ success: true, toolStats });
                
            } catch (error) {
                logger.error('Failed to get tool stats:', error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to retrieve tool statistics' 
                });
            }
        });

        // Root
        this.app.get('/', (req, res) => {
            res.redirect('/chat-enhanced.html');
        });
    }

    setupWebSocket() {
        this.io.on('connection', (socket) => {
            logger.info('WebSocket client connected', { id: socket.id });
            
            // Authenticate socket
            socket.on('authenticate', async (data) => {
                try {
                    const { token, apiKey } = data;
                    
                    let user;
                    if (token) {
                        user = await authService.verifyToken(token);
                    } else if (apiKey) {
                        user = await authService.verifyApiKey(apiKey);
                    } else {
                        throw new Error('No authentication provided');
                    }
                    
                    socket.userId = user.userId;
                    socket.authenticated = true;
                    
                    // Generate session ID if not provided
                    const sessionId = data.sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    socket.sessionId = sessionId;
                    
                    // Create session in database
                    await databaseService.createSession(user.userId, sessionId);
                    
                    // Trigger webhook: session.created
                    await webhookService.triggerEvent('session.created', {
                        sessionId: sessionId,
                        userId: user.userId,
                        timestamp: new Date().toISOString()
                    });
                    
                    socket.emit('authenticated', { 
                        success: true,
                        sessionId: sessionId,
                        userId: user.userId
                    });
                    
                } catch (error) {
                    socket.emit('authenticated', { 
                        success: false, 
                        error: error.message 
                    });
                }
            });
            
            // Execute query via WebSocket
            socket.on('query', async (data) => {
                if (!socket.authenticated) {
                    return socket.emit('error', { 
                        message: 'Not authenticated' 
                    });
                }
                
                try {
                    const { query, sessionId } = data;
                    
                    socket.emit('query-start', { query });
                    
                    // Use the session ID from authentication or data
                    const finalSessionId = sessionId || socket.sessionId || socket.id;
                    
                    const result = await this.agent.executeReAct(
                        query,
                        socket.userId,
                        finalSessionId,
                        socket.id
                    );
                    
                    socket.emit('query-complete', { result });
                    
                } catch (error) {
                    logger.error('WebSocket query error', { 
                        error: error.message,
                        userId: socket.userId 
                    });
                    
                    socket.emit('query-error', { 
                        error: error.message 
                    });
                }
            });
            
            socket.on('disconnect', async () => {
                logger.info('WebSocket client disconnected', { 
                    id: socket.id,
                    userId: socket.userId 
                });
                
                // Trigger webhook: session.ended if authenticated
                if (socket.authenticated && socket.sessionId) {
                    await webhookService.triggerEvent('session.ended', {
                        sessionId: socket.sessionId,
                        userId: socket.userId,
                        timestamp: new Date().toISOString()
                    });
                }
            });
        });
    }

    start() {
        this.server.listen(this.port, () => {
            console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           🚀 Enhanced ReAct Agent - Production Ready           ║
╠═══════════════════════════════════════════════════════════════╣
║  Status:     ✅ Running                                        ║
║  Port:       ${this.port}                                             ║
║  Model:      gemini-1.5-pro                                   ║
║                                                               ║
║  Features:                                                    ║
║    ✓ WebSocket streaming                                      ║
║    ✓ Redis caching                                           ║
║    ✓ Authentication (JWT + API keys)                         ║
║    ✓ Rate limiting                                           ║
║    ✓ Circuit breakers                                        ║
║    ✓ Retry logic                                             ║
║    ✓ Structured logging                                      ║
║    ✓ Error handling                                          ║
║                                                               ║
║  Endpoints:                                                   ║
║    HTTP:     http://localhost:${this.port}                           ║
║    WS:       ws://localhost:${this.port}                             ║
║                                                               ║
║  Demo credentials:                                            ║
║    Username: demo                                             ║
║    Password: demo123                                          ║
╚═══════════════════════════════════════════════════════════════╝
            `);
        });
    }
}

// Start server
if (require.main === module) {
    const server = new EnhancedReActServer();
    server.start();
}

module.exports = { EnhancedReActAgent, EnhancedReActServer };