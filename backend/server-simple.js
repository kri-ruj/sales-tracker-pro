const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for demo (replace with database in production)
let users = new Map();
let activities = [];
let teamStats = {
    totalPoints: 2450,
    totalActivities: 48,
    salesCount: 12,
    goalAchievement: 85
};

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Sales Tracker Backend is running',
        timestamp: new Date().toISOString()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Sales Tracker API',
        status: 'running',
        version: '1.0.0',
        endpoints: [
            'GET /health',
            'GET /api/team/stats', 
            'POST /api/activities/sync',
            'POST /api/line/notify',
            'POST /webhook'
        ]
    });
});

// Get team stats
app.get('/api/team/stats', (req, res) => {
    res.json(teamStats);
});

// Sync activities
app.post('/api/activities/sync', (req, res) => {
    const { userId, activities: userActivities } = req.body;
    
    if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
    }
    
    // Store activities (in production, save to database)
    activities.push({
        userId,
        activities: userActivities,
        timestamp: new Date().toISOString()
    });
    
    // Update team stats
    if (userActivities && userActivities.length > 0) {
        const totalPoints = userActivities.reduce((sum, act) => sum + (act.points * act.count), 0);
        teamStats.totalPoints += totalPoints;
        teamStats.totalActivities += userActivities.length;
        
        // Check for sales
        const salesCount = userActivities.filter(act => act.type === 'sale_closed').length;
        teamStats.salesCount += salesCount;
    }
    
    res.json({ 
        success: true, 
        message: 'Activities synced successfully',
        teamStats 
    });
});

// LINE notification endpoint
app.post('/api/line/notify', (req, res) => {
    const { userId, activity, userProfile } = req.body;
    
    console.log('LINE Notification:', {
        user: userProfile?.displayName || userId,
        activity: activity?.title,
        points: activity?.points
    });
    
    // In production, send to LINE Messaging API
    res.json({ 
        success: true, 
        message: 'Notification sent to LINE group' 
    });
});

// LINE webhook (for future LINE bot integration)
app.post('/webhook', (req, res) => {
    console.log('LINE Webhook received:', req.body);
    res.status(200).send('OK');
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Sales Tracker Backend running on port ${PORT}`);
    console.log(`📱 Health check: http://localhost:${PORT}/health`);
    console.log(`📊 Team stats: http://localhost:${PORT}/api/team/stats`);
});