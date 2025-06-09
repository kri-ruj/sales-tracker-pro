# Email Integration Documentation

This directory contains email integrations for the AI service, supporting multiple email providers through a unified interface.

## Available Integrations

### 1. Gmail Integration (`gmail.integration.js`)
- Uses Google Gmail API
- Supports OAuth2 authentication
- Features: Send, search, drafts, labels

### 2. Outlook Integration (`outlook.integration.js`)
- Uses Microsoft Graph API
- Supports Azure AD authentication
- Features: Send, search, drafts, folders, categories, read receipts

### 3. SMTP Integration (`smtp.integration.js`)
- Universal SMTP support via nodemailer
- Works with any SMTP server
- Features: Send, bulk send, templates, multiple providers

## Unified Email Service

The `email.service.js` provides a unified interface for all email providers:

```javascript
const emailService = require('./services/email.service');

// Send email using default provider
await emailService.sendEmail({
    to: 'recipient@example.com',
    subject: 'Hello',
    html: '<h1>Hello World</h1>'
});

// Send using specific provider
await emailService.sendEmail(emailData, { provider: 'gmail' });

// Send bulk emails
await emailService.sendBulkEmails(emailArray);

// Send template email
await emailService.sendTemplateEmail('welcome', {
    name: 'John Doe',
    company: 'Acme Corp'
}, { to: 'john@example.com' });
```

## Configuration

### Environment Variables

#### Gmail Configuration
```bash
# Gmail OAuth2 credentials
GOOGLE_GMAIL_CREDENTIALS=./credentials/gmail-credentials.json
GOOGLE_GMAIL_TOKEN=./credentials/gmail-token.json
GMAIL_ENABLED=true
```

#### Outlook Configuration
```bash
# Microsoft Azure AD App Registration
OUTLOOK_CLIENT_ID=your-client-id
OUTLOOK_CLIENT_SECRET=your-client-secret
OUTLOOK_TENANT_ID=your-tenant-id  # or 'common' for multi-tenant
OUTLOOK_ENABLED=true
```

#### SMTP Configuration
```bash
# Default SMTP settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM_EMAIL=noreply@example.com

# Provider-specific SMTP (optional)
SMTP_GMAIL_USER=gmail-user@gmail.com
SMTP_GMAIL_PASS=gmail-app-password
SMTP_OUTLOOK_USER=outlook-user@outlook.com
SMTP_OUTLOOK_PASS=outlook-password

# Default email provider
DEFAULT_EMAIL_PROVIDER=smtp  # gmail, outlook, or smtp
```

## Usage Examples

### 1. Basic Email Sending

```javascript
// Gmail
const gmail = new GmailIntegration();
await gmail.run({
    operation: 'sendEmail',
    emailData: {
        to: 'recipient@example.com',
        subject: 'Test Email',
        body: 'This is a test email',
        isHtml: false
    }
});

// Outlook with features
const outlook = new OutlookIntegration();
await outlook.run({
    operation: 'sendEmail',
    emailData: {
        to: ['recipient1@example.com', 'recipient2@example.com'],
        subject: 'Important: Project Update',
        body: '<h1>Project Status</h1><p>Everything is on track!</p>',
        isHtml: true,
        importance: 'high',
        categories: ['Projects', 'Updates'],
        requestReadReceipt: true
    }
});

// SMTP with custom provider
const smtp = new SMTPIntegration();
await smtp.run({
    operation: 'sendEmail',
    provider: 'gmail',  // uses Gmail SMTP preset
    emailData: {
        to: 'recipient@example.com',
        subject: 'Hello from SMTP',
        html: '<p>This email was sent via SMTP</p>'
    }
});
```

### 2. Bulk Email Sending

```javascript
const emails = [
    { to: 'user1@example.com', subject: 'Newsletter', html: '<p>Content 1</p>' },
    { to: 'user2@example.com', subject: 'Newsletter', html: '<p>Content 2</p>' },
    // ... more emails
];

// Using SMTP (recommended for bulk)
await smtp.run({
    operation: 'sendBulkEmails',
    bulkEmails: emails
});

// Using unified service
await emailService.sendBulkEmails(emails);
```

### 3. Email Templates

```javascript
// Send welcome email
await emailService.sendTemplateEmail('welcome', {
    name: 'John Doe',
    company: 'Acme Corporation'
}, {
    to: 'john@example.com'
});

// Using SMTP directly
await smtp.run({
    operation: 'sendTemplate',
    template: {
        name: 'invoice',
        variables: {
            invoiceNumber: 'INV-001',
            customerName: 'John Doe',
            amount: '$1,234.56',
            dueDate: '2024-02-01',
            company: 'Acme Corp'
        }
    },
    emailData: {
        to: 'customer@example.com',
        attachments: [{
            filename: 'invoice.pdf',
            path: '/path/to/invoice.pdf'
        }]
    }
});
```

### 4. Email Search (Gmail/Outlook only)

```javascript
// Gmail search
await gmail.run({
    operation: 'searchEmails',
    searchQuery: 'from:important@example.com subject:urgent',
    maxResults: 20
});

// Outlook search with OData filter
await outlook.run({
    operation: 'searchEmails',
    searchQuery: "subject eq 'Meeting' and importance eq 'high'",
    maxResults: 10
});
```

### 5. Folder Management (Outlook only)

```javascript
// Create folder
await outlook.run({
    operation: 'createFolder',
    folderName: 'Project X'
});

// List folders
const folders = await outlook.run({
    operation: 'listFolders'
});

// Move email to folder
await outlook.run({
    operation: 'moveEmail',
    emailId: 'message-id',
    folderId: 'folder-id'
});
```

### 6. Attachments

```javascript
// With file path
const emailWithAttachment = {
    to: 'recipient@example.com',
    subject: 'Document Attached',
    html: '<p>Please find the document attached.</p>',
    attachments: [{
        filename: 'report.pdf',
        path: '/path/to/report.pdf'
    }]
};

// With base64 content
const emailWithBase64 = {
    to: 'recipient@example.com',
    subject: 'Image Attached',
    html: '<p>Here is the image.</p>',
    attachments: [{
        filename: 'image.png',
        content: 'base64-encoded-content-here',
        contentType: 'image/png'
    }]
};

// Inline images (SMTP/Outlook)
const emailWithInline = {
    to: 'recipient@example.com',
    subject: 'Newsletter',
    html: '<p>Check out our logo:</p><img src="cid:logo123">',
    attachments: [{
        filename: 'logo.png',
        path: '/path/to/logo.png',
        cid: 'logo123',
        isInline: true
    }]
};
```

### 7. Custom SMTP Configuration

```javascript
// Using custom SMTP server
await smtp.run({
    operation: 'sendEmail',
    smtpConfig: {
        host: 'mail.company.com',
        port: 465,
        secure: true,
        auth: {
            user: 'user@company.com',
            pass: 'password'
        }
    },
    emailData: {
        from: 'noreply@company.com',
        to: 'customer@example.com',
        subject: 'Custom SMTP Test',
        text: 'This was sent via custom SMTP server'
    }
});
```

### 8. Connection Verification

```javascript
// Verify SMTP connection
await smtp.run({
    operation: 'verifyConnection',
    provider: 'gmail'
});

// Verify via unified service
await emailService.verifyConnection('smtp');
```

## Provider Comparison

| Feature | Gmail | Outlook | SMTP |
|---------|-------|---------|------|
| Send Email | ✓ | ✓ | ✓ |
| Bulk Send | ✓ (limited) | ✓ (limited) | ✓ (optimized) |
| Search | ✓ | ✓ | ✗ |
| Drafts | ✓ | ✓ | ✗ |
| Folders | ✓ (labels) | ✓ | ✗ |
| Categories | ✗ | ✓ | ✗ |
| Read Receipts | ✗ | ✓ | ✗ |
| Templates | ✗ | ✗ | ✓ |
| Custom SMTP | ✗ | ✗ | ✓ |
| Attachments | ✓ | ✓ | ✓ |
| Inline Images | ✓ | ✓ | ✓ |
| Priority | ✗ | ✓ | ✓ |

## Error Handling

All integrations include comprehensive error handling:

```javascript
try {
    await emailService.sendEmail(emailData);
} catch (error) {
    console.error('Email error:', error.message);
    
    // The service automatically retries with fallback providers
    // You can disable this:
    await emailService.sendEmail(emailData, { fallback: false });
}
```

## Mock Mode

All integrations support mock mode for development:

```javascript
// Enable mock mode by setting NODE_ENV=development
// or by not providing required credentials

// Mock responses include realistic data:
{
    success: true,
    messageId: 'mock-msg-1234567890',
    summary: '[MOCK] Email sent to recipient@example.com',
    details: {
        to: 'recipient@example.com',
        subject: 'Test Email',
        timestamp: '2024-01-01T12:00:00.000Z'
    }
}
```

## Security Best Practices

1. **Never commit credentials** - Use environment variables
2. **Use app-specific passwords** - Not your main account password
3. **Implement rate limiting** - Especially for bulk operations
4. **Validate email addresses** - Before sending
5. **Sanitize HTML content** - Prevent XSS in email bodies
6. **Use secure connections** - TLS/SSL for SMTP
7. **Monitor send rates** - Stay within provider limits

## Provider Limits

- **Gmail API**: 250 quota units per user per second
- **Outlook/Graph**: 10,000 requests per 10 minutes
- **SMTP**: Varies by provider (Gmail: 500/day, Outlook: 300/day)

## Troubleshooting

### Gmail Issues
- Ensure OAuth2 consent screen is configured
- Check API is enabled in Google Cloud Console
- Verify redirect URIs match your application

### Outlook Issues
- Check Azure AD app permissions (Mail.Send, Mail.Read)
- Ensure correct tenant ID (use 'common' for personal accounts)
- Verify reply URLs in app registration

### SMTP Issues
- Use app-specific passwords, not regular passwords
- Check firewall rules for SMTP ports
- Enable "less secure apps" if required (not recommended)
- Verify SSL/TLS settings match server requirements

## Advanced Features

### Connection Pooling (SMTP)
The SMTP integration maintains a connection pool for better performance:

```javascript
// Connections are reused based on configuration
// Different configs maintain separate connections
```

### Retry Logic
All integrations support automatic retry with exponential backoff:

```javascript
// Configure in tool initialization
retryable: true,
maxRetries: 3,
timeout: 30000
```

### Rate Limiting
Implement rate limiting for production use:

```javascript
const RateLimiter = require('your-rate-limiter');
const limiter = new RateLimiter({
    points: 100,  // Number of emails
    duration: 3600  // Per hour
});

// Check before sending
await limiter.consume(userId, 1);
await emailService.sendEmail(emailData);
```