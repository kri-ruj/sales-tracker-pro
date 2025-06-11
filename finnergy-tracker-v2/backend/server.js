const express = require('express');
const cors = require('cors');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const line = require('@line/bot-sdk');

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize Firebase Admin
initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID || 'finnergy-tracker-pro',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  })
});

const db = getFirestore();

// LINE Bot config
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const lineClient = new line.Client(lineConfig);

// Middleware
app.use(cors());
app.use(express.json());
app.use('/webhook', line.middleware(lineConfig));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Finnergy Tracker Pro API',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// User endpoints
app.post('/api/users/register', async (req, res) => {
  try {
    const { userId, displayName, pictureUrl } = req.body;
    
    await db.collection('users').doc(userId).set({
      userId,
      displayName,
      pictureUrl,
      dailyGoal: 300,
      createdAt: new Date(),
      updatedAt: new Date()
    }, { merge: true });
    
    res.json({ success: true });
  } catch (error) {
    console.error('User registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Activity endpoints
app.post('/api/activities', async (req, res) => {
  try {
    const { userId, type, points, quantity } = req.body;
    
    const activity = {
      userId,
      type,
      points,
      quantity,
      timestamp: new Date(),
      week: getWeekNumber(new Date()),
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear()
    };
    
    await db.collection('activities').add(activity);
    
    // Send LINE notification
    if (lineConfig.channelAccessToken) {
      await sendActivityNotification(userId, activity);
    }
    
    res.json({ success: true, activity });
  } catch (error) {
    console.error('Activity creation error:', error);
    res.status(500).json({ error: 'Failed to create activity' });
  }
});

app.get('/api/activities/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10 } = req.query;
    
    const snapshot = await db.collection('activities')
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(parseInt(limit))
      .get();
    
    const activities = [];
    snapshot.forEach(doc => {
      activities.push({ id: doc.id, ...doc.data() });
    });
    
    res.json({ activities });
  } catch (error) {
    console.error('Activities fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// Stats endpoints
app.get('/api/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    
    // Get today's points
    const todaySnapshot = await db.collection('activities')
      .where('userId', '==', userId)
      .where('timestamp', '>=', today)
      .get();
    
    let todayPoints = 0;
    todaySnapshot.forEach(doc => {
      todayPoints += doc.data().points || 0;
    });
    
    // Get week points
    const weekSnapshot = await db.collection('activities')
      .where('userId', '==', userId)
      .where('timestamp', '>=', weekStart)
      .get();
    
    let weekPoints = 0;
    weekSnapshot.forEach(doc => {
      weekPoints += doc.data().points || 0;
    });
    
    // Calculate goal progress (assuming 300 points daily goal)
    const goalProgress = Math.min(100, Math.round((todayPoints / 300) * 100));
    
    res.json({
      todayPoints,
      weekPoints,
      goalProgress,
      dailyGoal: 300
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Leaderboard endpoints
app.get('/api/leaderboard/:period', async (req, res) => {
  try {
    const { period } = req.params; // daily, weekly, monthly
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - startDate.getDay());
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    
    // Get all activities since start date
    const snapshot = await db.collection('activities')
      .where('timestamp', '>=', startDate)
      .get();
    
    // Aggregate by user
    const userPoints = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      userPoints[data.userId] = (userPoints[data.userId] || 0) + (data.points || 0);
    });
    
    // Get user details and create leaderboard
    const leaderboard = [];
    for (const [userId, points] of Object.entries(userPoints)) {
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        leaderboard.push({
          userId,
          name: userData.displayName,
          pictureUrl: userData.pictureUrl,
          points
        });
      }
    }
    
    // Sort by points
    leaderboard.sort((a, b) => b.points - a.points);
    
    // Add ranks
    leaderboard.forEach((user, index) => {
      user.rank = index + 1;
    });
    
    res.json({ leaderboard: leaderboard.slice(0, 10) });
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// LINE Webhook
app.post('/webhook', async (req, res) => {
  try {
    const events = req.body.events;
    
    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        await handleLineMessage(event);
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Helper functions
function getWeekNumber(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

async function sendActivityNotification(userId, activity) {
  try {
    const message = {
      type: 'flex',
      altText: `New activity: ${activity.type} (+${activity.points} points)`,
      contents: createActivityFlexMessage(activity)
    };
    
    await lineClient.pushMessage(userId, message);
  } catch (error) {
    console.error('LINE notification error:', error);
  }
}

function createActivityFlexMessage(activity) {
  const typeEmojis = {
    phone: '📱',
    meeting: '🤝',
    quote: '📋',
    collab: '👥',
    present: '📊',
    training: '🎓',
    contract: '📄',
    other: '✨'
  };
  
  return {
    type: 'bubble',
    size: 'nano',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#667eea',
      contents: [{
        type: 'text',
        text: '🚀 Activity Added!',
        color: '#ffffff',
        weight: 'bold',
        size: 'sm'
      }]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'text',
              text: typeEmojis[activity.type] || '📌',
              size: 'xl'
            },
            {
              type: 'text',
              text: `+${activity.points} points`,
              weight: 'bold',
              size: 'lg',
              color: '#667eea',
              align: 'end',
              gravity: 'center'
            }
          ]
        }
      ]
    }
  };
}

async function handleLineMessage(event) {
  const { replyToken, message } = event;
  
  if (message.text.toLowerCase() === '/stats') {
    // TODO: Implement stats command
    await lineClient.replyMessage(replyToken, {
      type: 'text',
      text: 'Stats feature coming soon! 📊'
    });
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`Finnergy Tracker Pro API running on port ${PORT}`);
});