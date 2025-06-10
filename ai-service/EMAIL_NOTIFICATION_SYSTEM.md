# Enhanced Email Notification System

This document describes the comprehensive email notification system integrated into the Enhanced ReAct Agent.

## Overview

The email notification system provides:
- Multi-provider support (Gmail, SendGrid, AWS SES, Custom SMTP)
- Rich HTML email templates with MJML
- Email tracking (opens, clicks)
- User preferences and unsubscribe management
- Bulk email capabilities
- Email analytics and admin dashboard
- Queue-based processing for reliability

## Quick Start

1. **Install dependencies** (already done):
   ```bash
   npm install
   ```

2. **Configure email service**:
   ```bash
   npm run setup:email
   ```

3. **Start the service with email support**:
   ```bash
   npm run start:email
   ```

4. **Access admin dashboard**:
   - Email Admin: http://localhost:3000/admin/email
   - Queue Dashboard: http://localhost:3000/admin/queues

## Email Providers

### Gmail Configuration
```env
DEFAULT_EMAIL_PROVIDER=gmail
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
```

**Setup Steps**:
1. Enable 2-factor authentication on Google account
2. Generate app password at https://myaccount.google.com/apppasswords
3. Use app password instead of regular password

### SendGrid Configuration
```env
DEFAULT_EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your-api-key
```

**Setup Steps**:
1. Sign up at https://sendgrid.com
2. Create API key with full access
3. Verify sender email/domain

### AWS SES Configuration
```env
DEFAULT_EMAIL_PROVIDER=ses
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
```

**Setup Steps**:
1. Verify email/domain in AWS SES console
2. Request production access
3. Configure SNS for bounce handling

### Custom SMTP Configuration
```env
DEFAULT_EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=username
SMTP_PASS=password
```

## Email Templates

### Available Templates

1. **Welcome Email** (`welcome`)
   - Sent to new users
   - Variables: `name`, `company`, `ctaUrl`

2. **Session Summary** (`sessionSummary`)
   - Sent after chat session ends
   - Variables: `sessionId`, `duration`, `queries`

3. **Error Notification** (`errorNotification`)
   - Sent when errors occur
   - Variables: `errorType`, `errorMessage`, `timestamp`, `stackTrace`

4. **Query Completion** (`queryCompletion`)
   - Sent after query processing
   - Variables: `queryId`, `query`, `processingTime`, `toolsUsed`, `result`

5. **Weekly Report** (`weeklyReport`)
   - Sent weekly to active users
   - Variables: `weekStart`, `weekEnd`, `stats`, `topTools`, `topQueries`

### Creating Custom Templates

Add templates to `services/enhanced-email.service.js`:

```javascript
const defaultTemplates = {
    myTemplate: {
        subject: 'Subject with {{variable}}',
        mjml: `
<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text>Hello {{name}}!</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
        text: 'Plain text version'
    }
};
```

## API Usage

### Send Single Email

```javascript
// Simple email
await emailService.sendEmail(
    'user@example.com',
    'Subject',
    {
        html: '<h1>Hello</h1>',
        text: 'Hello'
    }
);

// Template email
await emailService.sendTemplateEmail(
    'welcome',
    { name: 'John', company: 'ACME' },
    'user@example.com'
);
```

### Send Bulk Emails

```javascript
const emails = [
    { to: 'user1@example.com', subject: 'Hello', content: {...} },
    { to: 'user2@example.com', subject: 'Hello', content: {...} }
];

await emailService.sendBulkEmails(emails, {
    batchSize: 50
});
```

### User Preferences

```javascript
// Get preferences
const prefs = await emailService.getUserPreferences('user@example.com');

// Update preferences
await emailService.updateUserPreferences('user@example.com', {
    weekly_reports: false,
    query_completions: true
});
```

## Email Tracking

### Open Tracking
- Automatic pixel insertion in HTML emails
- Track via `/track/open/:messageId` endpoint

### Click Tracking
- Automatic link rewriting
- Track via `/track/click/:messageId/:linkIndex` endpoint

### Analytics Dashboard
Access detailed analytics at `/admin/email`:
- Total sent, open rates, click rates
- Bounce statistics
- User engagement metrics

## User Preferences

Users can control which emails they receive:
- `notifications_enabled`: Master switch
- `welcome_emails`: Welcome messages
- `session_summaries`: Session summaries
- `error_notifications`: Error alerts
- `query_completions`: Query completion notifications
- `weekly_reports`: Weekly usage reports
- `marketing_emails`: Marketing communications

## Admin Interface

The admin dashboard (`/admin/email`) provides:

### Dashboard View
- Email statistics (last 30 days)
- Provider status and health
- Quick stats (sent, opened, clicked, bounced)

### Email Logs
- Searchable email history
- Filter by email, template, status
- Resend failed emails

### Template Management
- View all templates
- Preview with test data
- See required variables

### Test Emails
- Send test emails
- Test specific templates
- Verify provider configuration

### Bulk Email
- Send to multiple recipients
- Use templates with personalization
- Monitor sending progress

### User Preferences
- View/edit user preferences
- Manage unsubscribes
- Set notification settings

### Bounce Management
- View bounce statistics
- Identify problematic addresses
- Automatic disable after multiple bounces

## Unsubscribe Handling

- One-click unsubscribe links in all emails
- Secure token-based unsubscribe
- Preference center for granular control
- Compliance with CAN-SPAM and GDPR

## Queue Processing

Emails are processed through Bull queues:
- Retry failed sends automatically
- Rate limiting to prevent spam
- Priority queuing for important emails
- Monitor via `/admin/queues`

## Error Handling

The system handles:
- Provider failures with fallback
- Invalid email addresses
- Bounce notifications
- Rate limiting
- Network timeouts

## Security Features

- Email validation before sending
- HTML sanitization
- Secure unsubscribe tokens
- Rate limiting per user
- Admin-only access to dashboard

## Testing

### Send Test Email
```bash
curl -X POST http://localhost:3000/api/email-admin/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "template": "welcome"
  }'
```

### Test Provider Configuration
```bash
curl http://localhost:3000/api/email-admin/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Monitoring

Monitor email system health:
- Queue dashboard: `/admin/queues`
- Email metrics: `/api/email-admin/dashboard`
- Provider status checks
- Bounce rate monitoring

## Best Practices

1. **Provider Selection**:
   - Use SendGrid/SES for production volumes
   - Gmail for development/small volumes
   - Multiple providers for redundancy

2. **Template Design**:
   - Use MJML for responsive emails
   - Always include text version
   - Test across email clients

3. **Deliverability**:
   - Verify sender domains
   - Monitor bounce rates
   - Implement SPF/DKIM/DMARC

4. **User Experience**:
   - Clear unsubscribe options
   - Respect user preferences
   - Batch similar notifications

## Troubleshooting

### Common Issues

1. **Emails not sending**:
   - Check provider credentials
   - Verify sender email is authorized
   - Check queue processing

2. **Low open rates**:
   - Check spam folder placement
   - Verify sender reputation
   - Improve subject lines

3. **Tracking not working**:
   - Verify tracking endpoint URL
   - Check email client settings
   - Ensure images are loaded

### Debug Mode

Enable debug logging:
```env
LOG_LEVEL=debug
EMAIL_DEBUG=true
```

## Environment Variables

```env
# Provider Selection
DEFAULT_EMAIL_PROVIDER=smtp

# Common Settings
DEFAULT_FROM_EMAIL=noreply@example.com
APP_URL=https://your-app.com
EMAIL_TRACKING_ENDPOINT=https://your-app.com/track
TEST_EMAIL=test@example.com
UNSUBSCRIBE_SECRET=random-secret-string

# SMTP Settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-password

# Gmail Settings
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password

# SendGrid Settings
SENDGRID_API_KEY=your-api-key

# AWS SES Settings
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1
SES_CONFIGURATION_SET=optional-config-set
```

## Migration Guide

To migrate from basic email to enhanced system:

1. Run setup script: `npm run setup:email`
2. Update imports in your code
3. Replace basic send calls with template sends
4. Set up user preferences
5. Configure tracking endpoints

## Support

For issues or questions:
1. Check logs in `email.log`
2. Review queue status at `/admin/queues`
3. Verify provider configuration
4. Test with simple email first