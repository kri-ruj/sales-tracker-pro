const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Client } = require('@line/bot-sdk');
require('dotenv').config();

// Import Firestore service
const firestoreService = require('./services/firestore.service');
const { createActivitySubmissionFlex, sendFlexMessage } = require('./activity-flex-message-compact');

const app = express();
const PORT = process.env.PORT || 10000;

// Initialize LINE client variable
let lineClient;

// Initialize configuration
let lineConfig = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
};

// Function to initialize LINE client
async function initializeLineClient() {
    // In production, use Secret Manager
    if (process.env.NODE_ENV === 'production') {
        const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
        const secretClient = new SecretManagerServiceClient();
        
        try {
            // Load LINE secrets from Secret Manager
            const [accessToken] = await secretClient.accessSecretVersion({
                name: 'projects/salesappfkt/secrets/line-channel-access-token/versions/latest',
            });
            const [channelSecret] = await secretClient.accessSecretVersion({
                name: 'projects/salesappfkt/secrets/line-channel-secret/versions/latest',
            });
            
            lineConfig.channelAccessToken = accessToken.payload.data.toString();
            lineConfig.channelSecret = channelSecret.payload.data.toString();
            
            console.log('✅ Secrets loaded from Secret Manager');
            console.log('🔐 LINE integration ready');
        } catch (error) {
            console.error('Failed to load secrets:', error);
            // Fall back to environment variables
        }
    }
    
    // Create LINE client after secrets are loaded
    lineClient = new Client(lineConfig);
    console.log('✅ LINE client initialized');
}


// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Version management middleware
const { versionCheckMiddleware } = require('./middleware/version-check');
app.use(versionCheckMiddleware);

// Routes

// Version monitoring routes
const versionMonitorRoutes = require('./routes/version-monitor');
app.use('/api', versionMonitorRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
    // Use APP_VERSION from environment if available, fallback to package.json
    const packageVersion = process.env.APP_VERSION || require('./package.json').version;
    
    // Quick Firestore health check
    let dbStatus = 'unknown';
    try {
        await firestoreService.getUser('health-check');
        dbStatus = 'healthy';
    } catch (error) {
        dbStatus = 'error';
    }
    
    res.status(200).json({ 
        status: 'OK', 
        message: 'Sales Tracker LINE Backend is running',
        version: packageVersion,
        database: 'firestore',
        dbStatus,
        lineStatus: lineClient ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString() 
    });
});

// Debug endpoint to check registered groups
app.get('/api/debug/groups', async (req, res) => {
    try {
        const groups = await firestoreService.getAllGroups();
        res.json({ 
            groups: groups || [],
            count: groups.length,
            database: 'firestore',
            hasToken: !!lineConfig.channelAccessToken
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Basic API info
app.get('/', (req, res) => {
    const packageVersion = process.env.APP_VERSION || require('./package.json').version;
    res.json({ 
        message: 'Sales Tracker API (Firestore)',
        status: 'running',
        version: packageVersion,
        database: 'firestore',
        endpoints: ['/health', '/api/users', '/api/activities', '/api/team/stats', '/webhook', '/api/debug/groups', '/api/version', '/api/version/health', '/api/version/monitor']
    });
});

// User registration/update
app.post('/api/users', async (req, res) => {
    const { lineUserId, displayName, pictureUrl } = req.body;
    
    if (!lineUserId || !displayName) {
        return res.status(400).json({ error: 'lineUserId and displayName are required' });
    }
    
    try {
        const user = await firestoreService.createOrUpdateUser(lineUserId, {
            displayName,
            pictureUrl
        });
        
        res.json({ 
            success: true, 
            user
        });
    } catch (error) {
        console.error('Error in /api/users:', error);
        res.status(500).json({ error: 'Failed to save user' });
    }
});

// Get user profile
app.get('/api/users/:lineUserId', async (req, res) => {
    try {
        const user = await firestoreService.getUser(req.params.lineUserId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(user);
    } catch (error) {
        console.error('Error getting user:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// Update user settings
app.put('/api/users/:lineUserId/settings', async (req, res) => {
    const { lineUserId } = req.params;
    const settings = req.body;
    
    try {
        await firestoreService.updateUserSettings(lineUserId, settings);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Create activity
app.post('/api/activities', async (req, res) => {
    const { lineUserId, activityType, title, subtitle, points, count, date } = req.body;
    
    if (!lineUserId || !activityType || !title || points === undefined) {
        return res.status(400).json({ 
            error: 'lineUserId, activityType, title, and points are required' 
        });
    }
    
    try {
        const activity = await firestoreService.createActivity({
            lineUserId,
            activityType,
            title,
            subtitle,
            points: parseInt(points),
            count: parseInt(count) || 1,
            date: date || new Date().toISOString().split('T')[0]
        });
        
        // Send notification to registered groups
        try {
            const groups = await firestoreService.getAllGroups();
            const user = await firestoreService.getUser(lineUserId);
            
            for (const group of groups) {
                if (group.notificationsEnabled) {
                    const flexMessage = createActivitySubmissionFlex(
                        user?.displayName || 'Unknown User',
                        title,
                        subtitle || '',
                        points,
                        user?.pictureUrl
                    );
                    
                    await sendFlexMessage(
                        lineClient,
                        group.id,
                        'กิจกรรมใหม่! 🎯',
                        flexMessage
                    );
                }
            }
        } catch (notificationError) {
            console.error('Failed to send notifications:', notificationError);
        }
        
        res.json({ success: true, activity });
    } catch (error) {
        console.error('Error creating activity:', error);
        res.status(500).json({ error: 'Failed to save activity' });
    }
});

// Get user activities
app.get('/api/activities/user/:lineUserId', async (req, res) => {
    const { date } = req.query;
    
    try {
        const activities = await firestoreService.getUserActivities(req.params.lineUserId, date);
        res.json(activities);
    } catch (error) {
        console.error('Error getting activities:', error);
        res.status(500).json({ error: 'Failed to get activities' });
    }
});

// Delete activity
app.delete('/api/activities/:id', async (req, res) => {
    try {
        await firestoreService.deleteActivity(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting activity:', error);
        res.status(500).json({ error: 'Failed to delete activity' });
    }
});

// Get team statistics
app.get('/api/team/stats', async (req, res) => {
    try {
        const stats = await firestoreService.getTeamStats();
        res.json(stats);
    } catch (error) {
        console.error('Error getting team stats:', error);
        res.status(500).json({ error: 'Failed to get team statistics' });
    }
});

// Analytics endpoint - Activity trends over time
app.get('/api/analytics/trends', async (req, res) => {
    const { lineUserId, days = 30 } = req.query;
    
    try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));
        
        const activities = await firestoreService.getActivitiesByDateRange(
            lineUserId,
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
        );
        
        // Group by date and activity type
        const trends = {};
        activities.forEach(activity => {
            const date = activity.date;
            if (!trends[date]) {
                trends[date] = { date, total: 0, types: {} };
            }
            trends[date].total += activity.points;
            trends[date].types[activity.activityType] = 
                (trends[date].types[activity.activityType] || 0) + activity.points;
        });
        
        res.json({
            period: `${days} days`,
            data: Object.values(trends).sort((a, b) => a.date.localeCompare(b.date))
        });
    } catch (error) {
        console.error('Error getting trends:', error);
        res.status(500).json({ error: 'Failed to get trends' });
    }
});

// Analytics endpoint - Activity type breakdown
app.get('/api/analytics/breakdown', async (req, res) => {
    const { lineUserId, period = 'monthly' } = req.query;
    
    try {
        let startDate = new Date();
        if (period === 'daily') {
            startDate.setHours(0, 0, 0, 0);
        } else if (period === 'weekly') {
            startDate.setDate(startDate.getDate() - 7);
        } else {
            startDate.setMonth(startDate.getMonth() - 1);
        }
        
        const activities = await firestoreService.getActivitiesByDateRange(
            lineUserId,
            startDate.toISOString().split('T')[0],
            new Date().toISOString().split('T')[0]
        );
        
        // Calculate breakdown by activity type
        const breakdown = {};
        let totalPoints = 0;
        
        activities.forEach(activity => {
            if (!breakdown[activity.activityType]) {
                breakdown[activity.activityType] = {
                    type: activity.activityType,
                    title: activity.title,
                    count: 0,
                    points: 0
                };
            }
            breakdown[activity.activityType].count += 1;
            breakdown[activity.activityType].points += activity.points;
            totalPoints += activity.points;
        });
        
        // Calculate percentages
        Object.values(breakdown).forEach(item => {
            item.percentage = totalPoints > 0 ? 
                Math.round((item.points / totalPoints) * 100) : 0;
        });
        
        res.json({
            period,
            totalPoints,
            breakdown: Object.values(breakdown).sort((a, b) => b.points - a.points)
        });
    } catch (error) {
        console.error('Error getting breakdown:', error);
        res.status(500).json({ error: 'Failed to get breakdown' });
    }
});

// Analytics endpoint - Performance metrics
app.get('/api/analytics/performance', async (req, res) => {
    const { lineUserId } = req.query;
    
    try {
        // Get current month performance
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        
        const [currentActivities, lastMonthActivities, user] = await Promise.all([
            firestoreService.getActivitiesByDateRange(
                lineUserId,
                currentMonthStart.toISOString().split('T')[0],
                now.toISOString().split('T')[0]
            ),
            firestoreService.getActivitiesByDateRange(
                lineUserId,
                lastMonthStart.toISOString().split('T')[0],
                lastMonthEnd.toISOString().split('T')[0]
            ),
            firestoreService.getUser(lineUserId)
        ]);
        
        const currentPoints = currentActivities.reduce((sum, a) => sum + a.points, 0);
        const lastMonthPoints = lastMonthActivities.reduce((sum, a) => sum + a.points, 0);
        
        // Calculate growth
        const growth = lastMonthPoints > 0 ? 
            Math.round(((currentPoints - lastMonthPoints) / lastMonthPoints) * 100) : 100;
        
        // Calculate daily average
        const daysInCurrentMonth = now.getDate();
        const dailyAverage = Math.round(currentPoints / daysInCurrentMonth);
        
        // Calculate streak
        const sortedActivities = currentActivities.sort((a, b) => 
            b.date.localeCompare(a.date)
        );
        let streak = 0;
        let checkDate = new Date();
        
        for (let i = 0; i < 30; i++) {
            const dateStr = checkDate.toISOString().split('T')[0];
            if (sortedActivities.some(a => a.date === dateStr)) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }
        
        res.json({
            currentMonth: {
                points: currentPoints,
                activities: currentActivities.length,
                dailyAverage
            },
            lastMonth: {
                points: lastMonthPoints,
                activities: lastMonthActivities.length
            },
            growth: {
                percentage: growth,
                direction: growth >= 0 ? 'up' : 'down'
            },
            streak: {
                days: streak,
                isActive: streak > 0
            },
            rank: user?.rank || 'Unranked'
        });
    } catch (error) {
        console.error('Error getting performance:', error);
        res.status(500).json({ error: 'Failed to get performance metrics' });
    }
});

// Get leaderboard
app.get('/api/leaderboard/:period', async (req, res) => {
    const { period } = req.params;
    const { date } = req.query;
    
    if (!['daily', 'weekly', 'monthly'].includes(period)) {
        return res.status(400).json({ error: 'Invalid period. Use daily, weekly, or monthly' });
    }
    
    try {
        const leaderboard = await firestoreService.getLeaderboard(period, date);
        res.json(leaderboard);
    } catch (error) {
        console.error('Error getting leaderboard:', error);
        res.status(500).json({ error: 'Failed to get leaderboard' });
    }
});

// LINE webhook
app.post('/webhook', async (req, res) => {
    try {
        const events = req.body.events;
        
        for (const event of events) {
            if (event.type === 'message' && event.message.type === 'text') {
                const { replyToken, source, message } = event;
                
                // Handle group registration
                if (message.text === '/register' && source.type === 'group') {
                    const groupId = source.groupId;
                    const userId = source.userId;
                    
                    // Register the group
                    await firestoreService.registerGroup(groupId, null, userId);
                    
                    await lineClient.replyMessage(replyToken, {
                        type: 'text',
                        text: '✅ กลุ่มนี้ได้รับการลงทะเบียนเรียบร้อยแล้ว!\nระบบจะส่งการแจ้งเตือนกิจกรรมมาที่กลุ่มนี้'
                    });
                } 
                // Handle notification toggle
                else if (message.text === '/toggle' && source.type === 'group') {
                    const groupId = source.groupId;
                    const newStatus = await firestoreService.toggleGroupNotifications(groupId);
                    
                    await lineClient.replyMessage(replyToken, {
                        type: 'text',
                        text: newStatus 
                            ? '🔔 เปิดการแจ้งเตือนแล้ว' 
                            : '🔕 ปิดการแจ้งเตือนแล้ว'
                    });
                }
            }
        }
        
        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).send('Error');
    }
});

// Cleanup expired cache periodically
setInterval(() => {
    firestoreService.cleanupExpiredCache().catch(console.error);
}, 15 * 60 * 1000); // Every 15 minutes

// Start server after LINE client is initialized
async function startServer() {
    try {
        // Wait for LINE client initialization
        await initializeLineClient();
        
        app.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
            console.log(`📊 Using Firestore database`);
            console.log(`🔒 Secrets managed by: ${process.env.NODE_ENV === 'production' ? 'Secret Manager' : 'Environment Variables'}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();