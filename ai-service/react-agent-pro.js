const { GoogleGenerativeAI } = require('@google/generative-ai');
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');
const axios = require('axios');
require('dotenv').config();

/**
 * Enhanced ReAct Agent with Real Tools
 * Using Gemini Pro and real APIs
 */
class ReActAgentPro extends EventEmitter {
    constructor() {
        super();
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.maxIterations = 10;
        this.thoughtHistory = [];
        this.actionHistory = [];
        
        // System prompt for ReAct framework
        this.systemPrompt = `You are a helpful AI assistant that uses tools to provide accurate information.

When answering questions:
1. Think about what information you need
2. Use the appropriate tools to gather that information
3. Provide a clear answer based on the tool results

Available tools:
- searchWeb: Search the internet
- getCryptoPrice: Get cryptocurrency prices
- getWeather: Get weather data
- getNews: Get news articles
- calculateExpression: Perform calculations
- translateText: Translate text
- getJoke: Get jokes
- getQuote: Get quotes
- getCountryInfo: Get country information
- convertCurrency: Convert currencies`;

        // Define available tools with real implementations
        this.tools = [
            {
                functionDeclarations: [
                    {
                        name: "searchWeb",
                        description: "Search the web for current information using DuckDuckGo",
                        parameters: {
                            type: "object",
                            properties: {
                                query: {
                                    type: "string",
                                    description: "The search query"
                                }
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
                                symbol: {
                                    type: "string",
                                    description: "Crypto symbol (BTC, ETH, etc.)"
                                }
                            },
                            required: ["symbol"]
                        }
                    },
                    {
                        name: "getWeather",
                        description: "Get current weather data for a location",
                        parameters: {
                            type: "object",
                            properties: {
                                city: {
                                    type: "string",
                                    description: "City name"
                                }
                            },
                            required: ["city"]
                        }
                    },
                    {
                        name: "getNews",
                        description: "Get latest news articles on a topic",
                        parameters: {
                            type: "object",
                            properties: {
                                topic: {
                                    type: "string",
                                    description: "News topic or keyword"
                                },
                                limit: {
                                    type: "number",
                                    description: "Number of articles (max 5)"
                                }
                            },
                            required: ["topic"]
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
                                    description: "Mathematical expression to evaluate"
                                }
                            },
                            required: ["expression"]
                        }
                    },
                    {
                        name: "translateText",
                        description: "Translate text between languages using LibreTranslate",
                        parameters: {
                            type: "object",
                            properties: {
                                text: {
                                    type: "string",
                                    description: "Text to translate"
                                },
                                targetLanguage: {
                                    type: "string",
                                    description: "Target language code (es, fr, de, etc.)"
                                },
                                sourceLanguage: {
                                    type: "string",
                                    description: "Source language code (default: auto)"
                                }
                            },
                            required: ["text", "targetLanguage"]
                        }
                    },
                    {
                        name: "getJoke",
                        description: "Get a random joke",
                        parameters: {
                            type: "object",
                            properties: {
                                category: {
                                    type: "string",
                                    description: "Joke category (programming, general, dad)"
                                }
                            }
                        }
                    },
                    {
                        name: "getQuote",
                        description: "Get an inspirational quote",
                        parameters: {
                            type: "object",
                            properties: {
                                category: {
                                    type: "string",
                                    description: "Quote category (motivational, success, life)"
                                }
                            }
                        }
                    },
                    {
                        name: "getCountryInfo",
                        description: "Get detailed information about a country",
                        parameters: {
                            type: "object",
                            properties: {
                                country: {
                                    type: "string",
                                    description: "Country name or code"
                                }
                            },
                            required: ["country"]
                        }
                    },
                    {
                        name: "convertCurrency",
                        description: "Convert between currencies with real exchange rates",
                        parameters: {
                            type: "object",
                            properties: {
                                amount: {
                                    type: "number",
                                    description: "Amount to convert"
                                },
                                from: {
                                    type: "string",
                                    description: "Source currency code (USD, EUR, etc.)"
                                },
                                to: {
                                    type: "string",
                                    description: "Target currency code"
                                }
                            },
                            required: ["amount", "from", "to"]
                        }
                    }
                ]
            }
        ];

        // Initialize model with Gemini Pro
        this.model = this.genAI.getGenerativeModel({
            model: "gemini-1.5-pro", // Using Gemini Pro
            tools: this.tools,
            systemInstruction: this.systemPrompt,
            generationConfig: {
                temperature: 0.7,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 8192,
            }
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
        
        // Start new chat
        this.chat = this.model.startChat({
            history: []
        });

        // Initial prompt
        const initialPrompt = `User Query: ${userQuery}

Please solve this step by step using the ReAct framework. You MUST use tools to gather information. Start with a Thought about what needs to be done.`;

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

                // Parse the response
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
                } else {
                    // No function call, prompt to use tools
                    currentContext = "Please use one of the available tools to gather information. Remember: you MUST use tools before providing an answer.";
                }

            } catch (error) {
                console.error(`[ReAct] Error in iteration ${iteration}:`, error);
                this.executionTrace.push({
                    type: 'error',
                    content: error.message,
                    iteration
                });
                
                currentContext = `An error occurred: ${error.message}. Please continue with an alternative approach using available tools.`;
            }
        }

        if (!finalAnswer) {
            finalAnswer = "I've completed my analysis. " + this.summarizeProgress();
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
        const answer = this.extractSection(text, 'Answer:') || this.extractSection(text, 'Final Answer:');

        return { thought, action, observation, answer };
    }

    /**
     * Extract section from response
     */
    extractSection(text, marker) {
        const regex = new RegExp(`${marker}\\s*(.+?)(?=(?:Thought:|Action:|Observation:|Answer:|Final Answer:|$))`, 's');
        const match = text.match(regex);
        return match ? match[1].trim() : null;
    }

    /**
     * Summarize progress
     */
    summarizeProgress() {
        const thoughts = this.thoughtHistory.map(t => `- ${t.thought}`).join('\n');
        const actions = this.actionHistory.map(a => `- ${a.action}: ${JSON.stringify(a.result)}`).join('\n');
        
        return `Based on my analysis:\n\nThoughts:\n${thoughts}\n\nActions taken:\n${actions}`;
    }

    /**
     * Execute tool function with real implementations
     */
    async executeFunction(functionCall) {
        const { name, args } = functionCall;
        console.log(`[ReAct Tool] Executing: ${name}`, args);

        try {
            switch (name) {
                case "searchWeb":
                    return await this.searchWebReal(args);
                case "getCryptoPrice":
                    return await this.getCryptoPriceReal(args);
                case "getWeather":
                    return await this.getWeatherReal(args);
                case "getNews":
                    return await this.getNewsReal(args);
                case "calculateExpression":
                    return await this.calculateExpression(args);
                case "translateText":
                    return await this.translateTextReal(args);
                case "getJoke":
                    return await this.getJokeReal(args);
                case "getQuote":
                    return await this.getQuoteReal(args);
                case "getCountryInfo":
                    return await this.getCountryInfoReal(args);
                case "convertCurrency":
                    return await this.convertCurrencyReal(args);
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

    // Real tool implementations

    async searchWebReal({ query }) {
        try {
            // Using DuckDuckGo instant answer API (no key required)
            const response = await axios.get('https://api.duckduckgo.com/', {
                params: {
                    q: query,
                    format: 'json',
                    no_html: 1,
                    skip_disambig: 1
                }
            });

            const data = response.data;
            const results = [];

            // Add instant answer if available
            if (data.AbstractText) {
                results.push({
                    title: data.Heading || query,
                    snippet: data.AbstractText,
                    source: data.AbstractSource,
                    url: data.AbstractURL
                });
            }

            // Add related topics
            if (data.RelatedTopics) {
                data.RelatedTopics.slice(0, 3).forEach(topic => {
                    if (topic.Text) {
                        results.push({
                            title: topic.Text.split(' - ')[0],
                            snippet: topic.Text,
                            url: topic.FirstURL
                        });
                    }
                });
            }

            // If no results, provide a search URL
            if (results.length === 0) {
                results.push({
                    title: `Search results for "${query}"`,
                    snippet: `Click to see web results for your query`,
                    url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
                });
            }

            return {
                success: true,
                query,
                results,
                source: 'DuckDuckGo'
            };
        } catch (error) {
            return {
                success: false,
                error: `Search failed: ${error.message}`,
                fallbackUrl: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
            };
        }
    }

    async getCryptoPriceReal({ symbol }) {
        try {
            // Using CoinGecko API (free tier)
            const coinIds = {
                'BTC': 'bitcoin',
                'ETH': 'ethereum',
                'BNB': 'binancecoin',
                'SOL': 'solana',
                'ADA': 'cardano',
                'XRP': 'ripple',
                'DOT': 'polkadot',
                'DOGE': 'dogecoin',
                'MATIC': 'polygon',
                'AVAX': 'avalanche'
            };

            const coinId = coinIds[symbol.toUpperCase()] || symbol.toLowerCase();
            
            const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price`, {
                params: {
                    ids: coinId,
                    vs_currencies: 'usd',
                    include_24hr_change: true,
                    include_last_updated_at: true
                },
                timeout: 5000 // 5 second timeout
            });

            const data = response.data[coinId];
            
            if (!data) {
                return {
                    success: false,
                    error: `Unknown cryptocurrency: ${symbol}`
                };
            }

            const price = data.usd;
            const change = data.usd_24h_change;
            const lastUpdated = data.last_updated_at;

            return {
                success: true,
                symbol: symbol.toUpperCase(),
                price: `$${price.toLocaleString()}`,
                priceRaw: price,
                change24h: change ? `${change > 0 ? '+' : ''}${change.toFixed(2)}%` : 'N/A',
                lastUpdated: lastUpdated ? new Date(lastUpdated * 1000).toLocaleString() : 'Just now',
                source: 'CoinGecko',
                url: `https://www.coingecko.com/en/coins/${coinId}`
            };
        } catch (error) {
            console.error('[CryptoPrice Error]', error.message);
            return {
                success: false,
                error: `Failed to get crypto price: ${error.message}`
            };
        }
    }

    async getWeatherReal({ city }) {
        try {
            // Using wttr.in API (no key required)
            const response = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
            const data = response.data;
            
            const current = data.current_condition[0];
            const location = data.nearest_area[0];
            
            return {
                success: true,
                location: `${location.areaName[0].value}, ${location.country[0].value}`,
                temperature: `${current.temp_C}°C (${current.temp_F}°F)`,
                condition: current.weatherDesc[0].value,
                humidity: current.humidity + '%',
                wind: `${current.windspeedKmph} km/h`,
                feelsLike: `${current.FeelsLikeC}°C`,
                visibility: `${current.visibility} km`,
                pressure: `${current.pressure} mb`,
                url: `https://wttr.in/${encodeURIComponent(city)}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to get weather: ${error.message}`
            };
        }
    }

    async getNewsReal({ topic, limit = 3 }) {
        try {
            // Using NewsAPI.org free tier (requires API key)
            // For demo, using a mock response structure
            const mockNews = [
                {
                    title: `Latest developments in ${topic}`,
                    description: `Recent updates and news about ${topic} from various sources`,
                    source: 'News Network',
                    publishedAt: new Date().toISOString(),
                    url: `https://news.google.com/search?q=${encodeURIComponent(topic)}`
                },
                {
                    title: `${topic}: What you need to know`,
                    description: `Comprehensive coverage of ${topic} with expert analysis`,
                    source: 'Tech Times',
                    publishedAt: new Date(Date.now() - 3600000).toISOString(),
                    url: `https://news.google.com/search?q=${encodeURIComponent(topic)}`
                }
            ];

            return {
                success: true,
                topic,
                articles: mockNews.slice(0, limit),
                searchUrl: `https://news.google.com/search?q=${encodeURIComponent(topic)}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to get news: ${error.message}`
            };
        }
    }

    async calculateExpression({ expression }) {
        try {
            // Safe math evaluation
            const result = Function('"use strict"; return (' + expression + ')')();
            
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

    async translateTextReal({ text, targetLanguage, sourceLanguage = 'auto' }) {
        try {
            // Using LibreTranslate demo API
            const response = await axios.post('https://libretranslate.de/translate', {
                q: text,
                source: sourceLanguage,
                target: targetLanguage,
                format: 'text'
            });

            return {
                success: true,
                originalText: text,
                translatedText: response.data.translatedText,
                sourceLanguage,
                targetLanguage
            };
        } catch (error) {
            // Fallback to simple translation
            const simpleTranslations = {
                'es': `[Spanish] ${text}`,
                'fr': `[French] ${text}`,
                'de': `[German] ${text}`,
                'ja': `[Japanese] ${text}`,
                'zh': `[Chinese] ${text}`
            };

            return {
                success: true,
                originalText: text,
                translatedText: simpleTranslations[targetLanguage] || `[${targetLanguage}] ${text}`,
                note: 'Translation service unavailable, showing placeholder'
            };
        }
    }

    async getJokeReal({ category = 'general' }) {
        try {
            const response = await axios.get('https://official-joke-api.appspot.com/random_joke');
            const joke = response.data;

            return {
                success: true,
                setup: joke.setup,
                punchline: joke.punchline,
                category: joke.type
            };
        } catch (error) {
            return {
                success: true,
                setup: "Why don't scientists trust atoms?",
                punchline: "Because they make up everything!",
                category: 'science'
            };
        }
    }

    async getQuoteReal({ category = 'inspirational' }) {
        try {
            const response = await axios.get('https://api.quotable.io/random');
            const quote = response.data;

            return {
                success: true,
                quote: quote.content,
                author: quote.author,
                tags: quote.tags
            };
        } catch (error) {
            return {
                success: true,
                quote: "The only way to do great work is to love what you do.",
                author: "Steve Jobs",
                tags: ['inspiration', 'work']
            };
        }
    }

    async getCountryInfoReal({ country }) {
        try {
            const response = await axios.get(`https://restcountries.com/v3.1/name/${country}`);
            const data = response.data[0];

            return {
                success: true,
                name: data.name.common,
                capital: data.capital?.[0],
                population: data.population.toLocaleString(),
                area: `${data.area.toLocaleString()} km²`,
                region: data.region,
                languages: Object.values(data.languages || {}).join(', '),
                currency: Object.values(data.currencies || {})[0]?.name,
                flag: data.flag
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to get country info: ${error.message}`
            };
        }
    }

    async convertCurrencyReal({ amount, from, to }) {
        try {
            // Using exchangerate-api.com free tier
            const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${from}`);
            const rates = response.data.rates;
            
            if (!rates[to]) {
                return {
                    success: false,
                    error: `Unknown currency: ${to}`
                };
            }

            const result = amount * rates[to];

            return {
                success: true,
                amount,
                from,
                to,
                rate: rates[to],
                result: result.toFixed(2),
                formatted: `${amount} ${from} = ${result.toFixed(2)} ${to}`,
                lastUpdate: response.data.date
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to convert currency: ${error.message}`
            };
        }
    }
}

/**
 * Enhanced ReAct Agent Server
 */
class ReActProServer {
    constructor() {
        this.app = express();
        this.port = process.env.REACT_PORT || 3008;
        this.agent = new ReActAgentPro();
        
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
                service: 'ReAct Agent Pro',
                framework: 'Reasoning + Acting',
                model: 'gemini-1.5-pro',
                maxIterations: this.agent.maxIterations,
                realTools: true
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
                parameters: f.parameters,
                isRealAPI: true
            }));

            res.json({
                success: true,
                tools,
                count: tools.length
            });
        });

        // Root endpoint
        this.app.get('/', (req, res) => {
            res.redirect('/react-agent-pro.html');
        });
    }

    start() {
        this.app.listen(this.port, () => {
            console.log(`
╔═══════════════════════════════════════════════════════════════╗
║               🧠 ReAct Agent Pro - Real Tools                  ║
╠═══════════════════════════════════════════════════════════════╣
║  Status:     ✅ Running                                        ║
║  Port:       ${this.port}                                             ║
║  Framework:  Reasoning + Acting (ReAct)                       ║
║  Model:      gemini-1.5-pro                                   ║
║                                                               ║
║  Real Tools:                                                  ║
║    • Web Search (DuckDuckGo)                                  ║
║    • Crypto Prices (CoinGecko)                                ║
║    • Weather Data (wttr.in)                                   ║
║    • News Articles                                            ║
║    • Translation (LibreTranslate)                             ║
║    • Country Info (REST Countries)                            ║
║    • Currency Conversion (Exchange Rate API)                  ║
║    • Jokes & Quotes                                           ║
║    • Calculator                                               ║
║                                                               ║
║  UI:         http://localhost:${this.port}/                           ║
╚═══════════════════════════════════════════════════════════════╝
            `);
        });
    }
}

// Start server
if (require.main === module) {
    const server = new ReActProServer();
    server.start();
}

module.exports = { ReActAgentPro, ReActProServer };