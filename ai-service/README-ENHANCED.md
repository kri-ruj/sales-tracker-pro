# Enhanced ReAct Agent - Production Ready AI Assistant

A sophisticated AI agent using Google's Gemini API with the ReAct (Reasoning + Acting) framework, featuring real-time streaming, caching, authentication, and production-ready infrastructure.

## 🚀 Features

### Core Capabilities
- **ReAct Framework**: Step-by-step reasoning with thought-action-observation loops
- **Google Gemini Integration**: Powered by Gemini 1.5 Pro with native function calling
- **Real-time Streaming**: WebSocket support for live thought and action updates
- **Multiple Tools**: Web search, crypto prices, weather, country info, currency conversion

### Production Features
- **Authentication**: JWT tokens and API key management
- **Caching**: Redis-based caching with TTL management
- **Rate Limiting**: Per-user and global rate limits
- **Circuit Breakers**: Resilient external API calls
- **Retry Logic**: Exponential backoff with jitter
- **Database Storage**: PostgreSQL for chat history persistence
- **Monitoring**: Structured logging with Winston
- **Testing**: Unit and integration tests with Jest
- **Containerization**: Docker and Docker Compose support

## 📋 Prerequisites

- Node.js 18+ 
- Redis (optional, falls back to in-memory)
- PostgreSQL (optional, falls back to in-memory)
- Google Gemini API key

## 🛠️ Installation

1. Clone the repository:
```bash
cd ai-service
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env
```

4. Configure your `.env` file with your Gemini API key.

## 🚀 Quick Start

### Option 1: Run Locally

```bash
# Start the enhanced server
node react-agent-enhanced.js

# Server will be available at http://localhost:3000
```

### Option 2: Docker Compose (Recommended)

```bash
# Start all services (app, Redis, PostgreSQL)
docker-compose -f docker-compose.enhanced.yml up

# Access at http://localhost:3000
```

## 🌐 Web Interface

Open http://localhost:3000/chat-enhanced.html

Default credentials:
- Username: `demo`
- Password: `demo123`

## 🔧 API Endpoints

### Authentication
```bash
# Login
POST /auth/login
{
  "username": "demo",
  "password": "demo123"
}

# Register new user
POST /auth/register
{
  "username": "newuser",
  "password": "password123",
  "email": "user@example.com"
}
```

### ReAct Agent
```bash
# Execute query (requires authentication)
POST /api/react
Headers: Authorization: Bearer <token>
{
  "query": "What's the weather in Tokyo?",
  "sessionId": "optional-session-id"
}
```

### Chat History
```bash
# Get chat history
GET /api/chat/history?sessionId=xxx&limit=50
Headers: Authorization: Bearer <token>

# Get sessions
GET /api/chat/sessions?limit=20
Headers: Authorization: Bearer <token>
```

### Health & Stats
```bash
# Health check
GET /health

# Cache statistics
GET /api/cache/stats
Headers: Authorization: Bearer <token>
```

## 🔌 WebSocket Events

Connect to WebSocket with authentication:
```javascript
const socket = io('http://localhost:3000');
socket.emit('authenticate', { token: 'your-jwt-token' });
```

### Events
- `iteration-start`: New reasoning iteration begins
- `thought`: AI's reasoning process
- `action`: Tool execution with results
- `query-complete`: Final answer ready
- `query-error`: Error occurred

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## 📊 Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Client    │────▶│  Express Server │────▶│  Gemini API     │
│  (Socket.io)    │◀────│   (Port 3000)   │◀────│                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                    ┌──────────┴──────────┐
                    │                     │
              ┌─────▼─────┐        ┌─────▼─────┐
              │   Redis   │        │PostgreSQL │
              │  (Cache)  │        │(History)  │
              └───────────┘        └───────────┘
```

## 🛡️ Security Features

- JWT-based authentication
- API key management
- Rate limiting per user
- Input validation
- CORS configuration
- Helmet.js protection
- Environment variable management

## 🔄 Development

### Adding New Tools

1. Add tool definition in `EnhancedReActAgent` constructor:
```javascript
{
    name: "myNewTool",
    description: "Description of what it does",
    parameters: {
        type: "object",
        properties: {
            param1: { type: "string", description: "..." }
        },
        required: ["param1"]
    }
}
```

2. Implement the tool function:
```javascript
async myNewToolEnhanced({ param1 }) {
    // Implementation
    return {
        success: true,
        result: "..."
    };
}
```

3. Add to `executeFunction` switch case.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| GEMINI_API_KEY | Google Gemini API key | Required |
| PORT | Server port | 3000 |
| JWT_SECRET | JWT signing secret | Change in production |
| REDIS_HOST | Redis hostname | localhost |
| DB_HOST | PostgreSQL hostname | localhost |

## 📈 Monitoring

Logs are written to:
- `combined.log` - All logs
- `error.log` - Error logs only
- Console output with timestamps

## 🐳 Production Deployment

### Using Docker

```bash
# Build image
docker build -f Dockerfile.enhanced -t react-agent .

# Run container
docker run -p 3000:3000 --env-file .env react-agent
```

### Using Docker Compose

```bash
# Start production stack
docker-compose -f docker-compose.enhanced.yml up -d

# View logs
docker-compose -f docker-compose.enhanced.yml logs -f

# Stop services
docker-compose -f docker-compose.enhanced.yml down
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Ensure all tests pass
5. Submit a pull request

## 📝 License

MIT

## 🆘 Troubleshooting

### Redis Authentication Error
- The app works without Redis, it will fall back to in-memory caching
- To use Redis without auth: `redis-server --protected-mode no`

### PostgreSQL Connection Error
- The app works without PostgreSQL, using in-memory storage
- To create the database: `createdb ai_agent`

### WebSocket Connection Issues
- Ensure CORS is properly configured
- Check firewall settings for port 3000

## 📞 Support

For issues and questions:
- Create an issue in the repository
- Check logs in `enhanced-server.log`
- Review test output with `npm test`