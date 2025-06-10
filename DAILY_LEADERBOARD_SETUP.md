# Daily Leaderboard Flex Message Setup

## Overview
Beautiful daily leaderboard notifications sent to your LINE group at midnight Bangkok time, showing:
- Top performers with rankings (🥇🥈🥉)
- Activity breakdown for each user
- Total team points and active users
- Styled with dark theme and gold accents

## Example Preview
```
🏆 DAILY LEADERBOARD
2024-12-10

Active Users: 5    Total Points: 450

🥇 John Doe                    150 pts
   2x โทร, 1x นัด, 1x เริ่มแผน

🥈 Sarah Chen                  120 pts
   3x โทร, 2x นำเสนอ

🥉 Mike Johnson                 90 pts
   1x นัด, 1x เริ่มแผน

#4 Emma Davis                   50 pts
   5x โทร

#5 Alex Kim                     40 pts
   2x นัด

Keep up the great work! 💪
```

## Setup Instructions

### 1. Deploy Backend
The backend with daily leaderboard is ready to deploy:
```bash
gcloud app deploy deploy/backend/app.yaml --project=salesappfkt --quiet
```

### 2. Test the Leaderboard

#### Preview without sending (JSON format):
```bash
curl https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/api/daily-leaderboard/preview
```

#### Manually trigger the leaderboard:
```bash
curl -X POST https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/api/daily-leaderboard
```

### 3. Set Up Automatic Daily Notifications

#### Option A: Google Cloud Scheduler (Recommended)
```bash
# Create a Cloud Scheduler job
gcloud scheduler jobs create http daily-leaderboard \
  --location=asia-southeast1 \
  --schedule="0 0 * * *" \
  --time-zone="Asia/Bangkok" \
  --uri="https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/api/daily-leaderboard" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body="{}"
```

#### Option B: Use App Engine Cron (Alternative)
Deploy the cron configuration:
```bash
gcloud app deploy deploy/backend/cron.yaml --project=salesappfkt
```

### 4. Features of the Flex Message

1. **Header Section**
   - Title: "🏆 DAILY LEADERBOARD"
   - Current date
   - Dark blue background

2. **Summary Stats**
   - Active users count
   - Total team points
   - Highlighted in boxes

3. **Ranking List**
   - Top 10 performers
   - Medal emojis for top 3 (🥇🥈🥉)
   - Activity breakdown (e.g., "2x โทร, 1x นัด")
   - Points in gold color
   - Alternating row colors for readability

4. **Footer**
   - Motivational message
   - Styled consistently

## Customization

### Change the Schedule
Edit the cron schedule in Cloud Scheduler:
- `"0 0 * * *"` = Midnight daily
- `"0 9 * * *"` = 9 AM daily
- `"0 18 * * 5"` = 6 PM every Friday

### Modify the Message Design
Edit `/deploy/backend/daily-leaderboard.js`:
- Colors: Change hex values in the flex message
- Layout: Modify the bubble structure
- Content: Add/remove sections

### Change Timezone
Update timezone in cron configuration:
- Default: `Asia/Bangkok`
- Options: `Asia/Tokyo`, `America/New_York`, etc.

## Testing Different Scenarios

### Test with sample data:
```javascript
// Add test activities before triggering
curl -X POST https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/api/activities/sync \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test1",
    "userName": "Test User 1",
    "activities": [
      {"type": "call", "title": "โทร", "points": 10},
      {"type": "appointment", "title": "นัด", "points": 20}
    ]
  }'
```

## Troubleshooting

### No data in leaderboard
- Check if activities were submitted today
- Verify timezone settings (should be Bangkok time)
- Look at backend logs: `gcloud app logs tail -s sales-tracker-api`

### Message not sending
- Verify LINE credentials are set in environment
- Check if bot is still in the group
- Test LINE connection with login notification first

### Cron not triggering
- Check Cloud Scheduler logs
- Verify the job is enabled
- Test manual trigger first

## Benefits

1. **Daily Motivation** - Team sees progress every morning
2. **Competition** - Friendly rivalry with rankings
3. **Recognition** - Top performers get highlighted
4. **Transparency** - Everyone knows where they stand
5. **Beautiful Design** - Professional flex message layout