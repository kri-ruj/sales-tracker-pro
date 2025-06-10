const swaggerUi = require('swagger-ui-express');
const { swaggerSpec, swaggerUiOptions } = require('../api-docs/swagger-config');

/**
 * Swagger middleware setup
 * Adds interactive API documentation to the server
 */
class SwaggerMiddleware {
    /**
     * Setup Swagger UI middleware
     * @param {Express} app - Express application
     * @param {string} basePath - Base path for API docs (default: /api-docs)
     */
    static setup(app, basePath = '/api-docs') {
        // Serve Swagger UI
        app.use(
            basePath,
            swaggerUi.serve,
            swaggerUi.setup(swaggerSpec, swaggerUiOptions)
        );

        // Serve raw OpenAPI spec
        app.get(`${basePath}.json`, (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.send(swaggerSpec);
        });

        // Serve YAML version
        app.get(`${basePath}.yaml`, (req, res) => {
            const yaml = require('yamljs');
            res.setHeader('Content-Type', 'text/yaml');
            res.send(yaml.stringify(swaggerSpec, 10));
        });

        // Redirect /docs to /api-docs for convenience
        app.get('/docs', (req, res) => {
            res.redirect(basePath);
        });

        console.log(`📚 API Documentation available at: ${basePath}`);
    }

    /**
     * Add JSDoc comments to existing routes
     * This enhances the auto-generated documentation
     */
    static addRouteDocs() {
        return {
            // Example JSDoc for routes
            health: `
                /**
                 * @swagger
                 * /api/health:
                 *   get:
                 *     tags:
                 *       - Health
                 *     summary: Check service health
                 *     description: Returns the current health status of all service components
                 *     responses:
                 *       200:
                 *         description: Service is healthy
                 *         content:
                 *           application/json:
                 *             schema:
                 *               $ref: '#/components/schemas/HealthResponse'
                 */
            `,
            
            react: `
                /**
                 * @swagger
                 * /api/react:
                 *   post:
                 *     tags:
                 *       - AI Processing
                 *     summary: Process AI query
                 *     description: |
                 *       Processes a user query using the ReAct agent architecture.
                 *       The agent will analyze the query, use appropriate tools, and provide a comprehensive response.
                 *     security:
                 *       - bearerAuth: []
                 *       - apiKey: []
                 *     requestBody:
                 *       required: true
                 *       content:
                 *         application/json:
                 *           schema:
                 *             $ref: '#/components/schemas/ProcessQueryRequest'
                 *     responses:
                 *       200:
                 *         description: Query processed successfully
                 *         content:
                 *           application/json:
                 *             schema:
                 *               $ref: '#/components/schemas/ProcessQueryResponse'
                 */
            `
        };
    }

    /**
     * Generate example requests for testing
     */
    static generateExamples() {
        return {
            authentication: {
                register: {
                    username: "test_user",
                    password: "SecurePass123!",
                    email: "test@example.com"
                },
                login: {
                    username: "demo",
                    password: "demo123"
                }
            },
            queries: {
                weather: {
                    query: "What's the weather like in Tokyo?",
                    sessionId: "session_123"
                },
                calculation: {
                    query: "Calculate the compound interest on $10,000 at 5% for 10 years"
                },
                crypto: {
                    query: "Compare Bitcoin and Ethereum prices and show the 24h change"
                },
                translation: {
                    query: "Translate 'Hello, how are you?' to Spanish, French, and Japanese"
                },
                fileOperation: {
                    query: "Create a file called 'shopping_list.txt' with items: milk, bread, eggs"
                },
                imageProcessing: {
                    query: "Analyze the image 'photo.jpg' and resize it to 800x600"
                },
                webSearch: {
                    query: "Search for the latest AI developments in 2024"
                },
                complexTask: {
                    query: "Get the weather in New York, convert the temperature to Celsius, and tell me if it's good for outdoor activities"
                }
            }
        };
    }

    /**
     * Add custom routes for API documentation features
     */
    static addCustomRoutes(app, basePath = '/api-docs') {
        // Examples endpoint
        app.get(`${basePath}/examples`, (req, res) => {
            res.json({
                success: true,
                examples: SwaggerMiddleware.generateExamples()
            });
        });

        // Tools documentation
        app.get(`${basePath}/tools`, (req, res) => {
            res.json({
                success: true,
                tools: [
                    {
                        name: "searchWeb",
                        description: "Search the web for current information",
                        parameters: {
                            query: "Search query string"
                        }
                    },
                    {
                        name: "getCryptoPrice",
                        description: "Get real-time cryptocurrency prices",
                        parameters: {
                            symbol: "Crypto symbol (BTC, ETH, etc.)"
                        }
                    },
                    {
                        name: "getWeather",
                        description: "Get current weather data",
                        parameters: {
                            city: "City name"
                        }
                    },
                    {
                        name: "calculate",
                        description: "Perform mathematical calculations",
                        parameters: {
                            expression: "Mathematical expression (e.g., '2 + 2', 'sqrt(16)')"
                        }
                    },
                    {
                        name: "translateText",
                        description: "Translate text between languages",
                        parameters: {
                            text: "Text to translate",
                            from: "Source language code",
                            to: "Target language code"
                        }
                    },
                    {
                        name: "readFile",
                        description: "Read contents of a file",
                        parameters: {
                            filename: "Name of the file to read"
                        }
                    },
                    {
                        name: "writeFile",
                        description: "Write contents to a file",
                        parameters: {
                            filename: "Name of the file to write",
                            content: "Content to write"
                        }
                    },
                    {
                        name: "processImage",
                        description: "Process and analyze images",
                        parameters: {
                            filename: "Image filename",
                            operation: "Operation to perform",
                            width: "Target width (optional)",
                            height: "Target height (optional)"
                        }
                    },
                    {
                        name: "textToSpeech",
                        description: "Convert text to speech audio",
                        parameters: {
                            text: "Text to convert",
                            language: "Language code",
                            voice: "Voice type (optional)"
                        }
                    }
                ]
            });
        });

        // WebSocket documentation
        app.get(`${basePath}/websocket`, (req, res) => {
            res.json({
                success: true,
                websocket: {
                    endpoint: "ws://localhost:3000",
                    events: {
                        client: [
                            {
                                event: "authenticate",
                                description: "Authenticate the WebSocket connection",
                                payload: {
                                    token: "JWT token",
                                    apiKey: "API key (alternative)",
                                    sessionId: "Optional session ID"
                                }
                            },
                            {
                                event: "query",
                                description: "Submit a query for processing",
                                payload: {
                                    query: "User query",
                                    sessionId: "Session ID"
                                }
                            }
                        ],
                        server: [
                            {
                                event: "authenticated",
                                description: "Authentication response"
                            },
                            {
                                event: "query-start",
                                description: "Query processing started"
                            },
                            {
                                event: "iteration-start",
                                description: "ReAct iteration started"
                            },
                            {
                                event: "thought",
                                description: "Agent thought stream"
                            },
                            {
                                event: "action",
                                description: "Tool action executed"
                            },
                            {
                                event: "observation",
                                description: "Tool observation"
                            },
                            {
                                event: "query-complete",
                                description: "Query processing completed"
                            },
                            {
                                event: "query-error",
                                description: "Query processing error"
                            }
                        ]
                    },
                    example: {
                        javascript: `
// WebSocket client example
const socket = io('ws://localhost:3000');

// Authenticate
socket.emit('authenticate', {
    token: 'your-jwt-token'
});

// Listen for authentication response
socket.on('authenticated', (data) => {
    if (data.success) {
        console.log('Connected with session:', data.sessionId);
        
        // Send a query
        socket.emit('query', {
            query: 'What is the weather in Paris?',
            sessionId: data.sessionId
        });
    }
});

// Listen for real-time updates
socket.on('thought', (data) => {
    console.log('Thought:', data.thought);
});

socket.on('action', (data) => {
    console.log('Action:', data.tool, data.args);
});

socket.on('query-complete', (data) => {
    console.log('Answer:', data.result.answer);
});
                        `
                    }
                }
            });
        });
    }
}

module.exports = SwaggerMiddleware;