# Enhanced ReAct Agent API Documentation

## Overview

This directory contains the OpenAPI/Swagger documentation for the Enhanced ReAct Agent API. The documentation provides comprehensive information about all available endpoints, authentication methods, request/response schemas, and WebSocket events.

## Documentation Access

Once the server is running, you can access the documentation at:

- **Interactive UI**: http://localhost:3000/api-docs
- **OpenAPI JSON**: http://localhost:3000/api-docs.json
- **OpenAPI YAML**: http://localhost:3000/api-docs.yaml
- **Examples**: http://localhost:3000/api-docs/examples
- **WebSocket Guide**: http://localhost:3000/api-docs/websocket
- **Demo Page**: http://localhost:3000/api-docs-demo.html

## Features

### 1. Interactive API Explorer
- Test API endpoints directly from the browser
- Automatic request/response examples
- Built-in authentication support
- Real-time validation

### 2. Comprehensive Documentation
- All endpoints documented with descriptions
- Request/response schemas with examples
- Authentication requirements clearly marked
- Error responses documented

### 3. WebSocket Documentation
- Complete WebSocket event reference
- Client implementation examples
- Real-time streaming documentation

### 4. Tool Reference
- All available AI tools documented
- Parameter descriptions and examples
- Usage guidelines

## Quick Start

### 1. Start the Server with Documentation

```bash
# Using the enhanced server with docs
node react-agent-enhanced-with-docs.js

# Or update your existing server
npm start
```

### 2. Access the Documentation

Open your browser and navigate to:
```
http://localhost:3000/api-docs
```

### 3. Authenticate

Use the demo credentials to test the API:
- Username: `demo`
- Password: `demo123`

Or register a new account through the `/api/auth/register` endpoint.

### 4. Try the API

1. Click on any endpoint to expand it
2. Click "Try it out"
3. Fill in the required parameters
4. Click "Execute"
5. View the response

## API Sections

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token

### AI Processing
- `POST /api/react` - Process AI queries with tool execution
- `POST /api/queue/ai` - Queue AI job for async processing
- `GET /api/queue/status/{queue}/{jobId}` - Check job status

### Chat Management
- `GET /api/chat/history` - Get chat history
- `GET /api/chat/sessions` - List recent sessions
- `GET /api/chat/session/{sessionId}` - Get specific session

### Export
- `POST /api/export/{sessionId}` - Export session data
- `GET /api/exports` - List available exports
- `GET /api/export/download/{filename}` - Download export file

### Admin
- `GET /api/admin/stats` - System statistics (admin only)
- `GET /api/admin/tools` - Tool usage statistics
- `GET /api/cache/stats` - Cache performance metrics

## WebSocket Events

### Client → Server
- `authenticate` - Authenticate the connection
- `query` - Submit a query for processing

### Server → Client
- `authenticated` - Authentication response
- `query-start` - Processing started
- `iteration-start` - ReAct iteration began
- `thought` - Agent reasoning stream
- `action` - Tool execution
- `observation` - Tool results
- `query-complete` - Final answer
- `query-error` - Error occurred

## Available Tools

The AI agent can use these tools:

1. **searchWeb** - Web search for current information
2. **getCryptoPrice** - Real-time cryptocurrency prices
3. **getWeather** - Current weather data
4. **getCountryInfo** - Country information
5. **convertCurrency** - Currency conversion
6. **calculate** - Mathematical calculations
7. **translateText** - Language translation
8. **readFile** - Read file contents
9. **writeFile** - Write to files
10. **processImage** - Image processing
11. **textToSpeech** - Convert text to audio
12. **generateRandomData** - Generate random data

## Example Requests

### Simple Query
```json
{
  "query": "What's the weather in Tokyo?",
  "sessionId": "optional-session-id"
}
```

### Complex Query with Multiple Tools
```json
{
  "query": "Get the weather in New York, convert the temperature to Celsius, and tell me if it's good for outdoor activities"
}
```

### File Operation
```json
{
  "query": "Create a file called notes.txt with a list of top 5 programming languages in 2024"
}
```

## Authentication

The API supports two authentication methods:

### 1. JWT Token (Recommended)
```bash
# Get token from login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "demo", "password": "demo123"}'

# Use token in requests
curl -X POST http://localhost:3000/api/react \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "Hello, AI!"}'
```

### 2. API Key
```bash
# Use API key in header
curl -X POST http://localhost:3000/api/react \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "Hello, AI!"}'
```

## Rate Limiting

- Default: 100 requests per 15 minutes per IP
- Authenticated users: Higher limits
- WebSocket: No rate limiting for established connections

## Error Handling

All errors follow a consistent format:
```json
{
  "success": false,
  "error": "Error message",
  "details": {}  // Optional additional information
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Rate Limit Exceeded
- `500` - Internal Server Error

## Development

### Adding New Endpoints

1. Add the endpoint to your route file
2. Add JSDoc comments for auto-documentation
3. Update the OpenAPI spec if needed

Example:
```javascript
/**
 * @swagger
 * /api/new-endpoint:
 *   post:
 *     tags:
 *       - Category
 *     summary: Short description
 *     description: Longer description
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               field:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 */
```

### Updating the OpenAPI Spec

The main specification is in `openapi.yaml`. After making changes:

1. Validate the spec:
```bash
npx @apidevtools/swagger-cli validate api-docs/openapi.yaml
```

2. Restart the server to see changes

## Troubleshooting

### Documentation not loading
- Check that the server is running
- Verify the port is correct (default: 3000)
- Check browser console for errors

### Authentication issues
- Ensure you're using the correct token format
- Check token expiration
- Verify credentials are correct

### CORS errors
- The API allows all origins by default
- For production, configure specific origins

## Support

For issues or questions:
1. Check the interactive documentation
2. Review example requests
3. Check server logs for errors
4. Open an issue on GitHub