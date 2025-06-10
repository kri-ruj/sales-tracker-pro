const { GoogleGenerativeAI } = require('@google/generative-ai');
const { EnhancedReActAgent } = require('../react-agent-enhanced');

// Mock dependencies
jest.mock('@google/generative-ai');
jest.mock('../services/cache.service');
jest.mock('../services/api-client.service');
jest.mock('../services/auth.service');
jest.mock('../services/database.service');
jest.mock('../services/queue.service');
jest.mock('sharp');
jest.mock('jimp');

const mockCacheService = require('../services/cache.service');
const mockApiClient = require('../services/api-client.service');
const mockDatabaseService = require('../services/database.service');

describe('EnhancedReActAgent', () => {
    let agent;
    let mockIo;
    let mockModel;
    let mockChat;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Mock Socket.IO
        mockIo = {
            to: jest.fn().mockReturnThis(),
            emit: jest.fn()
        };
        
        // Mock Gemini model
        mockChat = {
            sendMessage: jest.fn()
        };
        
        mockModel = {
            startChat: jest.fn().mockReturnValue(mockChat)
        };
        
        GoogleGenerativeAI.mockImplementation(() => ({
            getGenerativeModel: jest.fn().mockReturnValue(mockModel)
        }));
        
        // Create agent instance
        agent = new EnhancedReActAgent(mockIo);
    });

    describe('Constructor', () => {
        test('should initialize with correct properties', () => {
            expect(agent.io).toBe(mockIo);
            expect(agent.maxIterations).toBe(10);
            expect(agent.activeChats).toBeInstanceOf(Map);
            expect(agent.tools).toBeDefined();
            expect(agent.tools[0].functionDeclarations).toHaveLength(12); // All tools including textToSpeech
        });

        test('should create circuit breakers for external APIs', () => {
            expect(agent.circuitBreakers).toHaveProperty('crypto');
            expect(agent.circuitBreakers).toHaveProperty('weather');
            expect(agent.circuitBreakers).toHaveProperty('search');
            expect(agent.circuitBreakers).toHaveProperty('country');
        });
    });

    describe('executeReAct', () => {
        const userId = 'test-user';
        const sessionId = 'test-session';
        const socketId = 'test-socket';
        const userQuery = 'What is 2+2?';

        beforeEach(() => {
            // Mock database service methods
            mockDatabaseService.getSessionContext = jest.fn().mockResolvedValue([]);
            mockDatabaseService.getConversationSummary = jest.fn().mockResolvedValue(null);
            mockDatabaseService.saveExecutionLog = jest.fn().mockResolvedValue();
            mockDatabaseService.saveChatMessage = jest.fn().mockResolvedValue();
        });

        test('should execute query and return answer', async () => {
            // Mock chat response
            mockChat.sendMessage.mockResolvedValue({
                response: {
                    text: () => 'Thought: I need to calculate 2+2.\nAnswer: 4',
                    functionCalls: () => null
                }
            });

            const result = await agent.executeReAct(userQuery, userId, sessionId, socketId);

            expect(result.answer).toBe('4');
            expect(result.query).toBe(userQuery);
            expect(result.iterations).toBe(1);
            expect(mockIo.to).toHaveBeenCalledWith(socketId);
        });

        test('should handle tool execution', async () => {
            // Mock chat response with function call
            const mockFunctionCall = {
                name: 'calculate',
                args: { expression: '2+2' }
            };

            mockChat.sendMessage
                .mockResolvedValueOnce({
                    response: {
                        text: () => 'Thought: I need to calculate 2+2.',
                        functionCalls: () => [mockFunctionCall]
                    }
                })
                .mockResolvedValueOnce({
                    response: {
                        text: () => 'Answer: The result is 4',
                        functionCalls: () => null
                    }
                });

            // Mock cache service
            mockCacheService.get.mockResolvedValue(null);
            mockCacheService.set.mockResolvedValue();

            const result = await agent.executeReAct(userQuery, userId, sessionId, socketId);

            expect(result.answer).toBe('The result is 4');
            expect(result.actionHistory).toHaveLength(1);
            expect(result.actionHistory[0].action).toBe('calculate');
        });

        test('should use cached results when available', async () => {
            const cachedResult = {
                success: true,
                result: 4,
                cached: true
            };

            mockCacheService.get.mockResolvedValue(cachedResult);

            const mockFunctionCall = {
                name: 'calculate',
                args: { expression: '2+2' }
            };

            mockChat.sendMessage
                .mockResolvedValueOnce({
                    response: {
                        text: () => 'Thought: I need to calculate.',
                        functionCalls: () => [mockFunctionCall]
                    }
                })
                .mockResolvedValueOnce({
                    response: {
                        text: () => 'Answer: 4',
                        functionCalls: () => null
                    }
                });

            const result = await agent.executeReAct(userQuery, userId, sessionId, socketId);

            expect(mockCacheService.get).toHaveBeenCalled();
            expect(result.actionHistory[0].result.cached).toBe(true);
        });

        test('should handle errors gracefully', async () => {
            mockChat.sendMessage.mockRejectedValue(new Error('API Error'));

            const result = await agent.executeReAct(userQuery, userId, sessionId, socketId);

            expect(result.answer).toContain('error occurred');
            expect(mockIo.to).toHaveBeenCalledWith(socketId);
            expect(mockIo.emit).toHaveBeenCalledWith('query-error', expect.any(Object));
        });

        test('should respect max iterations', async () => {
            // Mock responses without final answer
            mockChat.sendMessage.mockResolvedValue({
                response: {
                    text: () => 'Thought: Still thinking...',
                    functionCalls: () => null
                }
            });

            agent.maxIterations = 2;
            const result = await agent.executeReAct(userQuery, userId, sessionId, socketId);

            expect(result.iterations).toBe(2);
            expect(result.answer).toContain('multiple steps');
            expect(mockChat.sendMessage).toHaveBeenCalledTimes(2);
        });
    });

    describe('Tool Functions', () => {
        describe('calculateEnhanced', () => {
            test('should calculate mathematical expressions', async () => {
                const result = await agent.calculateEnhanced({ expression: '2+2*3' });
                expect(result.success).toBe(true);
                expect(result.result).toBe(8);
                expect(result.formatted).toBe('2+2*3 = 8');
            });

            test('should support math functions', async () => {
                const result = await agent.calculateEnhanced({ expression: 'sqrt(16)' });
                expect(result.success).toBe(true);
                expect(result.result).toBe(4);
            });

            test('should handle invalid expressions', async () => {
                const result = await agent.calculateEnhanced({ expression: 'invalid' });
                expect(result.success).toBe(false);
                expect(result.error).toContain('Invalid expression');
            });
        });

        describe('translateTextEnhanced', () => {
            test('should translate text', async () => {
                mockApiClient.get = jest.fn().mockResolvedValue([
                    [['Hola', 'Hello']]
                ]);

                const result = await agent.translateTextEnhanced({
                    text: 'Hello',
                    from: 'en',
                    to: 'es'
                });

                expect(result.success).toBe(true);
                expect(result.translated).toBe('Hola');
            });

            test('should handle translation errors', async () => {
                mockApiClient.get = jest.fn().mockRejectedValue(new Error('API Error'));

                const result = await agent.translateTextEnhanced({
                    text: 'Hello',
                    from: 'en',
                    to: 'es'
                });

                expect(result.success).toBe(false);
                expect(result.error).toContain('Translation failed');
            });
        });

        describe('generateRandomDataEnhanced', () => {
            test('should generate random number', async () => {
                const result = await agent.generateRandomDataEnhanced({
                    type: 'number',
                    min: 1,
                    max: 10
                });

                expect(result.success).toBe(true);
                expect(result.result).toBeGreaterThanOrEqual(1);
                expect(result.result).toBeLessThanOrEqual(10);
            });

            test('should generate random string', async () => {
                const result = await agent.generateRandomDataEnhanced({
                    type: 'string',
                    length: 10
                });

                expect(result.success).toBe(true);
                expect(result.result).toHaveLength(10);
                expect(typeof result.result).toBe('string');
            });

            test('should generate UUID', async () => {
                const result = await agent.generateRandomDataEnhanced({
                    type: 'uuid'
                });

                expect(result.success).toBe(true);
                expect(result.result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
            });

            test('should generate password', async () => {
                const result = await agent.generateRandomDataEnhanced({
                    type: 'password',
                    length: 16
                });

                expect(result.success).toBe(true);
                expect(result.result).toHaveLength(16);
                expect(result.result).toMatch(/[A-Za-z0-9!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/);
            });
        });

        describe('processImageEnhanced', () => {
            beforeEach(() => {
                // Mock fs.access to simulate file exists
                jest.spyOn(require('fs').promises, 'access').mockResolvedValue();
            });

            test('should analyze image metadata', async () => {
                // Mock sharp
                const mockSharp = jest.fn().mockReturnValue({
                    metadata: jest.fn().mockResolvedValue({
                        format: 'jpeg',
                        width: 1920,
                        height: 1080,
                        channels: 3,
                        size: 500000,
                        density: 72,
                        hasAlpha: false,
                        orientation: 1
                    })
                });
                require('sharp').mockImplementation(mockSharp);

                const result = await agent.processImageEnhanced({
                    filename: 'test.jpg',
                    operation: 'analyze'
                });

                expect(result.success).toBe(true);
                expect(result.metadata.width).toBe(1920);
                expect(result.metadata.height).toBe(1080);
                expect(result.metadata.format).toBe('jpeg');
            });

            test('should handle missing file', async () => {
                jest.spyOn(require('fs').promises, 'access')
                    .mockRejectedValue(new Error('ENOENT'));

                const result = await agent.processImageEnhanced({
                    filename: 'nonexistent.jpg',
                    operation: 'analyze'
                });

                expect(result.success).toBe(false);
                expect(result.error).toContain('Image processing failed');
            });

            test('should validate resize parameters', async () => {
                const result = await agent.processImageEnhanced({
                    filename: 'test.jpg',
                    operation: 'resize'
                });

                expect(result.success).toBe(false);
                expect(result.error).toContain('Width or height required');
            });

            test('should validate filter parameters', async () => {
                const result = await agent.processImageEnhanced({
                    filename: 'test.jpg',
                    operation: 'filter'
                });

                expect(result.success).toBe(false);
                expect(result.error).toContain('Filter type required');
            });
        });

        describe('textToSpeechEnhanced', () => {
            beforeEach(() => {
                // Mock gTTS
                const mockGTTS = jest.fn().mockImplementation((text, lang) => ({
                    save: jest.fn((path, callback) => callback(null))
                }));
                jest.mock('gtts', () => mockGTTS);
            });

            test('should convert text to speech', async () => {
                const result = await agent.textToSpeechEnhanced({
                    text: 'Hello world',
                    language: 'en'
                });

                expect(result.success).toBe(true);
                expect(result.language).toBe('en');
                expect(result.message).toContain('Speech audio saved');
            });

            test('should handle different languages', async () => {
                const result = await agent.textToSpeechEnhanced({
                    text: 'Hola mundo',
                    language: 'es'
                });

                expect(result.success).toBe(true);
                expect(result.language).toBe('es');
            });

            test('should use custom filename', async () => {
                const result = await agent.textToSpeechEnhanced({
                    text: 'Test speech',
                    language: 'en',
                    filename: 'custom-speech.mp3'
                });

                expect(result.success).toBe(true);
                expect(result.filename).toBe('custom-speech.mp3');
            });
        });
    });

    describe('Conversation Memory', () => {
        test('should get conversation context', async () => {
            const mockMessages = [
                { message_type: 'user', content: 'Hello' },
                { message_type: 'assistant', content: 'Hi there!' }
            ];

            mockDatabaseService.getSessionContext.mockResolvedValue(mockMessages);
            mockDatabaseService.getConversationSummary.mockResolvedValue({
                total_messages: 2,
                tools_used: ['searchWeb']
            });

            const context = await agent.getConversationContext('test-session');

            expect(context.history).toHaveLength(2);
            expect(context.history[0].role).toBe('user');
            expect(context.history[1].role).toBe('model');
            expect(context.summary.tools_used).toContain('searchWeb');
        });

        test('should build context with history', () => {
            const conversationContext = {
                messageCount: 5,
                summary: {
                    tools_used: ['calculate', 'searchWeb']
                }
            };

            const context = agent.buildContextWithHistory('New query', conversationContext);

            expect(context).toContain('New query');
            expect(context).toContain('5 previous messages');
            expect(context).toContain('calculate, searchWeb');
        });
    });

    describe('Helper Methods', () => {
        test('should parse response correctly', () => {
            const text = 'Thought: I need to think about this.\nAnswer: The answer is 42.';
            const { thought, answer } = agent.parseResponse(text);

            expect(thought).toBe('I need to think about this.');
            expect(answer).toBe('The answer is 42.');
        });

        test('should extract sections correctly', () => {
            const text = 'Thought: First thought\nAction: Do something\nAnswer: Final answer';
            
            const thought = agent.extractSection(text, 'Thought:');
            const action = agent.extractSection(text, 'Action:');
            const answer = agent.extractSection(text, 'Answer:');

            expect(thought).toBe('First thought');
            expect(action).toBe('Do something');
            expect(answer).toBe('Final answer');
        });

        test('should summarize progress', () => {
            const session = {
                thoughtHistory: [
                    { thought: 'First thought', type: 'thought' },
                    { thought: 'Observation 1', type: 'observation' }
                ],
                actionHistory: [
                    {
                        action: 'calculate',
                        args: { expression: '2+2' },
                        result: { success: true, result: 4 }
                    }
                ]
            };

            const summary = agent.summarizeProgress(session);

            expect(summary).toContain('First thought');
            expect(summary).toContain('Observation 1');
            expect(summary).toContain('calculate');
        });
    });

    describe('Error Handling', () => {
        test('should handle missing Gemini API key', () => {
            delete process.env.GEMINI_API_KEY;
            expect(() => new EnhancedReActAgent(mockIo)).not.toThrow();
        });

        test('should handle database save errors', async () => {
            mockDatabaseService.saveExecutionLog.mockRejectedValue(new Error('DB Error'));
            
            // Should not throw
            await expect(agent.saveToHistory('user', 'session', {})).resolves.not.toThrow();
        });
    });
});