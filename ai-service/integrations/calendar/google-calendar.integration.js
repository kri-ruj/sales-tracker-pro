const { google } = require('googleapis');
const BaseTool = require('../../core/registry/tool-interface');
const { DateTime } = require('luxon');

/**
 * Google Calendar Integration
 * Manage calendar events, check availability, and handle recurring events
 */
class GoogleCalendarIntegration extends BaseTool {
    constructor() {
        super({
            name: 'googleCalendarIntegration',
            description: 'Manage calendar events through Google Calendar API',
            category: 'integration',
            version: '1.0.0',
            
            parameters: {
                operation: {
                    type: 'string',
                    description: 'Operation: createEvent, listEvents, getEvent, updateEvent, deleteEvent, checkAvailability, getFreeBusy',
                    required: true,
                    validate: (value) => [
                        'createEvent', 'listEvents', 'getEvent', 'updateEvent', 
                        'deleteEvent', 'checkAvailability', 'getFreeBusy'
                    ].includes(value)
                },
                calendarId: {
                    type: 'string',
                    description: 'Calendar ID (default: primary)',
                    required: false,
                    default: 'primary'
                },
                eventData: {
                    type: 'object',
                    description: 'Event data for create/update operations',
                    required: false,
                    properties: {
                        summary: { type: 'string', description: 'Event title' },
                        description: { type: 'string', description: 'Event description' },
                        location: { type: 'string', description: 'Event location' },
                        start: { type: 'object', description: 'Start time' },
                        end: { type: 'object', description: 'End time' },
                        attendees: { type: 'array', description: 'List of attendees' },
                        reminders: { type: 'object', description: 'Reminder settings' },
                        recurrence: { type: 'array', description: 'Recurrence rules' },
                        colorId: { type: 'string', description: 'Event color' },
                        visibility: { type: 'string', description: 'Event visibility' },
                        conferenceData: { type: 'object', description: 'Video conference settings' }
                    }
                },
                eventId: {
                    type: 'string',
                    description: 'Event ID for get/update/delete operations',
                    required: false
                },
                timeMin: {
                    type: 'string',
                    description: 'Start time for listing events (ISO 8601)',
                    required: false
                },
                timeMax: {
                    type: 'string',
                    description: 'End time for listing events (ISO 8601)',
                    required: false
                },
                timeZone: {
                    type: 'string',
                    description: 'Timezone (default: user timezone)',
                    required: false,
                    default: 'America/Los_Angeles'
                },
                maxResults: {
                    type: 'number',
                    description: 'Maximum number of events to return',
                    required: false,
                    default: 250
                },
                singleEvents: {
                    type: 'boolean',
                    description: 'Expand recurring events',
                    required: false,
                    default: true
                },
                orderBy: {
                    type: 'string',
                    description: 'Order results by: startTime or updated',
                    required: false,
                    default: 'startTime'
                },
                showDeleted: {
                    type: 'boolean',
                    description: 'Include deleted events',
                    required: false,
                    default: false
                },
                freeBusyItems: {
                    type: 'array',
                    description: 'Calendar IDs to check for free/busy',
                    required: false
                }
            },
            
            requiresAuth: true,
            timeout: 30000,
            retryable: true,
            maxRetries: 3
        });

        this.calendar = null;
        this.auth = null;
        this.mockMode = process.env.NODE_ENV === 'development' || process.env.GOOGLE_CALENDAR_MOCK === 'true';
        this.rateLimiter = {
            requests: 0,
            resetTime: Date.now() + 60000,
            maxRequests: 1800 // Google Calendar API limit: 1,800 requests/minute/user
        };
    }

    /**
     * Initialize Google Calendar client
     */
    async initialize() {
        if (this.mockMode) {
            this.logger.info('Google Calendar integration running in mock mode');
            return;
        }

        try {
            const credentialsPath = process.env.GOOGLE_CALENDAR_CREDENTIALS || './credentials/google-calendar-credentials.json';
            const tokenPath = process.env.GOOGLE_CALENDAR_TOKEN || './credentials/google-calendar-token.json';

            // Authenticate using OAuth2
            this.auth = await this.authenticateGoogle(credentialsPath, tokenPath);
            this.calendar = google.calendar({ version: 'v3', auth: this.auth });
            
            this.logger.info('Google Calendar client initialized');
        } catch (error) {
            this.logger.error('Failed to initialize Google Calendar', { error: error.message });
            this.mockMode = true;
        }
    }

    /**
     * Authenticate with Google OAuth2
     */
    async authenticateGoogle(credentialsPath, tokenPath) {
        const fs = require('fs').promises;
        const path = require('path');
        const { authenticate } = require('@google-cloud/local-auth');

        try {
            // Load saved credentials
            const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
            
            // Check if we have a saved token
            try {
                const token = JSON.parse(await fs.readFile(tokenPath, 'utf8'));
                const oauth2Client = new google.auth.OAuth2(
                    credentials.installed.client_id,
                    credentials.installed.client_secret,
                    credentials.installed.redirect_uris[0]
                );
                oauth2Client.setCredentials(token);
                return oauth2Client;
            } catch (err) {
                // No saved token, authenticate
                const auth = await authenticate({
                    scopes: ['https://www.googleapis.com/auth/calendar'],
                    keyfilePath: credentialsPath,
                });
                
                // Save token for future use
                await fs.writeFile(tokenPath, JSON.stringify(auth.credentials));
                return auth;
            }
        } catch (error) {
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }

    /**
     * Check rate limits
     */
    checkRateLimit() {
        if (Date.now() > this.rateLimiter.resetTime) {
            this.rateLimiter.requests = 0;
            this.rateLimiter.resetTime = Date.now() + 60000;
        }

        if (this.rateLimiter.requests >= this.rateLimiter.maxRequests) {
            throw new Error('Rate limit exceeded. Please try again later.');
        }

        this.rateLimiter.requests++;
    }

    /**
     * Execute calendar operation
     */
    async execute(parameters, context) {
        const { operation } = parameters;

        if (this.mockMode) {
            return this.executeMock(operation, parameters);
        }

        this.checkRateLimit();

        switch (operation) {
            case 'createEvent':
                return await this.createEvent(parameters);
            case 'listEvents':
                return await this.listEvents(parameters);
            case 'getEvent':
                return await this.getEvent(parameters);
            case 'updateEvent':
                return await this.updateEvent(parameters);
            case 'deleteEvent':
                return await this.deleteEvent(parameters);
            case 'checkAvailability':
                return await this.checkAvailability(parameters);
            case 'getFreeBusy':
                return await this.getFreeBusy(parameters);
            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
    }

    /**
     * Create a new calendar event
     */
    async createEvent(parameters) {
        const { calendarId = 'primary', eventData, timeZone } = parameters;

        try {
            // Format event data
            const event = this.formatEventData(eventData, timeZone);

            // Add conference data if requested
            let conferenceDataVersion = 0;
            if (eventData.conferenceData || eventData.createMeet) {
                conferenceDataVersion = 1;
                if (eventData.createMeet && !eventData.conferenceData) {
                    event.conferenceData = {
                        createRequest: {
                            requestId: `meet-${Date.now()}`,
                            conferenceSolutionKey: { type: 'hangoutsMeet' }
                        }
                    };
                }
            }

            const response = await this.calendar.events.insert({
                calendarId,
                resource: event,
                conferenceDataVersion,
                sendUpdates: 'all'
            });

            this.logger.info('Event created successfully', { eventId: response.data.id });

            return {
                eventId: response.data.id,
                htmlLink: response.data.htmlLink,
                summary: response.data.summary,
                start: response.data.start,
                end: response.data.end,
                hangoutLink: response.data.hangoutLink,
                conferenceData: response.data.conferenceData
            };
        } catch (error) {
            this.logger.error('Failed to create event', { error: error.message });
            throw error;
        }
    }

    /**
     * List calendar events
     */
    async listEvents(parameters) {
        const {
            calendarId = 'primary',
            timeMin,
            timeMax,
            maxResults = 250,
            singleEvents = true,
            orderBy = 'startTime',
            showDeleted = false,
            timeZone
        } = parameters;

        try {
            const params = {
                calendarId,
                maxResults,
                singleEvents,
                orderBy: singleEvents ? orderBy : undefined,
                showDeleted,
                timeZone
            };

            // Add time range if specified
            if (timeMin) params.timeMin = new Date(timeMin).toISOString();
            if (timeMax) params.timeMax = new Date(timeMax).toISOString();

            const response = await this.calendar.events.list(params);

            const events = response.data.items.map(event => ({
                id: event.id,
                summary: event.summary,
                description: event.description,
                location: event.location,
                start: event.start,
                end: event.end,
                status: event.status,
                htmlLink: event.htmlLink,
                hangoutLink: event.hangoutLink,
                attendees: event.attendees,
                organizer: event.organizer,
                recurringEventId: event.recurringEventId
            }));

            this.logger.info('Events retrieved', { count: events.length });

            return {
                events,
                nextPageToken: response.data.nextPageToken,
                nextSyncToken: response.data.nextSyncToken
            };
        } catch (error) {
            this.logger.error('Failed to list events', { error: error.message });
            throw error;
        }
    }

    /**
     * Get a specific event
     */
    async getEvent(parameters) {
        const { calendarId = 'primary', eventId } = parameters;

        if (!eventId) {
            throw new Error('Event ID is required');
        }

        try {
            const response = await this.calendar.events.get({
                calendarId,
                eventId
            });

            return {
                id: response.data.id,
                summary: response.data.summary,
                description: response.data.description,
                location: response.data.location,
                start: response.data.start,
                end: response.data.end,
                status: response.data.status,
                htmlLink: response.data.htmlLink,
                hangoutLink: response.data.hangoutLink,
                attendees: response.data.attendees,
                organizer: response.data.organizer,
                recurrence: response.data.recurrence,
                reminders: response.data.reminders
            };
        } catch (error) {
            this.logger.error('Failed to get event', { error: error.message });
            throw error;
        }
    }

    /**
     * Update an existing event
     */
    async updateEvent(parameters) {
        const { calendarId = 'primary', eventId, eventData, timeZone } = parameters;

        if (!eventId) {
            throw new Error('Event ID is required');
        }

        try {
            // Get existing event first
            const existingEvent = await this.calendar.events.get({
                calendarId,
                eventId
            });

            // Merge with new data
            const updatedEvent = {
                ...existingEvent.data,
                ...this.formatEventData(eventData, timeZone)
            };

            const response = await this.calendar.events.update({
                calendarId,
                eventId,
                resource: updatedEvent,
                sendUpdates: 'all'
            });

            this.logger.info('Event updated successfully', { eventId });

            return {
                eventId: response.data.id,
                htmlLink: response.data.htmlLink,
                summary: response.data.summary,
                start: response.data.start,
                end: response.data.end,
                updated: response.data.updated
            };
        } catch (error) {
            this.logger.error('Failed to update event', { error: error.message });
            throw error;
        }
    }

    /**
     * Delete an event
     */
    async deleteEvent(parameters) {
        const { calendarId = 'primary', eventId } = parameters;

        if (!eventId) {
            throw new Error('Event ID is required');
        }

        try {
            await this.calendar.events.delete({
                calendarId,
                eventId,
                sendUpdates: 'all'
            });

            this.logger.info('Event deleted successfully', { eventId });

            return {
                success: true,
                eventId,
                message: 'Event deleted successfully'
            };
        } catch (error) {
            this.logger.error('Failed to delete event', { error: error.message });
            throw error;
        }
    }

    /**
     * Check availability for a time slot
     */
    async checkAvailability(parameters) {
        const { calendarId = 'primary', timeMin, timeMax, timeZone } = parameters;

        if (!timeMin || !timeMax) {
            throw new Error('timeMin and timeMax are required');
        }

        try {
            // Get events in the specified time range
            const response = await this.calendar.events.list({
                calendarId,
                timeMin: new Date(timeMin).toISOString(),
                timeMax: new Date(timeMax).toISOString(),
                singleEvents: true,
                orderBy: 'startTime',
                timeZone
            });

            const busySlots = response.data.items
                .filter(event => event.status !== 'cancelled')
                .map(event => ({
                    start: event.start.dateTime || event.start.date,
                    end: event.end.dateTime || event.end.date,
                    summary: event.summary
                }));

            // Calculate free slots
            const freeSlots = this.calculateFreeSlots(timeMin, timeMax, busySlots);

            return {
                available: busySlots.length === 0,
                busySlots,
                freeSlots,
                timeZone
            };
        } catch (error) {
            this.logger.error('Failed to check availability', { error: error.message });
            throw error;
        }
    }

    /**
     * Get free/busy information for multiple calendars
     */
    async getFreeBusy(parameters) {
        const { freeBusyItems = [], timeMin, timeMax, timeZone } = parameters;

        if (!timeMin || !timeMax) {
            throw new Error('timeMin and timeMax are required');
        }

        try {
            const items = freeBusyItems.length > 0 
                ? freeBusyItems.map(id => ({ id }))
                : [{ id: 'primary' }];

            const response = await this.calendar.freebusy.query({
                resource: {
                    timeMin: new Date(timeMin).toISOString(),
                    timeMax: new Date(timeMax).toISOString(),
                    timeZone,
                    items
                }
            });

            const calendars = {};
            for (const [calendarId, data] of Object.entries(response.data.calendars)) {
                calendars[calendarId] = {
                    busy: data.busy || [],
                    errors: data.errors || []
                };
            }

            return {
                timeMin,
                timeMax,
                timeZone,
                calendars
            };
        } catch (error) {
            this.logger.error('Failed to get free/busy info', { error: error.message });
            throw error;
        }
    }

    /**
     * Format event data for Google Calendar API
     */
    formatEventData(eventData, timeZone) {
        const event = {
            summary: eventData.summary,
            description: eventData.description,
            location: eventData.location,
            colorId: eventData.colorId,
            visibility: eventData.visibility
        };

        // Handle start/end times
        if (eventData.start) {
            event.start = this.formatDateTime(eventData.start, timeZone);
        }
        if (eventData.end) {
            event.end = this.formatDateTime(eventData.end, timeZone);
        }

        // Handle attendees
        if (eventData.attendees) {
            event.attendees = eventData.attendees.map(attendee => {
                if (typeof attendee === 'string') {
                    return { email: attendee };
                }
                return attendee;
            });
        }

        // Handle reminders
        if (eventData.reminders) {
            event.reminders = eventData.reminders;
        } else {
            event.reminders = {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 24 * 60 },
                    { method: 'popup', minutes: 10 }
                ]
            };
        }

        // Handle recurrence
        if (eventData.recurrence) {
            event.recurrence = eventData.recurrence;
        }

        // Handle conference data
        if (eventData.conferenceData) {
            event.conferenceData = eventData.conferenceData;
        }

        return event;
    }

    /**
     * Format date/time for Google Calendar
     */
    formatDateTime(dateTime, timeZone) {
        if (dateTime.date) {
            // All-day event
            return { date: dateTime.date };
        }

        if (dateTime.dateTime) {
            return {
                dateTime: dateTime.dateTime,
                timeZone: dateTime.timeZone || timeZone
            };
        }

        // Convert string to proper format
        const dt = DateTime.fromISO(dateTime, { zone: timeZone });
        return {
            dateTime: dt.toISO(),
            timeZone: timeZone
        };
    }

    /**
     * Calculate free time slots
     */
    calculateFreeSlots(timeMin, timeMax, busySlots) {
        const freeSlots = [];
        const start = new Date(timeMin);
        const end = new Date(timeMax);

        // Sort busy slots by start time
        busySlots.sort((a, b) => new Date(a.start) - new Date(b.start));

        let currentTime = start;

        for (const busy of busySlots) {
            const busyStart = new Date(busy.start);
            const busyEnd = new Date(busy.end);

            if (currentTime < busyStart) {
                freeSlots.push({
                    start: currentTime.toISOString(),
                    end: busyStart.toISOString()
                });
            }

            currentTime = busyEnd > currentTime ? busyEnd : currentTime;
        }

        if (currentTime < end) {
            freeSlots.push({
                start: currentTime.toISOString(),
                end: end.toISOString()
            });
        }

        return freeSlots;
    }

    /**
     * Execute mock operations for development
     */
    async executeMock(operation, parameters) {
        this.logger.info(`Executing mock ${operation}`, parameters);

        const mockResponses = {
            createEvent: {
                eventId: `mock-event-${Date.now()}`,
                htmlLink: 'https://calendar.google.com/event?eid=mockEvent',
                summary: parameters.eventData?.summary || 'Mock Event',
                start: parameters.eventData?.start || { dateTime: new Date().toISOString() },
                end: parameters.eventData?.end || { dateTime: new Date(Date.now() + 3600000).toISOString() },
                hangoutLink: 'https://meet.google.com/mock-meet-link'
            },
            listEvents: {
                events: [
                    {
                        id: 'mock-event-1',
                        summary: 'Team Meeting',
                        start: { dateTime: new Date().toISOString() },
                        end: { dateTime: new Date(Date.now() + 3600000).toISOString() },
                        htmlLink: 'https://calendar.google.com/event?eid=mockEvent1'
                    },
                    {
                        id: 'mock-event-2',
                        summary: 'Client Call',
                        start: { dateTime: new Date(Date.now() + 7200000).toISOString() },
                        end: { dateTime: new Date(Date.now() + 10800000).toISOString() },
                        htmlLink: 'https://calendar.google.com/event?eid=mockEvent2'
                    }
                ]
            },
            getEvent: {
                id: parameters.eventId || 'mock-event-1',
                summary: 'Mock Event Details',
                description: 'This is a mock event for testing',
                start: { dateTime: new Date().toISOString() },
                end: { dateTime: new Date(Date.now() + 3600000).toISOString() },
                attendees: [
                    { email: 'user1@example.com', responseStatus: 'accepted' },
                    { email: 'user2@example.com', responseStatus: 'needsAction' }
                ]
            },
            updateEvent: {
                eventId: parameters.eventId || 'mock-event-1',
                htmlLink: 'https://calendar.google.com/event?eid=mockEvent1',
                summary: parameters.eventData?.summary || 'Updated Mock Event',
                updated: new Date().toISOString()
            },
            deleteEvent: {
                success: true,
                eventId: parameters.eventId || 'mock-event-1',
                message: 'Mock event deleted successfully'
            },
            checkAvailability: {
                available: Math.random() > 0.5,
                busySlots: [
                    {
                        start: new Date().toISOString(),
                        end: new Date(Date.now() + 3600000).toISOString(),
                        summary: 'Existing Meeting'
                    }
                ],
                freeSlots: [
                    {
                        start: new Date(Date.now() + 3600000).toISOString(),
                        end: new Date(Date.now() + 7200000).toISOString()
                    }
                ]
            },
            getFreeBusy: {
                timeMin: parameters.timeMin,
                timeMax: parameters.timeMax,
                calendars: {
                    primary: {
                        busy: [
                            {
                                start: new Date().toISOString(),
                                end: new Date(Date.now() + 3600000).toISOString()
                            }
                        ],
                        errors: []
                    }
                }
            }
        };

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));

        return mockResponses[operation] || { error: 'Mock operation not implemented' };
    }
}

module.exports = GoogleCalendarIntegration;