class StockTrackerPlugin {
    constructor() {
        this.name = 'Stock Market Tracker';
        this.watchlists = new Map();
        this.portfolios = new Map();
        this.api = null;
        this.updateTimer = null;
    }

    async init(api) {
        this.api = api;
        this.logger = api.logger;
        
        // Load saved data
        await this.loadData();
        
        // Register tools
        this.registerTools();
        
        // Register routes
        this.registerRoutes();
        
        // Start update timer
        this.startUpdateTimer();
        
        this.logger.info('Stock Tracker Plugin initialized');
    }

    async loadData() {
        // Load watchlists and portfolios from storage
        const watchlists = await this.api.storage.get('watchlists');
        if (watchlists) {
            this.watchlists = new Map(Object.entries(watchlists));
        }
        
        const portfolios = await this.api.storage.get('portfolios');
        if (portfolios) {
            this.portfolios = new Map(Object.entries(portfolios));
        }
    }

    registerTools() {
        // Get stock price
        this.api.registerTool({
            name: 'getStockPrice',
            description: 'Get current stock price and market data',
            parameters: {
                type: 'object',
                properties: {
                    symbol: {
                        type: 'string',
                        description: 'Stock symbol (e.g., AAPL, GOOGL)'
                    },
                    detailed: {
                        type: 'boolean',
                        description: 'Include detailed market data',
                        default: false
                    }
                },
                required: ['symbol']
            },
            handler: this.getStockPrice.bind(this)
        });

        // Get stock history
        this.api.registerTool({
            name: 'getStockHistory',
            description: 'Get historical stock data',
            parameters: {
                type: 'object',
                properties: {
                    symbol: {
                        type: 'string',
                        description: 'Stock symbol'
                    },
                    period: {
                        type: 'string',
                        description: 'Time period (1d, 5d, 1m, 3m, 6m, 1y, 5y)',
                        default: '1m'
                    },
                    interval: {
                        type: 'string',
                        description: 'Data interval (1m, 5m, 15m, 1h, 1d)',
                        default: '1d'
                    }
                },
                required: ['symbol']
            },
            handler: this.getStockHistory.bind(this)
        });

        // Manage watchlist
        this.api.registerTool({
            name: 'manageWatchlist',
            description: 'Add or remove stocks from watchlist',
            parameters: {
                type: 'object',
                properties: {
                    action: {
                        type: 'string',
                        enum: ['add', 'remove', 'list'],
                        description: 'Action to perform'
                    },
                    userId: {
                        type: 'string',
                        description: 'User ID'
                    },
                    symbol: {
                        type: 'string',
                        description: 'Stock symbol (required for add/remove)'
                    }
                },
                required: ['action', 'userId']
            },
            handler: this.manageWatchlist.bind(this)
        });

        // Portfolio management
        this.api.registerTool({
            name: 'managePortfolio',
            description: 'Track stock portfolio and performance',
            parameters: {
                type: 'object',
                properties: {
                    action: {
                        type: 'string',
                        enum: ['add', 'remove', 'update', 'view'],
                        description: 'Action to perform'
                    },
                    userId: {
                        type: 'string',
                        description: 'User ID'
                    },
                    transaction: {
                        type: 'object',
                        properties: {
                            symbol: { type: 'string' },
                            quantity: { type: 'number' },
                            price: { type: 'number' },
                            type: { type: 'string', enum: ['buy', 'sell'] }
                        }
                    }
                },
                required: ['action', 'userId']
            },
            handler: this.managePortfolio.bind(this)
        });

        // Technical analysis
        this.api.registerTool({
            name: 'technicalAnalysis',
            description: 'Get technical analysis indicators',
            parameters: {
                type: 'object',
                properties: {
                    symbol: {
                        type: 'string',
                        description: 'Stock symbol'
                    },
                    indicators: {
                        type: 'array',
                        items: {
                            type: 'string',
                            enum: ['RSI', 'MACD', 'SMA', 'EMA', 'BB']
                        },
                        description: 'Technical indicators to calculate'
                    }
                },
                required: ['symbol']
            },
            handler: this.technicalAnalysis.bind(this)
        });
    }

    registerRoutes() {
        // Watchlist API endpoint
        this.api.registerRoute({
            method: 'GET',
            path: '/watchlist/:userId',
            handler: async (req, res) => {
                try {
                    const { userId } = req.params;
                    const watchlist = this.watchlists.get(userId) || [];
                    
                    // Get current prices for all symbols
                    const stocks = await Promise.all(
                        watchlist.map(symbol => this.getStockPrice({ symbol }))
                    );
                    
                    res.json({
                        success: true,
                        watchlist: stocks
                    });
                } catch (error) {
                    res.status(500).json({
                        success: false,
                        error: error.message
                    });
                }
            }
        });

        // Portfolio API endpoint
        this.api.registerRoute({
            method: 'GET',
            path: '/portfolio/:userId',
            handler: async (req, res) => {
                try {
                    const { userId } = req.params;
                    const portfolio = await this.calculatePortfolioValue(userId);
                    
                    res.json({
                        success: true,
                        portfolio
                    });
                } catch (error) {
                    res.status(500).json({
                        success: false,
                        error: error.message
                    });
                }
            }
        });
    }

    startUpdateTimer() {
        const interval = (this.api.storage.get('config')?.updateInterval || 60) * 1000;
        
        this.updateTimer = setInterval(async () => {
            try {
                await this.updateWatchlists();
            } catch (error) {
                this.logger.error('Failed to update watchlists', error);
            }
        }, interval);
    }

    // Tool implementations
    async getStockPrice({ symbol, detailed = false }) {
        try {
            // Mock stock data - in production would use real API
            const mockData = {
                symbol: symbol.toUpperCase(),
                price: 150 + Math.random() * 50,
                change: (Math.random() - 0.5) * 10,
                changePercent: (Math.random() - 0.5) * 5,
                volume: Math.floor(Math.random() * 10000000),
                marketCap: Math.floor(Math.random() * 1000000000000),
                timestamp: new Date().toISOString()
            };

            if (detailed) {
                mockData.detailed = {
                    open: mockData.price - Math.random() * 5,
                    high: mockData.price + Math.random() * 5,
                    low: mockData.price - Math.random() * 5,
                    previousClose: mockData.price - mockData.change,
                    fiftyTwoWeekHigh: mockData.price + Math.random() * 50,
                    fiftyTwoWeekLow: mockData.price - Math.random() * 50,
                    pe: 20 + Math.random() * 10,
                    eps: 5 + Math.random() * 5,
                    dividend: Math.random() * 3,
                    beta: 0.8 + Math.random() * 0.4
                };
            }

            // Cache the result
            if (this.api.cache) {
                await this.api.cache.set(
                    'stock-tracker',
                    { key: `price:${symbol}` },
                    mockData,
                    { ttl: 60 }
                );
            }

            return {
                success: true,
                ...mockData
            };

        } catch (error) {
            this.logger.error('Failed to get stock price', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getStockHistory({ symbol, period = '1m', interval = '1d' }) {
        try {
            // Generate mock historical data
            const dataPoints = this.getDataPointsForPeriod(period, interval);
            const history = [];
            const basePrice = 150;
            
            for (let i = 0; i < dataPoints; i++) {
                const date = new Date();
                date.setDate(date.getDate() - (dataPoints - i));
                
                const price = basePrice + (Math.random() - 0.5) * 20;
                history.push({
                    date: date.toISOString().split('T')[0],
                    open: price - Math.random() * 2,
                    high: price + Math.random() * 2,
                    low: price - Math.random() * 2,
                    close: price,
                    volume: Math.floor(Math.random() * 10000000)
                });
            }

            return {
                success: true,
                symbol: symbol.toUpperCase(),
                period,
                interval,
                history
            };

        } catch (error) {
            this.logger.error('Failed to get stock history', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async manageWatchlist({ action, userId, symbol }) {
        try {
            let watchlist = this.watchlists.get(userId) || [];

            switch (action) {
                case 'add':
                    if (!symbol) {
                        throw new Error('Symbol required for add action');
                    }
                    if (!watchlist.includes(symbol.toUpperCase())) {
                        watchlist.push(symbol.toUpperCase());
                        this.watchlists.set(userId, watchlist);
                        await this.saveWatchlists();
                    }
                    break;

                case 'remove':
                    if (!symbol) {
                        throw new Error('Symbol required for remove action');
                    }
                    watchlist = watchlist.filter(s => s !== symbol.toUpperCase());
                    this.watchlists.set(userId, watchlist);
                    await this.saveWatchlists();
                    break;

                case 'list':
                    // Just return the list
                    break;

                default:
                    throw new Error(`Unknown action: ${action}`);
            }

            return {
                success: true,
                action,
                watchlist
            };

        } catch (error) {
            this.logger.error('Failed to manage watchlist', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async managePortfolio({ action, userId, transaction }) {
        try {
            let portfolio = this.portfolios.get(userId) || {
                holdings: {},
                transactions: []
            };

            switch (action) {
                case 'add':
                case 'update':
                    if (!transaction) {
                        throw new Error('Transaction required for add/update action');
                    }
                    
                    // Record transaction
                    portfolio.transactions.push({
                        ...transaction,
                        timestamp: new Date().toISOString()
                    });
                    
                    // Update holdings
                    const { symbol, quantity, type } = transaction;
                    if (!portfolio.holdings[symbol]) {
                        portfolio.holdings[symbol] = { quantity: 0, avgPrice: 0 };
                    }
                    
                    if (type === 'buy') {
                        const holding = portfolio.holdings[symbol];
                        const totalCost = (holding.quantity * holding.avgPrice) + 
                                        (quantity * transaction.price);
                        holding.quantity += quantity;
                        holding.avgPrice = totalCost / holding.quantity;
                    } else if (type === 'sell') {
                        portfolio.holdings[symbol].quantity -= quantity;
                        if (portfolio.holdings[symbol].quantity <= 0) {
                            delete portfolio.holdings[symbol];
                        }
                    }
                    
                    this.portfolios.set(userId, portfolio);
                    await this.savePortfolios();
                    break;

                case 'view':
                    // Calculate current value
                    return await this.calculatePortfolioValue(userId);

                default:
                    throw new Error(`Unknown action: ${action}`);
            }

            return {
                success: true,
                action,
                portfolio: portfolio.holdings
            };

        } catch (error) {
            this.logger.error('Failed to manage portfolio', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async technicalAnalysis({ symbol, indicators = ['RSI', 'SMA'] }) {
        try {
            // Get historical data
            const history = await this.getStockHistory({ symbol, period: '3m' });
            
            if (!history.success) {
                throw new Error('Failed to get historical data');
            }

            const prices = history.history.map(h => h.close);
            const analysis = {};

            // Calculate indicators
            for (const indicator of indicators) {
                switch (indicator) {
                    case 'RSI':
                        analysis.RSI = this.calculateRSI(prices);
                        break;
                    case 'SMA':
                        analysis.SMA = {
                            SMA20: this.calculateSMA(prices, 20),
                            SMA50: this.calculateSMA(prices, 50)
                        };
                        break;
                    case 'EMA':
                        analysis.EMA = {
                            EMA12: this.calculateEMA(prices, 12),
                            EMA26: this.calculateEMA(prices, 26)
                        };
                        break;
                    case 'MACD':
                        analysis.MACD = this.calculateMACD(prices);
                        break;
                    case 'BB':
                        analysis.BollingerBands = this.calculateBollingerBands(prices);
                        break;
                }
            }

            // Add recommendation
            analysis.recommendation = this.generateRecommendation(analysis);

            return {
                success: true,
                symbol: symbol.toUpperCase(),
                indicators: analysis,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to perform technical analysis', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Helper methods
    getDataPointsForPeriod(period, interval) {
        const periodMap = {
            '1d': 1,
            '5d': 5,
            '1m': 30,
            '3m': 90,
            '6m': 180,
            '1y': 365,
            '5y': 1825
        };
        return periodMap[period] || 30;
    }

    calculateRSI(prices, period = 14) {
        if (prices.length < period) return null;
        
        let gains = 0;
        let losses = 0;
        
        for (let i = 1; i <= period; i++) {
            const diff = prices[prices.length - i] - prices[prices.length - i - 1];
            if (diff > 0) gains += diff;
            else losses -= diff;
        }
        
        const avgGain = gains / period;
        const avgLoss = losses / period;
        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        
        return Math.round(rsi * 100) / 100;
    }

    calculateSMA(prices, period) {
        if (prices.length < period) return null;
        
        const relevantPrices = prices.slice(-period);
        const sum = relevantPrices.reduce((a, b) => a + b, 0);
        return Math.round((sum / period) * 100) / 100;
    }

    calculateEMA(prices, period) {
        if (prices.length < period) return null;
        
        const multiplier = 2 / (period + 1);
        let ema = this.calculateSMA(prices.slice(0, period), period);
        
        for (let i = period; i < prices.length; i++) {
            ema = (prices[i] - ema) * multiplier + ema;
        }
        
        return Math.round(ema * 100) / 100;
    }

    calculateMACD(prices) {
        const ema12 = this.calculateEMA(prices, 12);
        const ema26 = this.calculateEMA(prices, 26);
        
        if (!ema12 || !ema26) return null;
        
        const macd = ema12 - ema26;
        const signal = this.calculateEMA([macd], 9) || macd * 0.9;
        const histogram = macd - signal;
        
        return {
            MACD: Math.round(macd * 100) / 100,
            signal: Math.round(signal * 100) / 100,
            histogram: Math.round(histogram * 100) / 100
        };
    }

    calculateBollingerBands(prices, period = 20, stdDev = 2) {
        const sma = this.calculateSMA(prices, period);
        if (!sma) return null;
        
        const relevantPrices = prices.slice(-period);
        const variance = relevantPrices.reduce((sum, price) => {
            return sum + Math.pow(price - sma, 2);
        }, 0) / period;
        
        const std = Math.sqrt(variance);
        
        return {
            upper: Math.round((sma + (stdDev * std)) * 100) / 100,
            middle: sma,
            lower: Math.round((sma - (stdDev * std)) * 100) / 100
        };
    }

    generateRecommendation(analysis) {
        let score = 0;
        
        // RSI analysis
        if (analysis.RSI) {
            if (analysis.RSI < 30) score += 2; // Oversold
            else if (analysis.RSI > 70) score -= 2; // Overbought
            else score += 1; // Neutral
        }
        
        // MACD analysis
        if (analysis.MACD) {
            if (analysis.MACD.histogram > 0) score += 1; // Bullish
            else score -= 1; // Bearish
        }
        
        // Generate recommendation
        if (score >= 2) return 'Strong Buy';
        if (score >= 1) return 'Buy';
        if (score <= -2) return 'Strong Sell';
        if (score <= -1) return 'Sell';
        return 'Hold';
    }

    async calculatePortfolioValue(userId) {
        const portfolio = this.portfolios.get(userId);
        if (!portfolio || Object.keys(portfolio.holdings).length === 0) {
            return {
                success: true,
                totalValue: 0,
                holdings: [],
                performance: { gain: 0, gainPercent: 0 }
            };
        }

        const holdings = [];
        let totalValue = 0;
        let totalCost = 0;

        for (const [symbol, holding] of Object.entries(portfolio.holdings)) {
            const currentPrice = await this.getStockPrice({ symbol });
            const value = holding.quantity * currentPrice.price;
            const cost = holding.quantity * holding.avgPrice;
            
            holdings.push({
                symbol,
                quantity: holding.quantity,
                avgPrice: holding.avgPrice,
                currentPrice: currentPrice.price,
                value,
                gain: value - cost,
                gainPercent: ((value - cost) / cost) * 100
            });
            
            totalValue += value;
            totalCost += cost;
        }

        return {
            success: true,
            totalValue,
            totalCost,
            holdings,
            performance: {
                gain: totalValue - totalCost,
                gainPercent: ((totalValue - totalCost) / totalCost) * 100
            }
        };
    }

    async updateWatchlists() {
        // Update prices for all watchlisted stocks
        for (const [userId, symbols] of this.watchlists) {
            for (const symbol of symbols) {
                await this.getStockPrice({ symbol });
            }
        }
    }

    async saveWatchlists() {
        const watchlistsObj = Object.fromEntries(this.watchlists);
        await this.api.storage.set('watchlists', watchlistsObj);
    }

    async savePortfolios() {
        const portfoliosObj = Object.fromEntries(this.portfolios);
        await this.api.storage.set('portfolios', portfoliosObj);
    }

    // Lifecycle methods
    async enable() {
        this.startUpdateTimer();
        this.logger.info('Stock Tracker Plugin enabled');
    }

    async disable() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
        this.logger.info('Stock Tracker Plugin disabled');
    }

    async cleanup() {
        await this.disable();
        await this.saveWatchlists();
        await this.savePortfolios();
        this.logger.info('Stock Tracker Plugin cleaned up');
    }
}

module.exports = StockTrackerPlugin;