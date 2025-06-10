class WeatherAdvancedPlugin {
    constructor() {
        this.name = 'Advanced Weather Plugin';
        this.providers = {
            openweather: 'https://api.openweathermap.org/data/2.5',
            weatherapi: 'https://api.weatherapi.com/v1'
        };
        this.config = {};
        this.api = null;
    }

    async init(api) {
        this.api = api;
        this.logger = api.logger;
        
        // Load configuration
        this.config = await api.storage.get('config') || {
            providers: ['openweather', 'weatherapi'],
            cacheDuration: 300,
            units: 'metric',
            apiKeys: {}
        };
        
        // Register tools
        this.registerTools();
        
        // Subscribe to events
        this.subscribeToEvents();
        
        this.logger.info('Weather Advanced Plugin initialized');
    }

    registerTools() {
        // Current weather tool
        this.api.registerTool({
            name: 'getCurrentWeather',
            description: 'Get current weather with detailed information from multiple providers',
            parameters: {
                type: 'object',
                properties: {
                    location: {
                        type: 'string',
                        description: 'City name or coordinates (lat,lon)'
                    },
                    detailed: {
                        type: 'boolean',
                        description: 'Include detailed weather data',
                        default: false
                    }
                },
                required: ['location']
            },
            handler: this.getCurrentWeather.bind(this)
        });

        // Weather forecast tool
        this.api.registerTool({
            name: 'getWeatherForecast',
            description: 'Get weather forecast for up to 7 days',
            parameters: {
                type: 'object',
                properties: {
                    location: {
                        type: 'string',
                        description: 'City name or coordinates'
                    },
                    days: {
                        type: 'number',
                        description: 'Number of days (1-7)',
                        default: 3
                    },
                    hourly: {
                        type: 'boolean',
                        description: 'Include hourly forecast',
                        default: false
                    }
                },
                required: ['location']
            },
            handler: this.getWeatherForecast.bind(this)
        });

        // Weather alerts tool
        this.api.registerTool({
            name: 'getWeatherAlerts',
            description: 'Get active weather alerts for a location',
            parameters: {
                type: 'object',
                properties: {
                    location: {
                        type: 'string',
                        description: 'City name or coordinates'
                    }
                },
                required: ['location']
            },
            handler: this.getWeatherAlerts.bind(this)
        });

        // Historical weather tool
        this.api.registerTool({
            name: 'getHistoricalWeather',
            description: 'Get historical weather data',
            parameters: {
                type: 'object',
                properties: {
                    location: {
                        type: 'string',
                        description: 'City name or coordinates'
                    },
                    date: {
                        type: 'string',
                        description: 'Date in YYYY-MM-DD format'
                    }
                },
                required: ['location', 'date']
            },
            handler: this.getHistoricalWeather.bind(this)
        });
    }

    subscribeToEvents() {
        // Log weather queries
        this.api.events.on('tool:execute', (data) => {
            if (data.tool && data.tool.startsWith('weather-advanced_')) {
                this.logger.info('Weather tool executed', {
                    tool: data.tool,
                    location: data.args?.location
                });
            }
        });
    }

    async getCurrentWeather({ location, detailed = false }) {
        try {
            // Check cache first
            const cacheKey = `weather:current:${location}:${detailed}`;
            if (this.api.cache) {
                const cached = await this.api.cache.get('weather-advanced', { key: cacheKey });
                if (cached) {
                    return cached;
                }
            }

            // Fetch from multiple providers
            const results = await Promise.allSettled(
                this.config.providers.map(provider => 
                    this.fetchCurrentWeather(provider, location)
                )
            );

            // Aggregate results
            const successfulResults = results
                .filter(r => r.status === 'fulfilled')
                .map(r => r.value);

            if (successfulResults.length === 0) {
                throw new Error('Failed to fetch weather from all providers');
            }

            // Merge and enhance data
            const weatherData = this.mergeWeatherData(successfulResults, detailed);

            // Cache result
            if (this.api.cache) {
                await this.api.cache.set(
                    'weather-advanced',
                    { key: cacheKey },
                    weatherData,
                    { ttl: this.config.cacheDuration }
                );
            }

            return {
                success: true,
                location: weatherData.location,
                current: weatherData.current,
                providers: weatherData.providers,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to get current weather', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getWeatherForecast({ location, days = 3, hourly = false }) {
        try {
            const forecasts = [];
            
            // Fetch from available providers
            for (const provider of this.config.providers) {
                try {
                    const forecast = await this.fetchForecast(provider, location, days);
                    if (forecast) {
                        forecasts.push(forecast);
                    }
                } catch (error) {
                    this.logger.warn(`Failed to get forecast from ${provider}`, error);
                }
            }

            if (forecasts.length === 0) {
                throw new Error('No forecast data available');
            }

            // Process and merge forecasts
            const mergedForecast = this.mergeForecastData(forecasts, hourly);

            return {
                success: true,
                location: mergedForecast.location,
                days: mergedForecast.days,
                forecast: mergedForecast.forecast,
                hourly: hourly ? mergedForecast.hourly : undefined
            };

        } catch (error) {
            this.logger.error('Failed to get weather forecast', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getWeatherAlerts({ location }) {
        try {
            const alerts = [];
            
            // Fetch alerts from providers that support it
            for (const provider of this.config.providers) {
                try {
                    const providerAlerts = await this.fetchAlerts(provider, location);
                    if (providerAlerts && providerAlerts.length > 0) {
                        alerts.push(...providerAlerts);
                    }
                } catch (error) {
                    this.logger.warn(`Failed to get alerts from ${provider}`, error);
                }
            }

            // Deduplicate alerts
            const uniqueAlerts = this.deduplicateAlerts(alerts);

            return {
                success: true,
                location,
                alerts: uniqueAlerts,
                count: uniqueAlerts.length,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to get weather alerts', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getHistoricalWeather({ location, date }) {
        try {
            // Validate date
            const requestDate = new Date(date);
            const now = new Date();
            
            if (requestDate > now) {
                throw new Error('Cannot get historical data for future dates');
            }

            // Check if date is within supported range (usually last 30 days)
            const daysDiff = Math.floor((now - requestDate) / (1000 * 60 * 60 * 24));
            if (daysDiff > 30) {
                throw new Error('Historical data only available for last 30 days');
            }

            // Fetch historical data
            const historicalData = await this.fetchHistoricalWeather(location, date);

            return {
                success: true,
                location,
                date,
                weather: historicalData,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to get historical weather', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Provider-specific fetch methods
    async fetchCurrentWeather(provider, location) {
        // Implementation would include actual API calls to weather providers
        // This is a mock implementation
        return {
            provider,
            location: {
                name: location,
                country: 'US',
                coordinates: { lat: 0, lon: 0 }
            },
            current: {
                temperature: 22,
                feelsLike: 20,
                humidity: 65,
                pressure: 1013,
                windSpeed: 15,
                windDirection: 'NW',
                condition: 'Partly cloudy',
                icon: '02d',
                uv: 5
            }
        };
    }

    async fetchForecast(provider, location, days) {
        // Mock forecast data
        const forecast = [];
        const baseTemp = 20;
        
        for (let i = 0; i < days; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            
            forecast.push({
                date: date.toISOString().split('T')[0],
                temperature: {
                    min: baseTemp - 5 + Math.random() * 3,
                    max: baseTemp + 5 + Math.random() * 3
                },
                condition: ['Sunny', 'Cloudy', 'Rainy', 'Partly cloudy'][Math.floor(Math.random() * 4)],
                precipitation: Math.random() * 100,
                humidity: 50 + Math.random() * 30
            });
        }
        
        return {
            provider,
            location,
            forecast
        };
    }

    async fetchAlerts(provider, location) {
        // Mock alerts - in production would fetch from real APIs
        return [
            {
                provider,
                title: 'Heat Advisory',
                severity: 'moderate',
                areas: [location],
                onset: new Date().toISOString(),
                expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                description: 'High temperatures expected. Stay hydrated.'
            }
        ];
    }

    async fetchHistoricalWeather(location, date) {
        // Mock historical data
        return {
            temperature: {
                min: 15,
                max: 25,
                avg: 20
            },
            precipitation: 0,
            humidity: 60,
            condition: 'Sunny'
        };
    }

    // Data processing methods
    mergeWeatherData(results, detailed) {
        // Average values from multiple providers
        const temps = results.map(r => r.current.temperature);
        const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
        
        const merged = {
            location: results[0].location,
            current: {
                temperature: Math.round(avgTemp * 10) / 10,
                feelsLike: Math.round(results[0].current.feelsLike * 10) / 10,
                condition: results[0].current.condition,
                humidity: results[0].current.humidity,
                pressure: results[0].current.pressure,
                windSpeed: results[0].current.windSpeed,
                windDirection: results[0].current.windDirection
            },
            providers: results.map(r => r.provider)
        };
        
        if (detailed) {
            merged.detailed = {
                uv: results[0].current.uv,
                visibility: 10,
                dewPoint: 15,
                cloudCover: 25
            };
        }
        
        return merged;
    }

    mergeForecastData(forecasts, includeHourly) {
        // Merge forecast data from multiple providers
        const firstForecast = forecasts[0];
        
        return {
            location: firstForecast.location,
            days: firstForecast.forecast.length,
            forecast: firstForecast.forecast,
            hourly: includeHourly ? this.generateHourlyForecast() : undefined
        };
    }

    generateHourlyForecast() {
        // Generate mock hourly forecast
        const hourly = [];
        for (let i = 0; i < 24; i++) {
            const time = new Date();
            time.setHours(time.getHours() + i);
            
            hourly.push({
                time: time.toISOString(),
                temperature: 18 + Math.random() * 10,
                precipitation: Math.random() * 20,
                condition: ['Clear', 'Cloudy', 'Rainy'][Math.floor(Math.random() * 3)]
            });
        }
        return hourly;
    }

    deduplicateAlerts(alerts) {
        // Remove duplicate alerts based on title and severity
        const seen = new Set();
        return alerts.filter(alert => {
            const key = `${alert.title}:${alert.severity}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    // Lifecycle methods
    async enable() {
        this.logger.info('Weather Advanced Plugin enabled');
    }

    async disable() {
        this.logger.info('Weather Advanced Plugin disabled');
    }

    async cleanup() {
        // Clean up any resources
        this.logger.info('Weather Advanced Plugin cleaned up');
    }
}

module.exports = WeatherAdvancedPlugin;