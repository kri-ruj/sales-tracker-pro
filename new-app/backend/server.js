import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory database
let users = [
  { id: '1', name: 'Demo User', points: 0, streak: 0 }
];

let activities = [];
let nextActivityId = 1;

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Auth
app.post('/api/auth/login', (req, res) => {
  const user = users[0]; // Simple demo login
  res.json({ 
    success: true, 
    user,
    token: 'demo-token'
  });
});

// Get user profile
app.get('/api/auth/me', (req, res) => {
  res.json({ 
    success: true, 
    user: users[0]
  });
});

// Get activities
app.get('/api/activities', (req, res) => {
  res.json({ 
    success: true, 
    data: activities.slice().reverse() // Most recent first
  });
});

// Create activity
app.post('/api/activities', (req, res) => {
  const { type, description } = req.body;
  
  const pointsMap = {
    phone_call: 10,
    meeting: 20,
    follow_up: 15,
    contract_sent: 30,
    meeting_scheduled: 25,
    project_booked: 50
  };
  
  const activity = {
    id: String(nextActivityId++),
    type,
    description,
    points: pointsMap[type] || 5,
    date: new Date().toISOString(),
    userId: '1'
  };
  
  activities.push(activity);
  
  // Update user points
  users[0].points += activity.points;
  users[0].streak = 1; // Simple streak
  
  res.json({ success: true, data: activity });
});

// Get stats
app.get('/api/stats', (req, res) => {
  const totalActivities = activities.length;
  const totalPoints = users[0].points;
  const todayActivities = activities.filter(a => 
    new Date(a.date).toDateString() === new Date().toDateString()
  ).length;
  
  res.json({
    success: true,
    data: {
      totalActivities,
      totalPoints,
      todayActivities,
      currentStreak: users[0].streak
    }
  });
});

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
  res.json({
    success: true,
    data: users.map((u, i) => ({
      ...u,
      rank: i + 1,
      activities: activities.filter(a => a.userId === u.id).length
    }))
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});