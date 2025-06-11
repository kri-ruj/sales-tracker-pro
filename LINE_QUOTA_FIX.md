# LINE API Quota Management Fix

## Problem
The app was hitting LINE's free tier limit (298/300 messages per day), causing notifications to fail.

## Solution Implemented
Created a quota management service that:
1. Tracks daily message usage in Firestore
2. Prevents sending messages when approaching the limit
3. Provides warnings at different thresholds
4. Automatically resets at midnight JST (LINE's reset time)

## Key Features

### Quota Thresholds
- **Daily Limit**: 300 messages (LINE free tier)
- **Warning Threshold**: 280 messages (93%)
- **Critical Threshold**: 295 messages (98%)

### How It Works
1. **Before Sending**: Check if quota allows the message
2. **Track Usage**: Record each sent message in Firestore
3. **Smart Limiting**: Stop non-critical messages at 295 to preserve quota for important messages
4. **Daily Reset**: Quota resets at midnight JST automatically

### API Endpoint
Check current quota status:
```
GET /api/quota/status
```

Response:
```json
{
  "date": "2024-12-06",
  "used": 298,
  "limit": 300,
  "remaining": 2,
  "percentage": 99,
  "isWarning": true,
  "isCritical": true,
  "breakdown": {
    "activity": 250,
    "leaderboard": 48
  },
  "willResetAt": "2024-12-06T15:00:00.000Z"
}
```

## Changes Made

### 1. New Service: `line-quota.service.js`
- Manages quota tracking and enforcement
- Stores daily usage in Firestore collection `line_quota`
- Provides quota checking and statistics

### 2. Updated `server-firestore.js`
- Integrated quota checking before sending notifications
- Added `/api/quota/status` endpoint
- Sends messages only when quota allows
- Logs warnings when approaching limits

### 3. Automatic Cleanup
- Old quota records are cleaned up after 7 days
- Runs every 15 minutes with cache cleanup

## Benefits
1. **No More Failed Messages**: Prevents hitting the 300 message limit
2. **Visibility**: Monitor quota usage via API
3. **Smart Prioritization**: Critical messages get priority
4. **Automatic Management**: No manual intervention needed

## Next Steps
1. Monitor quota usage patterns
2. Consider upgrading to LINE paid plan if needed
3. Implement message batching for efficiency
4. Add quota alerts to admin dashboard