# Calendar Integrations

This directory contains calendar integrations for the AI service, providing seamless connectivity with Google Calendar and Microsoft Outlook.

## Available Integrations

### 1. Google Calendar Integration (`google-calendar.integration.js`)

Provides comprehensive Google Calendar functionality using the Google Calendar API v3.

**Features:**
- Create, read, update, and delete calendar events
- List events with filtering and pagination
- Check availability and calculate free/busy times
- Support for recurring events and reminders
- Conference/meeting link generation (Google Meet)
- Rate limiting protection (1,800 requests/minute)
- Mock mode for development

**Operations:**
- `createEvent` - Create a new calendar event
- `listEvents` - List calendar events with filters
- `getEvent` - Get specific event details
- `updateEvent` - Update existing event
- `deleteEvent` - Delete an event
- `checkAvailability` - Check time slot availability
- `getFreeBusy` - Get free/busy info for multiple calendars

### 2. Microsoft Outlook Integration (`outlook-calendar.integration.js`)

Provides full Outlook/Exchange calendar functionality using Microsoft Graph API.

**Features:**
- Complete event management (CRUD operations)
- Intelligent meeting time suggestions
- Meeting room discovery and booking
- Attendee availability checking
- Teams meeting integration
- Support for categories and importance levels
- Rate limiting protection (120 requests/minute)
- Mock mode for development

**Operations:**
- `createEvent` - Create a new calendar event
- `listEvents` - List calendar events with OData filters
- `getEvent` - Get specific event details
- `updateEvent` - Update existing event
- `deleteEvent` - Delete an event
- `checkAvailability` - Check calendar availability
- `findMeetingTimes` - AI-powered meeting time suggestions
- `getMeetingRooms` - Discover available meeting rooms

## Setup Instructions

### Google Calendar Setup

1. **Create Google Cloud Project:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable Google Calendar API

2. **Create OAuth2 Credentials:**
   - Navigate to APIs & Services > Credentials
   - Create OAuth 2.0 Client ID
   - Set redirect URI to `http://localhost:3000/oauth2callback`
   - Download credentials JSON

3. **Configure Environment:**
   ```bash
   # Save credentials
   mkdir -p ./credentials
   mv ~/Downloads/credentials.json ./credentials/google-calendar-credentials.json
   
   # Set environment variables
   export GOOGLE_CALENDAR_CREDENTIALS="./credentials/google-calendar-credentials.json"
   export GOOGLE_CALENDAR_TOKEN="./credentials/google-calendar-token.json"
   ```

4. **First-time Authentication:**
   - Run the integration once
   - Follow the OAuth flow in your browser
   - Token will be saved automatically

### Microsoft Outlook Setup

1. **Register Azure AD Application:**
   - Go to [Azure Portal](https://portal.azure.com/)
   - Navigate to Azure Active Directory > App registrations
   - Create new registration
   - Note the Application (client) ID and Directory (tenant) ID

2. **Configure API Permissions:**
   - Add Microsoft Graph permissions:
     - Calendars.ReadWrite
     - User.Read
     - Place.Read.All (for meeting rooms)
   - Grant admin consent

3. **Create Client Secret:**
   - Go to Certificates & secrets
   - Create new client secret
   - Copy the secret value immediately

4. **Configure Environment:**
   ```bash
   # Set environment variables
   export AZURE_CLIENT_ID="your-client-id"
   export AZURE_TENANT_ID="your-tenant-id"
   export AZURE_CLIENT_SECRET="your-client-secret"
   ```

## Usage Examples

### Google Calendar

```javascript
const GoogleCalendarIntegration = require('./google-calendar.integration');
const calendar = new GoogleCalendarIntegration();

// Create an event
const result = await calendar.run({
    operation: 'createEvent',
    calendarId: 'primary',
    eventData: {
        summary: 'Team Meeting',
        description: 'Weekly team sync',
        start: '2024-01-15T10:00:00',
        end: '2024-01-15T11:00:00',
        attendees: ['team@example.com'],
        createMeet: true
    },
    timeZone: 'America/New_York'
});

// Check availability
const availability = await calendar.run({
    operation: 'checkAvailability',
    timeMin: '2024-01-15T09:00:00',
    timeMax: '2024-01-15T17:00:00',
    timeZone: 'America/New_York'
});
```

### Microsoft Outlook

```javascript
const OutlookCalendarIntegration = require('./outlook-calendar.integration');
const outlook = new OutlookCalendarIntegration();

// Find meeting times
const suggestions = await outlook.run({
    operation: 'findMeetingTimes',
    meetingRequest: {
        attendees: [
            { emailAddress: { address: 'user1@company.com' }, type: 'required' },
            { emailAddress: { address: 'user2@company.com' }, type: 'optional' }
        ],
        meetingDuration: 'PT1H',
        timeConstraint: {
            timeslots: [{
                start: { dateTime: '2024-01-15T09:00:00', timeZone: 'UTC' },
                end: { dateTime: '2024-01-15T17:00:00', timeZone: 'UTC' }
            }]
        }
    }
});

// Get meeting rooms
const rooms = await outlook.run({
    operation: 'getMeetingRooms'
});
```

## Development Mode

Both integrations support mock mode for development and testing:

```bash
# Enable mock mode
export NODE_ENV=development
# or
export GOOGLE_CALENDAR_MOCK=true
export OUTLOOK_MOCK=true
```

In mock mode, the integrations return realistic sample data without making actual API calls.

## Error Handling

Both integrations include:
- Comprehensive error logging
- Automatic retry with exponential backoff
- Rate limiting protection
- Timeout handling (30 seconds default)
- Graceful fallback to mock mode on initialization failure

## Security Considerations

1. **Credentials Storage:**
   - Never commit credentials to version control
   - Use environment variables for sensitive data
   - Store tokens securely with appropriate permissions

2. **Scope Management:**
   - Request only necessary permissions
   - Use least-privilege principle
   - Review scopes periodically

3. **Token Refresh:**
   - Tokens are automatically refreshed when needed
   - Implement proper token storage and rotation

## Troubleshooting

### Common Issues

1. **Authentication Failures:**
   - Verify credentials are correctly configured
   - Check OAuth consent screen settings
   - Ensure redirect URIs match configuration

2. **Rate Limiting:**
   - Monitor request counts
   - Implement request queuing if needed
   - Use batch operations where possible

3. **Timezone Issues:**
   - Always specify timezone explicitly
   - Use ISO 8601 format for dates
   - Consider user's local timezone

### Debug Mode

Enable detailed logging:
```javascript
// Set log level
process.env.LOG_LEVEL = 'debug';
```

## Contributing

When adding new calendar integrations:
1. Extend the BaseTool class
2. Implement all standard operations
3. Include mock mode support
4. Add comprehensive error handling
5. Document all parameters and responses
6. Include usage examples

## License

See main project license.