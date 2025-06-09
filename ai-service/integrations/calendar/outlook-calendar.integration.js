const { Client } = require('@microsoft/microsoft-graph-client');
const { ConfidentialClientApplication } = require('@azure/msal-node');
const BaseTool = require('../../core/registry/tool-interface');
const { DateTime } = require('luxon');

/**
 * Microsoft Outlook Calendar Integration
 * Manage calendar events, check availability, handle meeting rooms via Microsoft Graph API
 */
class OutlookCalendarIntegration extends BaseTool {
    constructor() {
        super({
            name: 'outlookCalendarIntegration',
            description: 'Manage calendar events through Microsoft Outlook/Exchange',
            category: 'integration',
            version: '1.0.0',
            
            parameters: {
                operation: {
                    type: 'string',
                    description: 'Operation: createEvent, listEvents, getEvent, updateEvent, deleteEvent, checkAvailability, findMeetingTimes, getMeetingRooms',
                    required: true,
                    validate: (value) => [
                        'createEvent', 'listEvents', 'getEvent', 'updateEvent', 
                        'deleteEvent', 'checkAvailability', 'findMeetingTimes', 'getMeetingRooms'
                    ].includes(value)
                },
                calendarId: {
                    type: 'string',
                    description: 'Calendar ID or email (default: me)',
                    required: false,
                    default: 'me'
                },
                eventData: {
                    type: 'object',
                    description: 'Event data for create/update operations',
                    required: false,
                    properties: {
                        subject: { type: 'string', description: 'Event subject/title' },
                        body: { type: 'object', description: 'Event body content' },
                        start: { type: 'object', description: 'Start date/time' },
                        end: { type: 'object', description: 'End date/time' },
                        location: { type: 'object', description: 'Event location' },
                        attendees: { type: 'array', description: 'List of attendees' },
                        isOnlineMeeting: { type: 'boolean', description: 'Create online meeting' },
                        onlineMeetingProvider: { type: 'string', description: 'Meeting provider' },
                        categories: { type: 'array', description: 'Event categories' },
                        importance: { type: 'string', description: 'Event importance' },
                        isAllDay: { type: 'boolean', description: 'All-day event' },
                        isReminderOn: { type: 'boolean', description: 'Enable reminder' },
                        reminderMinutesBeforeStart: { type: 'number', description: 'Reminder time' },
                        recurrence: { type: 'object', description: 'Recurrence pattern' },
                        sensitivity: { type: 'string', description: 'Event sensitivity' },
                        showAs: { type: 'string', description: 'Show as status' },
                        responseRequested: { type: 'boolean', description: 'Request responses' }
                    }
                },
                eventId: {
                    type: 'string',
                    description: 'Event ID for get/update/delete operations',
                    required: false
                },
                startDateTime: {
                    type: 'string',
                    description: 'Start date/time for queries (ISO 8601)',
                    required: false
                },
                endDateTime: {
                    type: 'string',
                    description: 'End date/time for queries (ISO 8601)',
                    required: false
                },
                timeZone: {
                    type: 'string',
                    description: 'Timezone (default: UTC)',
                    required: false,
                    default: 'UTC'
                },
                top: {
                    type: 'number',
                    description: 'Maximum number of results',
                    required: false,
                    default: 50
                },
                select: {
                    type: 'array',
                    description: 'Fields to select',
                    required: false
                },
                filter: {
                    type: 'string',
                    description: 'OData filter expression',
                    required: false
                },
                orderBy: {
                    type: 'string',
                    description: 'Order by field',
                    required: false,
                    default: 'start/dateTime'
                },
                meetingRequest: {
                    type: 'object',
                    description: 'Meeting time finder request',
                    required: false,
                    properties: {
                        attendees: { type: 'array' },
                        locationConstraint: { type: 'object' },
                        timeConstraint: { type: 'object' },
                        meetingDuration: { type: 'string' },
                        maxCandidates: { type: 'number' },
                        isOrganizerOptional: { type: 'boolean' },
                        minimumAttendeePercentage: { type: 'number' }
                    }
                },
                roomListEmail: {
                    type: 'string',
                    description: 'Room list email for getting meeting rooms',
                    required: false
                }
            },
            
            requiresAuth: true,
            timeout: 30000,
            retryable: true,
            maxRetries: 3
        });

        this.graphClient = null;
        this.msalClient = null;
        this.accessToken = null;
        this.tokenExpiry = null;
        this.mockMode = process.env.NODE_ENV === 'development' || process.env.OUTLOOK_MOCK === 'true';
        this.rateLimiter = {
            requests: 0,
            resetTime: Date.now() + 60000,
            maxRequests: 120 // Microsoft Graph throttling limit
        };
    }

    /**
     * Initialize Microsoft Graph client
     */
    async initialize() {
        if (this.mockMode) {
            this.logger.info('Outlook Calendar integration running in mock mode');
            return;
        }

        try {
            // MSAL configuration
            const msalConfig = {
                auth: {
                    clientId: process.env.AZURE_CLIENT_ID,
                    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
                    clientSecret: process.env.AZURE_CLIENT_SECRET
                }
            };

            // Create MSAL client
            this.msalClient = new ConfidentialClientApplication(msalConfig);

            // Get access token
            await this.refreshAccessToken();

            // Initialize Graph client
            this.graphClient = Client.init({
                authProvider: (callback) => {
                    callback(null, this.accessToken);
                }
            });

            this.logger.info('Microsoft Graph client initialized');
        } catch (error) {
            this.logger.error('Failed to initialize Outlook Calendar', { error: error.message });
            this.mockMode = true;
        }
    }

    /**
     * Refresh access token if needed
     */
    async refreshAccessToken() {
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return;
        }

        try {
            const tokenRequest = {
                scopes: ['https://graph.microsoft.com/.default']
            };

            const response = await this.msalClient.acquireTokenByClientCredential(tokenRequest);
            this.accessToken = response.accessToken;
            this.tokenExpiry = response.expiresOn.getTime();

            this.logger.info('Access token refreshed');
        } catch (error) {
            throw new Error(`Failed to acquire token: ${error.message}`);
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

        // Refresh token if needed
        await this.refreshAccessToken();

        // Check rate limits
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
            case 'findMeetingTimes':
                return await this.findMeetingTimes(parameters);
            case 'getMeetingRooms':
                return await this.getMeetingRooms(parameters);
            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
    }

    /**
     * Create a new calendar event
     */
    async createEvent(parameters) {
        const { calendarId = 'me', eventData, timeZone } = parameters;

        try {
            // Format event data
            const event = this.formatEventData(eventData, timeZone);

            // Create event
            const response = await this.graphClient
                .api(`/users/${calendarId}/events`)
                .post(event);

            this.logger.info('Event created successfully', { eventId: response.id });

            return {
                eventId: response.id,
                subject: response.subject,
                start: response.start,
                end: response.end,
                webLink: response.webLink,
                onlineMeeting: response.onlineMeeting,
                location: response.location,
                organizer: response.organizer
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
            calendarId = 'me',
            startDateTime,
            endDateTime,
            top = 50,
            select,
            filter,
            orderBy = 'start/dateTime',
            timeZone
        } = parameters;

        try {
            let request = this.graphClient
                .api(`/users/${calendarId}/calendar/calendarView`)
                .top(top)
                .orderby(orderBy)
                .header('Prefer', `outlook.timezone="${timeZone || 'UTC'}"`);

            // Add query parameters
            const queryParams = {};
            if (startDateTime) queryParams.startDateTime = startDateTime;
            if (endDateTime) queryParams.endDateTime = endDateTime;
            
            request = request.query(queryParams);

            // Add select fields
            if (select && select.length > 0) {
                request = request.select(select.join(','));
            }

            // Add filter
            if (filter) {
                request = request.filter(filter);
            }

            const response = await request.get();

            const events = response.value.map(event => ({
                id: event.id,
                subject: event.subject,
                bodyPreview: event.bodyPreview,
                start: event.start,
                end: event.end,
                location: event.location,
                attendees: event.attendees,
                organizer: event.organizer,
                webLink: event.webLink,
                onlineMeeting: event.onlineMeeting,
                isAllDay: event.isAllDay,
                isCancelled: event.isCancelled,
                responseStatus: event.responseStatus,
                categories: event.categories,
                importance: event.importance,
                recurrence: event.recurrence
            }));

            this.logger.info('Events retrieved', { count: events.length });

            return {
                events,
                nextLink: response['@odata.nextLink']
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
        const { calendarId = 'me', eventId } = parameters;

        if (!eventId) {
            throw new Error('Event ID is required');
        }

        try {
            const response = await this.graphClient
                .api(`/users/${calendarId}/events/${eventId}`)
                .get();

            return {
                id: response.id,
                subject: response.subject,
                body: response.body,
                start: response.start,
                end: response.end,
                location: response.location,
                attendees: response.attendees,
                organizer: response.organizer,
                webLink: response.webLink,
                onlineMeeting: response.onlineMeeting,
                isAllDay: response.isAllDay,
                recurrence: response.recurrence,
                categories: response.categories,
                importance: response.importance,
                sensitivity: response.sensitivity,
                showAs: response.showAs,
                responseStatus: response.responseStatus,
                isReminderOn: response.isReminderOn,
                reminderMinutesBeforeStart: response.reminderMinutesBeforeStart
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
        const { calendarId = 'me', eventId, eventData, timeZone } = parameters;

        if (!eventId) {
            throw new Error('Event ID is required');
        }

        try {
            // Format event data
            const updates = this.formatEventData(eventData, timeZone);

            const response = await this.graphClient
                .api(`/users/${calendarId}/events/${eventId}`)
                .patch(updates);

            this.logger.info('Event updated successfully', { eventId });

            return {
                eventId: response.id,
                subject: response.subject,
                start: response.start,
                end: response.end,
                webLink: response.webLink,
                lastModifiedDateTime: response.lastModifiedDateTime
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
        const { calendarId = 'me', eventId } = parameters;

        if (!eventId) {
            throw new Error('Event ID is required');
        }

        try {
            await this.graphClient
                .api(`/users/${calendarId}/events/${eventId}`)
                .delete();

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
     * Check availability using calendar view
     */
    async checkAvailability(parameters) {
        const { calendarId = 'me', startDateTime, endDateTime, timeZone } = parameters;

        if (!startDateTime || !endDateTime) {
            throw new Error('startDateTime and endDateTime are required');
        }

        try {
            // Get events in the specified time range
            const response = await this.graphClient
                .api(`/users/${calendarId}/calendar/calendarView`)
                .query({
                    startDateTime,
                    endDateTime
                })
                .header('Prefer', `outlook.timezone="${timeZone || 'UTC'}"`)
                .select('subject,start,end,showAs,isCancelled')
                .filter('isCancelled eq false')
                .get();

            const busySlots = response.value
                .filter(event => event.showAs !== 'free')
                .map(event => ({
                    start: event.start.dateTime,
                    end: event.end.dateTime,
                    subject: event.subject,
                    showAs: event.showAs
                }));

            // Calculate free slots
            const freeSlots = this.calculateFreeSlots(startDateTime, endDateTime, busySlots);

            return {
                available: busySlots.length === 0,
                busySlots,
                freeSlots,
                timeZone: timeZone || 'UTC'
            };
        } catch (error) {
            this.logger.error('Failed to check availability', { error: error.message });
            throw error;
        }
    }

    /**
     * Find meeting times using Microsoft's intelligent scheduling
     */
    async findMeetingTimes(parameters) {
        const { calendarId = 'me', meetingRequest } = parameters;

        if (!meetingRequest) {
            throw new Error('Meeting request data is required');
        }

        try {
            const request = {
                attendees: meetingRequest.attendees || [],
                locationConstraint: meetingRequest.locationConstraint || {},
                timeConstraint: meetingRequest.timeConstraint || {
                    activityDomain: 'work',
                    timeslots: []
                },
                meetingDuration: meetingRequest.meetingDuration || 'PT1H',
                maxCandidates: meetingRequest.maxCandidates || 10,
                isOrganizerOptional: meetingRequest.isOrganizerOptional || false,
                returnSuggestionReasons: true,
                minimumAttendeePercentage: meetingRequest.minimumAttendeePercentage || 100
            };

            const response = await this.graphClient
                .api(`/users/${calendarId}/findMeetingTimes`)
                .post(request);

            const suggestions = response.meetingTimeSuggestions.map(suggestion => ({
                confidence: suggestion.confidence,
                organizerAvailability: suggestion.organizerAvailability,
                attendeeAvailability: suggestion.attendeeAvailability,
                locations: suggestion.locations,
                meetingTimeSlot: suggestion.meetingTimeSlot,
                suggestionReason: suggestion.suggestionReason
            }));

            this.logger.info('Meeting times found', { count: suggestions.length });

            return {
                suggestions,
                emptySuggestionsReason: response.emptySuggestionsReason
            };
        } catch (error) {
            this.logger.error('Failed to find meeting times', { error: error.message });
            throw error;
        }
    }

    /**
     * Get available meeting rooms
     */
    async getMeetingRooms(parameters) {
        const { roomListEmail } = parameters;

        try {
            let rooms;

            if (roomListEmail) {
                // Get rooms from specific room list
                rooms = await this.graphClient
                    .api(`/places/${roomListEmail}/microsoft.graph.roomlist/rooms`)
                    .get();
            } else {
                // Get all room lists first
                const roomLists = await this.graphClient
                    .api('/places/microsoft.graph.roomlist')
                    .get();

                // Get rooms from all lists
                rooms = { value: [] };
                for (const list of roomLists.value) {
                    const listRooms = await this.graphClient
                        .api(`/places/${list.id}/microsoft.graph.roomlist/rooms`)
                        .get();
                    rooms.value.push(...listRooms.value);
                }
            }

            const meetingRooms = rooms.value.map(room => ({
                id: room.id,
                displayName: room.displayName,
                emailAddress: room.emailAddress,
                capacity: room.capacity,
                building: room.building,
                floor: room.floorNumber,
                label: room.label,
                audioDeviceName: room.audioDeviceName,
                videoDeviceName: room.videoDeviceName,
                displayDeviceName: room.displayDeviceName,
                isWheelChairAccessible: room.isWheelChairAccessible,
                tags: room.tags,
                bookingType: room.bookingType
            }));

            this.logger.info('Meeting rooms retrieved', { count: meetingRooms.length });

            return {
                rooms: meetingRooms,
                totalCount: meetingRooms.length
            };
        } catch (error) {
            this.logger.error('Failed to get meeting rooms', { error: error.message });
            throw error;
        }
    }

    /**
     * Format event data for Microsoft Graph API
     */
    formatEventData(eventData, timeZone) {
        const event = {};

        // Basic properties
        if (eventData.subject) event.subject = eventData.subject;
        if (eventData.body) event.body = eventData.body;
        if (eventData.categories) event.categories = eventData.categories;
        if (eventData.importance) event.importance = eventData.importance;
        if (eventData.sensitivity) event.sensitivity = eventData.sensitivity;
        if (eventData.showAs) event.showAs = eventData.showAs;
        if (eventData.isAllDay !== undefined) event.isAllDay = eventData.isAllDay;
        if (eventData.responseRequested !== undefined) event.responseRequested = eventData.responseRequested;

        // Location
        if (eventData.location) {
            if (typeof eventData.location === 'string') {
                event.location = { displayName: eventData.location };
            } else {
                event.location = eventData.location;
            }
        }

        // Start and end times
        if (eventData.start) {
            event.start = this.formatDateTime(eventData.start, timeZone, eventData.isAllDay);
        }
        if (eventData.end) {
            event.end = this.formatDateTime(eventData.end, timeZone, eventData.isAllDay);
        }

        // Attendees
        if (eventData.attendees) {
            event.attendees = eventData.attendees.map(attendee => {
                if (typeof attendee === 'string') {
                    return {
                        emailAddress: { address: attendee },
                        type: 'required'
                    };
                }
                return attendee;
            });
        }

        // Online meeting
        if (eventData.isOnlineMeeting) {
            event.isOnlineMeeting = true;
            event.onlineMeetingProvider = eventData.onlineMeetingProvider || 'teamsForBusiness';
        }

        // Reminders
        if (eventData.isReminderOn !== undefined) {
            event.isReminderOn = eventData.isReminderOn;
            if (eventData.reminderMinutesBeforeStart !== undefined) {
                event.reminderMinutesBeforeStart = eventData.reminderMinutesBeforeStart;
            }
        }

        // Recurrence
        if (eventData.recurrence) {
            event.recurrence = eventData.recurrence;
        }

        return event;
    }

    /**
     * Format date/time for Microsoft Graph
     */
    formatDateTime(dateTime, timeZone, isAllDay = false) {
        if (isAllDay) {
            // For all-day events, use date only
            const date = typeof dateTime === 'string' ? dateTime.split('T')[0] : dateTime.date;
            return {
                dateTime: `${date}T00:00:00`,
                timeZone: timeZone || 'UTC'
            };
        }

        if (dateTime.dateTime) {
            return {
                dateTime: dateTime.dateTime,
                timeZone: dateTime.timeZone || timeZone || 'UTC'
            };
        }

        // Convert string to proper format
        const dt = DateTime.fromISO(dateTime, { zone: timeZone || 'UTC' });
        return {
            dateTime: dt.toISO({ suppressMilliseconds: true }),
            timeZone: timeZone || 'UTC'
        };
    }

    /**
     * Calculate free time slots
     */
    calculateFreeSlots(startDateTime, endDateTime, busySlots) {
        const freeSlots = [];
        const start = new Date(startDateTime);
        const end = new Date(endDateTime);

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
                eventId: `AAMkAGI-mock-${Date.now()}`,
                subject: parameters.eventData?.subject || 'Mock Meeting',
                start: parameters.eventData?.start || { dateTime: new Date().toISOString(), timeZone: 'UTC' },
                end: parameters.eventData?.end || { dateTime: new Date(Date.now() + 3600000).toISOString(), timeZone: 'UTC' },
                webLink: 'https://outlook.office365.com/calendar/event/mock',
                onlineMeeting: {
                    joinUrl: 'https://teams.microsoft.com/meet/mock-meeting'
                }
            },
            listEvents: {
                events: [
                    {
                        id: 'AAMkAGI-mock-1',
                        subject: 'Team Standup',
                        start: { dateTime: new Date().toISOString(), timeZone: 'UTC' },
                        end: { dateTime: new Date(Date.now() + 1800000).toISOString(), timeZone: 'UTC' },
                        location: { displayName: 'Conference Room A' },
                        importance: 'normal',
                        showAs: 'busy'
                    },
                    {
                        id: 'AAMkAGI-mock-2',
                        subject: 'Project Review',
                        start: { dateTime: new Date(Date.now() + 7200000).toISOString(), timeZone: 'UTC' },
                        end: { dateTime: new Date(Date.now() + 10800000).toISOString(), timeZone: 'UTC' },
                        isOnlineMeeting: true,
                        importance: 'high',
                        showAs: 'busy'
                    }
                ],
                nextLink: null
            },
            getEvent: {
                id: parameters.eventId || 'AAMkAGI-mock-1',
                subject: 'Mock Event Details',
                body: { contentType: 'text', content: 'This is a mock event for testing' },
                start: { dateTime: new Date().toISOString(), timeZone: 'UTC' },
                end: { dateTime: new Date(Date.now() + 3600000).toISOString(), timeZone: 'UTC' },
                attendees: [
                    {
                        emailAddress: { address: 'user1@company.com', name: 'User One' },
                        type: 'required',
                        status: { response: 'accepted' }
                    },
                    {
                        emailAddress: { address: 'user2@company.com', name: 'User Two' },
                        type: 'optional',
                        status: { response: 'tentativelyAccepted' }
                    }
                ],
                organizer: {
                    emailAddress: { address: 'organizer@company.com', name: 'Organizer' }
                }
            },
            updateEvent: {
                eventId: parameters.eventId || 'AAMkAGI-mock-1',
                subject: parameters.eventData?.subject || 'Updated Mock Event',
                lastModifiedDateTime: new Date().toISOString(),
                webLink: 'https://outlook.office365.com/calendar/event/mock'
            },
            deleteEvent: {
                success: true,
                eventId: parameters.eventId || 'AAMkAGI-mock-1',
                message: 'Mock event deleted successfully'
            },
            checkAvailability: {
                available: Math.random() > 0.5,
                busySlots: [
                    {
                        start: new Date().toISOString(),
                        end: new Date(Date.now() + 3600000).toISOString(),
                        subject: 'Existing Meeting',
                        showAs: 'busy'
                    }
                ],
                freeSlots: [
                    {
                        start: new Date(Date.now() + 3600000).toISOString(),
                        end: new Date(Date.now() + 7200000).toISOString()
                    }
                ],
                timeZone: parameters.timeZone || 'UTC'
            },
            findMeetingTimes: {
                suggestions: [
                    {
                        confidence: 100,
                        organizerAvailability: 'free',
                        attendeeAvailability: [
                            { attendee: { emailAddress: { address: 'user1@company.com' } }, availability: 'free' }
                        ],
                        meetingTimeSlot: {
                            start: { dateTime: new Date(Date.now() + 3600000).toISOString(), timeZone: 'UTC' },
                            end: { dateTime: new Date(Date.now() + 7200000).toISOString(), timeZone: 'UTC' }
                        },
                        locations: [{ displayName: 'Conference Room B', locationEmailAddress: 'room.b@company.com' }]
                    },
                    {
                        confidence: 75,
                        organizerAvailability: 'free',
                        meetingTimeSlot: {
                            start: { dateTime: new Date(Date.now() + 14400000).toISOString(), timeZone: 'UTC' },
                            end: { dateTime: new Date(Date.now() + 18000000).toISOString(), timeZone: 'UTC' }
                        }
                    }
                ],
                emptySuggestionsReason: ''
            },
            getMeetingRooms: {
                rooms: [
                    {
                        id: 'room-1',
                        displayName: 'Conference Room A',
                        emailAddress: 'room.a@company.com',
                        capacity: 10,
                        building: 'Main Building',
                        floor: 2,
                        isWheelChairAccessible: true,
                        audioDeviceName: 'Polycom',
                        videoDeviceName: 'Zoom Room',
                        tags: ['projector', 'whiteboard']
                    },
                    {
                        id: 'room-2',
                        displayName: 'Meeting Room B',
                        emailAddress: 'room.b@company.com',
                        capacity: 6,
                        building: 'Main Building',
                        floor: 3,
                        isWheelChairAccessible: true,
                        tags: ['tv', 'phone']
                    }
                ],
                totalCount: 2
            }
        };

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));

        return mockResponses[operation] || { error: 'Mock operation not implemented' };
    }
}

module.exports = OutlookCalendarIntegration;