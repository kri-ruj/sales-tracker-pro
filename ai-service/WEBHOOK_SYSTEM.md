# Webhook System Documentation

## Overview

The Enhanced ReAct Agent now includes a comprehensive webhook system that allows external services to receive real-time notifications about various events occurring during agent execution.

## Features

- **Event-driven notifications**: Get notified when queries start/complete, tools execute, sessions begin/end, or errors occur
- **Reliable delivery**: Automatic retry with exponential backoff for failed deliveries
- **Security**: HMAC-SHA256 signature verification for webhook payloads
- **Flexible subscription**: Subscribe to specific events or all events
- **Delivery tracking**: Monitor webhook delivery status and history
- **Testing tools**: Built-in webhook receiver for testing

## Supported Events

### 1. `query.started`
Triggered when a new query begins processing.

**Payload:**
```json
{
  "id": "event-uuid",
  "type": "query.started",
  "payload": {
    "sessionId": "session-id",
    "userId": "user-id",
    "query": "User's query text",
    "timestamp": "2024-01-10T12:00:00Z"
  },
  "timestamp": "2024-01-10T12:00:00Z"
}
```

### 2. `query.completed`
Triggered when a query finishes processing.

**Payload:**
```json
{
  "id": "event-uuid",
  "type": "query.completed",
  "payload": {
    "sessionId": "session-id",
    "userId": "user-id",
    "query": "User's query text",
    "answer": "Agent's response",
    "iterations": 3,
    "executionTime": 2543,
    "toolsUsed": ["searchWeb", "getCryptoPrice"],
    "timestamp": "2024-01-10T12:00:03Z"
  },
  "timestamp": "2024-01-10T12:00:03Z"
}
```

### 3. `tool.executed`
Triggered when a tool is executed.

**Payload:**
```json
{
  "id": "event-uuid",
  "type": "tool.executed",
  "payload": {
    "sessionId": "session-id",
    "tool": "searchWeb",
    "args": { "query": "latest news" },
    "result": { "success": true, "data": "..." },
    "iteration": 2,
    "timestamp": "2024-01-10T12:00:01Z"
  },
  "timestamp": "2024-01-10T12:00:01Z"
}
```

### 4. `session.created`
Triggered when a new session is created.

**Payload:**
```json
{
  "id": "event-uuid",
  "type": "session.created",
  "payload": {
    "sessionId": "session-id",
    "userId": "user-id",
    "timestamp": "2024-01-10T12:00:00Z"
  },
  "timestamp": "2024-01-10T12:00:00Z"
}
```

### 5. `session.ended`
Triggered when a session ends.

**Payload:**
```json
{
  "id": "event-uuid",
  "type": "session.ended",
  "payload": {
    "sessionId": "session-id",
    "userId": "user-id",
    "timestamp": "2024-01-10T12:10:00Z"
  },
  "timestamp": "2024-01-10T12:10:00Z"
}
```

### 6. `error.occurred`
Triggered when an error occurs during execution.

**Payload:**
```json
{
  "id": "event-uuid",
  "type": "error.occurred",
  "payload": {
    "sessionId": "session-id",
    "userId": "user-id",
    "query": "User's query text",
    "error": "Error message",
    "stack": "Error stack trace",
    "timestamp": "2024-01-10T12:00:02Z"
  },
  "timestamp": "2024-01-10T12:00:02Z"
}
```

## API Endpoints

### Create Webhook
```http
POST /api/webhooks
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://your-server.com/webhook",
  "events": ["query.started", "query.completed"],
  "description": "Production webhook",
  "headers": {
    "X-Custom-Header": "value"
  }
}
```

### List Webhooks
```http
GET /api/webhooks
Authorization: Bearer <token>
```

### Get Webhook Details
```http
GET /api/webhooks/:webhookId
Authorization: Bearer <token>
```

### Update Webhook
```http
PUT /api/webhooks/:webhookId
Authorization: Bearer <token>
Content-Type: application/json

{
  "events": ["query.completed", "error.occurred"],
  "active": false
}
```

### Delete Webhook
```http
DELETE /api/webhooks/:webhookId
Authorization: Bearer <token>
```

### Test Webhook
```http
POST /api/webhooks/:webhookId/test
Authorization: Bearer <token>
```

### Get Delivery History
```http
GET /api/webhooks/:webhookId/deliveries?limit=100&status=failed
Authorization: Bearer <token>
```

### Get Webhook Statistics
```http
GET /api/webhooks/:webhookId/stats
Authorization: Bearer <token>
```

### Pause/Resume Webhook
```http
POST /api/webhooks/:webhookId/pause
POST /api/webhooks/:webhookId/resume
Authorization: Bearer <token>
```

## Webhook Headers

Each webhook delivery includes the following headers:

- `Content-Type`: `application/json`
- `X-Webhook-Event`: The event type (e.g., `query.completed`)
- `X-Webhook-Signature`: HMAC-SHA256 signature of the payload
- `X-Webhook-Delivery`: Unique delivery ID
- `X-Webhook-Timestamp`: Event timestamp

## Signature Verification

Webhooks include an HMAC-SHA256 signature for security. To verify:

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');
    
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );
}
```

## Retry Policy

Failed webhook deliveries are automatically retried with exponential backoff:

- Maximum retries: 5
- Initial delay: 1 second
- Maximum delay: 60 seconds
- Backoff multiplier: 2

Retry schedule: 1s, 2s, 4s, 8s, 16s

## Testing

### 1. Start the webhook receiver:
```bash
cd ai-service/demo
node webhook-receiver.js
```

### 2. Open the webhook management UI:
```bash
# In your browser
http://localhost:3000/demo/webhook-demo.html
```

### 3. Create a test webhook:
- URL: `http://localhost:3001/webhook`
- Select events to monitor
- Click "Create Webhook"

### 4. Test the webhook:
Use the agent normally and watch events appear in the receiver.

## Example Integration

### Node.js/Express
```javascript
app.post('/webhook', (req, res) => {
    const signature = req.headers['x-webhook-signature'];
    const event = req.headers['x-webhook-event'];
    
    // Verify signature
    if (!verifyWebhookSignature(req.body, signature, WEBHOOK_SECRET)) {
        return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Process event
    switch (event) {
        case 'query.completed':
            console.log('Query completed:', req.body.payload);
            // Your logic here
            break;
        case 'error.occurred':
            console.error('Error occurred:', req.body.payload);
            // Your error handling here
            break;
    }
    
    // Acknowledge receipt
    res.status(200).json({ received: true });
});
```

### Python/Flask
```python
import hmac
import hashlib
import json
from flask import Flask, request

app = Flask(__name__)

def verify_signature(payload, signature, secret):
    expected = hmac.new(
        secret.encode(),
        json.dumps(payload).encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)

@app.route('/webhook', methods=['POST'])
def webhook():
    signature = request.headers.get('X-Webhook-Signature')
    event = request.headers.get('X-Webhook-Event')
    
    # Verify signature
    if not verify_signature(request.json, signature, WEBHOOK_SECRET):
        return {'error': 'Invalid signature'}, 401
    
    # Process event
    if event == 'query.completed':
        print(f"Query completed: {request.json['payload']}")
    
    return {'received': True}, 200
```

## Best Practices

1. **Always verify signatures** to ensure webhooks are from the legitimate source
2. **Respond quickly** (< 30 seconds) to avoid timeouts
3. **Use idempotent processing** as webhooks may be delivered multiple times
4. **Log webhook receipts** for debugging and audit purposes
5. **Handle errors gracefully** and return appropriate status codes
6. **Use HTTPS endpoints** for production webhooks
7. **Monitor delivery statistics** to ensure reliability

## Troubleshooting

### Webhook not receiving events
1. Check if the webhook is active
2. Verify the URL is accessible from the agent server
3. Check delivery history for errors
4. Test the webhook using the test endpoint

### Signature verification failing
1. Ensure you're using the correct secret
2. Verify you're comparing the raw request body
3. Check for encoding issues

### High failure rate
1. Check your endpoint's response time
2. Verify your server can handle the load
3. Check for network issues
4. Review error messages in delivery history

## Database Schema

The webhook system uses the following database tables:

- `webhooks`: Stores webhook configurations
- `webhook_deliveries`: Tracks delivery attempts and status
- `webhook_events`: Stores event history

## Performance Considerations

- Webhook deliveries are processed asynchronously
- Failed deliveries are queued and retried
- The system can handle thousands of webhooks
- Events are stored for up to 30 days
- Delivery history is kept for up to 90 days

## Security Considerations

- All webhook URLs must use HTTPS in production
- Secrets are generated using cryptographically secure random bytes
- Signatures use HMAC-SHA256 for integrity verification
- API endpoints require authentication
- Rate limiting prevents abuse