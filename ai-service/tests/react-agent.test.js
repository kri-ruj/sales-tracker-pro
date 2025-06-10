const { EnhancedReActAgent } = require('../react-agent-enhanced');

// Mock dependencies
jest.mock('@google/generative-ai');
jest.mock('../services/cache.service');
jest.mock('../services/api-client.service');

describe('EnhancedReActAgent', () => {
    let agent;
    let mockIo;
    let mockSocket;

    beforeEach(() => {
        // Mock Socket.io
        mockSocket = {
            emit: jest.fn()
        };
        mockIo = {
            to: jest.fn(() => mockSocket)
        };

        agent = new EnhancedReActAgent(mockIo);
    });

    describe('parseResponse', () => {
        it('should extract thought from response', () => {
            const text = 'Thought: I need to check the weather\nAction: getWeather';
            const result = agent.parseResponse(text);
            
            expect(result.thought).toBe('I need to check the weather');
            expect(result.answer).toBeNull();
        });

        it('should extract answer from response', () => {
            const text = 'Answer: The weather in Tokyo is sunny and 25°C';
            const result = agent.parseResponse(text);
            
            expect(result.answer).toBe('The weather in Tokyo is sunny and 25°C');
            expect(result.thought).toBeNull();
        });

        it('should extract both thought and answer', () => {
            const text = 'Thought: Processing the request\nAnswer: Task completed';
            const result = agent.parseResponse(text);
            
            expect(result.thought).toBe('Processing the request');
            expect(result.answer).toBe('Task completed');
        });
    });

    describe('extractSection', () => {
        it('should extract section with marker', () => {
            const text = 'Some text\nThought: This is a thought\nAction: doSomething';
            const result = agent.extractSection(text, 'Thought:');
            
            expect(result).toBe('This is a thought');
        });

        it('should return null if marker not found', () => {
            const text = 'Some text without markers';
            const result = agent.extractSection(text, 'Thought:');
            
            expect(result).toBeNull();
        });
    });

    describe('emitToClient', () => {
        it('should emit event to specific socket', () => {
            const socketId = 'test-socket-id';
            const event = 'test-event';
            const data = { test: 'data' };

            agent.emitToClient(socketId, event, data);

            expect(mockIo.to).toHaveBeenCalledWith(socketId);
            expect(mockSocket.emit).toHaveBeenCalledWith(event, data);
        });

        it('should not emit if no socket ID', () => {
            agent.emitToClient(null, 'test-event', {});
            
            expect(mockIo.to).not.toHaveBeenCalled();
        });
    });

    describe('tool execution', () => {
        it('should execute getCryptoPrice', async () => {
            const apiClient = require('../services/api-client.service');
            apiClient.get = jest.fn().mockResolvedValue({
                bitcoin: { usd: 50000, usd_24h_change: 5.2 }
            });

            const result = await agent.getCryptoPriceEnhanced({ symbol: 'BTC' });

            expect(result.success).toBe(true);
            expect(result.symbol).toBe('BTC');
            expect(result.price).toBe('$50,000');
            expect(result.change24h).toBe('+5.20%');
        });

        it('should handle unknown cryptocurrency', async () => {
            const apiClient = require('../services/api-client.service');
            apiClient.get = jest.fn().mockResolvedValue({});

            const result = await agent.getCryptoPriceEnhanced({ symbol: 'UNKNOWN' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Unknown cryptocurrency');
        });

        it('should execute getWeather', async () => {
            const apiClient = require('../services/api-client.service');
            apiClient.get = jest.fn().mockResolvedValue({
                current_condition: [{
                    temp_C: '25',
                    temp_F: '77',
                    weatherDesc: [{ value: 'Sunny' }],
                    humidity: '60',
                    windspeedKmph: '10'
                }],
                nearest_area: [{
                    areaName: [{ value: 'Tokyo' }],
                    country: [{ value: 'Japan' }]
                }]
            });

            const result = await agent.getWeatherEnhanced({ city: 'Tokyo' });

            expect(result.success).toBe(true);
            expect(result.location).toBe('Tokyo, Japan');
            expect(result.temperature).toBe('25°C (77°F)');
            expect(result.condition).toBe('Sunny');
        });

        it('should execute searchWeb', async () => {
            const apiClient = require('../services/api-client.service');
            apiClient.get = jest.fn().mockResolvedValue({
                AbstractText: 'Test search result',
                Heading: 'Test Query',
                AbstractURL: 'http://example.com'
            });

            const result = await agent.searchWebEnhanced({ query: 'test query' });

            expect(result.success).toBe(true);
            expect(result.results).toHaveLength(1);
            expect(result.results[0].snippet).toBe('Test search result');
        });

        it('should execute convertCurrency', async () => {
            const apiClient = require('../services/api-client.service');
            apiClient.get = jest.fn().mockResolvedValue({
                rates: { EUR: 0.85 }
            });

            const result = await agent.convertCurrencyEnhanced({ 
                amount: 100, 
                from: 'USD', 
                to: 'EUR' 
            });

            expect(result.success).toBe(true);
            expect(result.result).toBe('85.00');
            expect(result.formatted).toBe('100 USD = 85.00 EUR');
        });
    });

    describe('summarizeProgress', () => {
        it('should summarize session progress', () => {
            const session = {
                thoughtHistory: [
                    { thought: 'First thought' },
                    { thought: 'Second thought' }
                ],
                actionHistory: [
                    { action: 'searchWeb', result: { success: true } },
                    { action: 'getWeather', result: { success: false } }
                ]
            };

            const summary = agent.summarizeProgress(session);

            expect(summary).toContain('First thought');
            expect(summary).toContain('Second thought');
            expect(summary).toContain('searchWeb: Success');
            expect(summary).toContain('getWeather: Failed');
        });
    });
});