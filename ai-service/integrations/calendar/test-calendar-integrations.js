/**
 * Test Calendar Integrations
 * Demonstrates usage of Google Calendar and Microsoft Outlook integrations
 */

const GoogleCalendarIntegration = require('./google-calendar.integration');
const OutlookCalendarIntegration = require('./outlook-calendar.integration');

// Enable mock mode for testing
process.env.NODE_ENV = 'development';

async function testGoogleCalendar() {
    console.log('\n=== Testing Google Calendar Integration ===\n');
    
    const googleCalendar = new GoogleCalendarIntegration();
    
    try {
        // Test 1: Create an event
        console.log('1. Creating event...');
        const createResult = await googleCalendar.run({
            operation: 'createEvent',
            eventData: {
                summary: 'Project Planning Meeting',
                description: 'Discuss Q1 roadmap and deliverables',
                location: 'Conference Room A',
                start: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
                end: new Date(Date.now() + 90000000).toISOString(), // Tomorrow + 1 hour
                attendees: ['john@example.com', 'jane@example.com'],
                createMeet: true,
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: 'email', minutes: 60 },
                        { method: 'popup', minutes: 15 }
                    ]
                }
            },
            timeZone: 'America/Los_Angeles'
        });
        console.log('Event created:', createResult.data);
        
        // Test 2: List events
        console.log('\n2. Listing events...');
        const listResult = await googleCalendar.run({
            operation: 'listEvents',
            timeMin: new Date().toISOString(),
            timeMax: new Date(Date.now() + 604800000).toISOString(), // Next 7 days
            maxResults: 10,
            singleEvents: true,
            orderBy: 'startTime'
        });
        console.log(`Found ${listResult.data.events.length} events`);
        listResult.data.events.forEach(event => {
            console.log(`  - ${event.summary} at ${event.start.dateTime || event.start.date}`);
        });
        
        // Test 3: Check availability
        console.log('\n3. Checking availability...');
        const availabilityResult = await googleCalendar.run({
            operation: 'checkAvailability',
            timeMin: new Date().toISOString(),
            timeMax: new Date(Date.now() + 28800000).toISOString(), // Next 8 hours
            timeZone: 'America/Los_Angeles'
        });
        console.log('Availability check:', {
            available: availabilityResult.data.available,
            busySlots: availabilityResult.data.busySlots.length,
            freeSlots: availabilityResult.data.freeSlots.length
        });
        
        // Test 4: Get free/busy info
        console.log('\n4. Getting free/busy information...');
        const freeBusyResult = await googleCalendar.run({
            operation: 'getFreeBusy',
            timeMin: new Date().toISOString(),
            timeMax: new Date(Date.now() + 86400000).toISOString(),
            freeBusyItems: ['primary', 'team-calendar@example.com']
        });
        console.log('Free/busy info retrieved for', Object.keys(freeBusyResult.data.calendars).length, 'calendars');
        
    } catch (error) {
        console.error('Google Calendar test error:', error.message);
    }
}

async function testOutlookCalendar() {
    console.log('\n=== Testing Microsoft Outlook Integration ===\n');
    
    const outlookCalendar = new OutlookCalendarIntegration();
    
    try {
        // Test 1: Create an event with Teams meeting
        console.log('1. Creating event with Teams meeting...');
        const createResult = await outlookCalendar.run({
            operation: 'createEvent',
            eventData: {
                subject: 'Quarterly Business Review',
                body: {
                    contentType: 'html',
                    content: '<p>Please review the attached reports before the meeting.</p>'
                },
                start: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow
                end: new Date(Date.now() + 176400000).toISOString(), // +1 hour
                location: { displayName: 'Board Room' },
                attendees: [
                    { emailAddress: { address: 'ceo@company.com' }, type: 'required' },
                    { emailAddress: { address: 'cfo@company.com' }, type: 'required' },
                    { emailAddress: { address: 'analyst@company.com' }, type: 'optional' }
                ],
                isOnlineMeeting: true,
                importance: 'high',
                categories: ['Business', 'Quarterly Review'],
                isReminderOn: true,
                reminderMinutesBeforeStart: 30
            },
            timeZone: 'Eastern Standard Time'
        });
        console.log('Event created:', {
            id: createResult.data.eventId,
            subject: createResult.data.subject,
            meetingUrl: createResult.data.onlineMeeting?.joinUrl
        });
        
        // Test 2: Find meeting times
        console.log('\n2. Finding optimal meeting times...');
        const meetingTimesResult = await outlookCalendar.run({
            operation: 'findMeetingTimes',
            meetingRequest: {
                attendees: [
                    { emailAddress: { address: 'manager@company.com' }, type: 'required' },
                    { emailAddress: { address: 'developer1@company.com' }, type: 'required' },
                    { emailAddress: { address: 'developer2@company.com' }, type: 'optional' }
                ],
                meetingDuration: 'PT1H30M',
                timeConstraint: {
                    activityDomain: 'work',
                    timeslots: [{
                        start: { 
                            dateTime: new Date(Date.now() + 86400000).toISOString(), 
                            timeZone: 'Pacific Standard Time' 
                        },
                        end: { 
                            dateTime: new Date(Date.now() + 259200000).toISOString(), 
                            timeZone: 'Pacific Standard Time' 
                        }
                    }]
                },
                locationConstraint: {
                    isRequired: true,
                    suggestLocation: true
                },
                maxCandidates: 5
            }
        });
        console.log(`Found ${meetingTimesResult.data.suggestions.length} meeting time suggestions:`);
        meetingTimesResult.data.suggestions.forEach((suggestion, index) => {
            console.log(`  ${index + 1}. ${suggestion.meetingTimeSlot.start.dateTime} - Confidence: ${suggestion.confidence}%`);
            if (suggestion.locations?.length > 0) {
                console.log(`     Location: ${suggestion.locations[0].displayName}`);
            }
        });
        
        // Test 3: Get meeting rooms
        console.log('\n3. Getting available meeting rooms...');
        const roomsResult = await outlookCalendar.run({
            operation: 'getMeetingRooms'
        });
        console.log(`Found ${roomsResult.data.totalCount} meeting rooms:`);
        roomsResult.data.rooms.slice(0, 5).forEach(room => {
            console.log(`  - ${room.displayName} (Capacity: ${room.capacity})`);
            console.log(`    Building: ${room.building}, Floor: ${room.floor}`);
            console.log(`    Features: ${room.tags?.join(', ') || 'None listed'}`);
        });
        
        // Test 4: List events with filtering
        console.log('\n4. Listing high-importance events...');
        const listResult = await outlookCalendar.run({
            operation: 'listEvents',
            startDateTime: new Date().toISOString(),
            endDateTime: new Date(Date.now() + 2592000000).toISOString(), // Next 30 days
            filter: "importance eq 'high'",
            select: ['subject', 'start', 'end', 'importance', 'categories'],
            top: 10,
            orderBy: 'start/dateTime'
        });
        console.log(`Found ${listResult.data.events.length} high-importance events`);
        listResult.data.events.forEach(event => {
            console.log(`  - ${event.subject}`);
            console.log(`    Start: ${event.start.dateTime}`);
            console.log(`    Categories: ${event.categories?.join(', ') || 'None'}`);
        });
        
    } catch (error) {
        console.error('Outlook Calendar test error:', error.message);
    }
}

async function testBothIntegrations() {
    console.log('\n=== Testing Cross-Platform Scenarios ===\n');
    
    const googleCalendar = new GoogleCalendarIntegration();
    const outlookCalendar = new OutlookCalendarIntegration();
    
    try {
        // Scenario 1: Check availability across both platforms
        console.log('1. Checking availability across platforms...');
        const timeMin = new Date(Date.now() + 86400000).toISOString();
        const timeMax = new Date(Date.now() + 90000000).toISOString();
        
        const [googleAvailability, outlookAvailability] = await Promise.all([
            googleCalendar.run({
                operation: 'checkAvailability',
                timeMin,
                timeMax
            }),
            outlookCalendar.run({
                operation: 'checkAvailability',
                startDateTime: timeMin,
                endDateTime: timeMax
            })
        ]);
        
        console.log('Google Calendar availability:', googleAvailability.data.available);
        console.log('Outlook Calendar availability:', outlookAvailability.data.available);
        
        // Scenario 2: Create synchronized events
        console.log('\n2. Creating synchronized events...');
        const eventData = {
            title: 'Cross-Platform Sync Meeting',
            description: 'Testing calendar synchronization',
            start: new Date(Date.now() + 259200000).toISOString(), // 3 days from now
            end: new Date(Date.now() + 262800000).toISOString(),
            attendees: ['user@example.com']
        };
        
        const [googleEvent, outlookEvent] = await Promise.all([
            googleCalendar.run({
                operation: 'createEvent',
                eventData: {
                    summary: eventData.title,
                    description: eventData.description,
                    start: eventData.start,
                    end: eventData.end,
                    attendees: eventData.attendees
                }
            }),
            outlookCalendar.run({
                operation: 'createEvent',
                eventData: {
                    subject: eventData.title,
                    body: { contentType: 'text', content: eventData.description },
                    start: eventData.start,
                    end: eventData.end,
                    attendees: eventData.attendees.map(email => ({ emailAddress: { address: email } }))
                }
            })
        ]);
        
        console.log('Events created:');
        console.log('  Google:', googleEvent.data.eventId);
        console.log('  Outlook:', outlookEvent.data.eventId);
        
    } catch (error) {
        console.error('Cross-platform test error:', error.message);
    }
}

// Main test runner
async function runTests() {
    console.log('Starting Calendar Integration Tests...');
    console.log('Note: Running in mock mode for demonstration\n');
    
    await testGoogleCalendar();
    await testOutlookCalendar();
    await testBothIntegrations();
    
    console.log('\n=== Tests Complete ===');
}

// Run tests if executed directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { testGoogleCalendar, testOutlookCalendar, testBothIntegrations };