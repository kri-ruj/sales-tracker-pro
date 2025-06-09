const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Vertex AI / Gemini Service
 * Handles all AI generation requests
 */
class VertexAIService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
        this.model = process.env.AI_MODEL || 'gemini-1.5-flash';
        this.genAI = null;
        this.initialized = false;
        this.mockMode = false;
    }

    initialize() {
        if (!this.apiKey) {
            console.warn('No Google AI API key found. AI features will run in mock mode.');
            this.mockMode = true;
            return;
        }

        try {
            this.genAI = new GoogleGenerativeAI(this.apiKey);
            this.initialized = true;
            console.log('VertexAI service initialized with model:', this.model);
        } catch (error) {
            console.error('Failed to initialize VertexAI:', error);
            this.mockMode = true;
        }
    }

    async generateContent(prompt, options = {}) {
        if (!this.initialized && !this.mockMode) {
            this.initialize();
        }

        if (this.mockMode) {
            return this.generateMockContent(prompt);
        }

        try {
            const model = this.genAI.getGenerativeModel({ 
                model: this.model,
                generationConfig: {
                    temperature: options.temperature || 0.7,
                    topK: options.topK || 40,
                    topP: options.topP || 0.95,
                    maxOutputTokens: options.maxOutputTokens || 2048,
                }
            });

            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error('Error generating content:', error);
            throw new Error(`AI generation failed: ${error.message}`);
        }
    }

    async generateContentStream(prompt, options = {}) {
        if (!this.initialized && !this.mockMode) {
            this.initialize();
        }

        if (this.mockMode) {
            return this.generateMockStream(prompt);
        }

        try {
            const model = this.genAI.getGenerativeModel({ 
                model: this.model,
                generationConfig: {
                    temperature: options.temperature || 0.7,
                    topK: options.topK || 40,
                    topP: options.topP || 0.95,
                    maxOutputTokens: options.maxOutputTokens || 2048,
                }
            });

            const result = await model.generateContentStream(prompt);
            
            // Return an async generator
            return (async function* () {
                for await (const chunk of result.stream) {
                    yield chunk.text();
                }
            })();
        } catch (error) {
            console.error('Error generating stream:', error);
            throw new Error(`AI stream generation failed: ${error.message}`);
        }
    }

    generateMockContent(prompt) {
        const responses = [
            "Based on your request, I've analyzed the information and here's what I found...",
            "I understand you're looking for assistance. Let me help you with that...",
            "Here's a comprehensive response to your query...",
            "I've processed your request and generated the following insights..."
        ];

        return responses[Math.floor(Math.random() * responses.length)] + 
               `\n\nYour prompt was: "${prompt.substring(0, 100)}..."` +
               '\n\nThis is a mock response as the AI service is running in development mode.';
    }

    async* generateMockStream(prompt) {
        const response = this.generateMockContent(prompt);
        const words = response.split(' ');
        
        for (const word of words) {
            yield word + ' ';
            await new Promise(resolve => setTimeout(resolve, 50)); // Simulate streaming delay
        }
    }

    // Function calling support for tools
    async generateWithTools(prompt, tools, options = {}) {
        if (!this.initialized && !this.mockMode) {
            this.initialize();
        }

        if (this.mockMode) {
            return {
                text: this.generateMockContent(prompt),
                toolCalls: []
            };
        }

        try {
            const model = this.genAI.getGenerativeModel({ 
                model: this.model,
                tools: tools,
                generationConfig: {
                    temperature: options.temperature || 0.7,
                    topK: options.topK || 40,
                    topP: options.topP || 0.95,
                    maxOutputTokens: options.maxOutputTokens || 2048,
                }
            });

            const result = await model.generateContent(prompt);
            const response = await result.response;
            
            return {
                text: response.text(),
                toolCalls: response.functionCalls() || []
            };
        } catch (error) {
            console.error('Error generating with tools:', error);
            throw new Error(`AI generation with tools failed: ${error.message}`);
        }
    }

    // Get available models
    async listModels() {
        if (this.mockMode) {
            return ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro'];
        }

        try {
            const models = await this.genAI.listModels();
            return models.map(model => model.name);
        } catch (error) {
            console.error('Error listing models:', error);
            return ['gemini-1.5-flash'];
        }
    }

    // Get metrics
    getMetrics() {
        return {
            initialized: this.initialized,
            mockMode: this.mockMode || false,
            model: this.model,
            apiKeySet: !!this.apiKey
        };
    }
}

module.exports = VertexAIService;