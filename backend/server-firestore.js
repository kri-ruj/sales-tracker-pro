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

// Initialize Secret Manager for production
let lineConfig = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
};

// In production, use Secret Manager
if (process.env.NODE_ENV === 'production') {
    const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
    const secretClient = new SecretManagerServiceClient();
    
    async function loadSecrets() {
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
        } catch (error) {
            console.error('Failed to load secrets:', error);
            // Fall back to environment variables
        }
    }
    
    loadSecrets();
}

const lineClient = new Client(lineConfig);

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
    const packageVersion = require('./package.json').version;
    
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
    const packageVersion = require('./package.json').version;
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

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📊 Using Firestore database`);
    console.log(`🔒 Secrets managed by: ${process.env.NODE_ENV === 'production' ? 'Secret Manager' : 'Environment Variables'}`);
});