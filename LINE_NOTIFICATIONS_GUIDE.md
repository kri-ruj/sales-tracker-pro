# LINE Group Notifications Guide

## 🎉 Notification Types

Your Sales Tracker app now sends the following notifications to your LINE group:

### 1. Login Notifications
When someone logs in:
```
🎉 [Username] just logged in to Sales Tracker!
```

### 2. Activity Submission Notifications
When someone submits activities:
```
📊 [Username] submitted activities:
• Activities: 2x โทร, 1x นัด, 1x เริ่มแผน
• Points earned: 90 pts
• Total team points: 2540 pts
```

### 3. Achievement Notifications
When someone earns 100+ points in one submission:
```
🏆 Outstanding performance! [Username] earned 150 points in one submission!
```

### 4. Sales/Plan Start Notifications
When someone starts a new plan:
```
💰 Great news! [Username] started 1 new plan! 🎯
```

## 📱 How It Works

1. **User Actions** → **Frontend** → **Backend API** → **LINE Messaging API** → **Group Chat**

2. The app tracks these events:
   - User login (LINE authentication)
   - Activity submission (when clicking Submit button)
   - High-value achievements
   - New plan starts

## 🛠️ Customization

To change notification messages, edit `/deploy/backend/server-simple.js`:

```javascript
// Login message
const message = `🎉 ${userProfile?.displayName || 'Someone'} just logged in to Sales Tracker!`;

// Activity submission message
const submissionMessage = `📊 ${userName || 'Team member'} submitted activities:\n` +
    `• Activities: ${activitySummary}\n` +
    `• Points earned: ${totalPoints} pts\n` +
    `• Total team points: ${teamStats.totalPoints} pts`;
```

## 📊 Activity Types Tracked

- **โทร (Call)** - 10 points
- **นัด (Appointment)** - 20 points
- **ฟัง (Listen)** - 30 points
- **นำเสนอ (Present)** - 40 points
- **เริ่มแผน (Start Plan)** - 50 points

## 🔧 Testing

Test individual notifications:

```bash
# Test login notification
curl -X POST https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"test123","userProfile":{"displayName":"Test User"}}'

# Test activity submission
curl -X POST https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/api/activities/sync \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test123",
    "userName": "Test User",
    "activities": [
      {"type": "call", "title": "โทร", "points": 10},
      {"type": "start_plan", "title": "เริ่มแผน", "points": 50}
    ]
  }'
```

## 📈 Team Benefits

1. **Real-time Visibility** - Everyone sees team activity instantly
2. **Motivation** - Public recognition for achievements
3. **Competition** - Friendly competition through visible progress
4. **Accountability** - Team knows who's active and contributing

## 🚫 Notification Control

To temporarily disable notifications (e.g., during testing):
- Set environment variable: `LINE_GROUP_ID` to empty string
- Or comment out `sendLineMessage()` calls in the backend

## 📱 View in Your LINE Group

All notifications appear in your configured LINE group:
- Group ID: `C3625de59977b799d812357ac738c5c9b`
- Bot must remain in the group to send messages
- Messages appear instantly when activities occur