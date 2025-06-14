const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Client } = require('@line/bot-sdk');
require('dotenv').config();

// Import Firestore service
const firestoreService = require('./services/firestore.service');
const { createActivitySubmissionFlex, sendFlexMessage } = require('./activity-flex-message-compact');
const lineQuotaService = require('./services/line-quota.service');

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

// LINE webhook routes (for mobile-first LINE integration)
const lineWebhookRoutes = require('./routes/line-webhook');
app.use('/', lineWebhookRoutes);

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
        endpoints: [
            '/health', 
            '/api/users', 
            '/api/activities', 
            '/api/achievements/:lineUserId',
            '/api/achievements',
            '/api/streak/:lineUserId',
            '/api/streak',
            '/api/team/stats', 
            '/api/analytics/trends',
            '/api/analytics/breakdown', 
            '/api/analytics/performance',
            '/api/leaderboard/:period',
            '/webhook', 
            '/api/debug/groups', 
            '/api/version', 
            '/api/version/health', 
            '/api/version/monitor'
        ]
    });
});

// User registration/update
app.post('/api/users', async (req, res) => {
    const { lineUserId, displayName, pictureUrl, userId, name } = req.body;
    
    // Support both parameter formats
    const userIdParam = lineUserId || userId;
    const nameParam = displayName || name;
    
    console.log('User params:', { lineUserId, userId, displayName, name, userIdParam, nameParam });
    
    if (!userIdParam || !nameParam) {
        return res.status(400).json({ error: 'userId/lineUserId and name/displayName are required' });
    }
    
    try {
        const user = await firestoreService.createOrUpdateUser(userIdParam, {
            displayName: nameParam,
            pictureUrl
        });
        
        res.json({ 
            success: true, 
            user
        });
    } catch (error) {
        console.error('Error in /api/users:', error);
        res.status(500).json({ 
            error: 'Failed to save user',
            details: error.message,
            code: error.code
        });
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
    const { lineUserId, activityType, title, subtitle, points, count, date, userId, type, quantity, timestamp } = req.body;
    
    // Support both parameter formats
    const userIdParam = lineUserId || userId;
    const typeParam = activityType || type;
    const countParam = count || quantity || 1;
    const dateParam = date || (timestamp ? new Date(timestamp).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    const titleParam = title || `${typeParam} activity`;
    
    if (!userIdParam || !typeParam || points === undefined) {
        return res.status(400).json({ 
            error: 'userId, type, and points are required' 
        });
    }
    
    try {
        const activity = await firestoreService.createActivity({
            lineUserId: userIdParam,
            activityType: typeParam,
            title: titleParam,
            subtitle,
            points: parseInt(points),
            count: parseInt(countParam),
            date: dateParam
        });
        
        // Send notification to registered groups with quota check
        try {
            const groups = await firestoreService.getAllGroups();
            const user = await firestoreService.getUser(userIdParam);
            
            // Get team stats and today's leaderboard for compact message
            const teamStats = await firestoreService.getTeamStats();
            const todayLeaderboard = await firestoreService.getLeaderboard('daily');
            
            // Check quota before sending any messages
            const quotaCheck = await lineQuotaService.canSendMessage('activity', false);
            
            if (!quotaCheck.allowed) {
                console.warn(`LINE quota exceeded: ${quotaCheck.reason}`);
                // Still save the activity, just skip notifications
            } else {
                // Count enabled groups
                const enabledGroups = groups.filter(g => g.notificationsEnabled);
                
                if (enabledGroups.length > 0) {
                    // Check if we have enough quota for all groups
                    if (quotaCheck.remaining < enabledGroups.length) {
                        console.warn(`Not enough quota for all groups. Remaining: ${quotaCheck.remaining}, Need: ${enabledGroups.length}`);
                    }
                    
                    // Send to groups (up to remaining quota)
                    let sentCount = 0;
                    for (const group of enabledGroups) {
                        if (sentCount >= quotaCheck.remaining) break;
                        
                        try {
                            const flexMessage = createActivitySubmissionFlex(
                                user?.displayName || 'Unknown User',
                                [{title: titleParam, subtitle, points}], // Pass as array for compact format
                                points,
                                teamStats,
                                user,
                                todayLeaderboard
                            );
                            
                            await sendFlexMessage(
                                flexMessage,
                                lineConfig.channelAccessToken,
                                group.id
                            );
                            
                            await lineQuotaService.recordMessage('activity', group.id, 1);
                            sentCount++;
                        } catch (sendError) {
                            console.error(`Failed to send to group ${group.id}:`, sendError);
                        }
                    }
                    
                    if (quotaCheck.warning) {
                        console.warn(`LINE quota warning: ${quotaCheck.remaining} messages remaining today`);
                    }
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

// Get LINE quota status
app.get('/api/quota/status', async (req, res) => {
    try {
        const stats = await lineQuotaService.getQuotaStats();
        res.json(stats);
    } catch (error) {
        console.error('Error getting quota status:', error);
        res.status(500).json({ error: 'Failed to get quota status' });
    }
});

// Get user achievements
app.get('/api/achievements/:lineUserId', async (req, res) => {
    const { lineUserId } = req.params;
    
    try {
        const achievements = await firestoreService.getUserAchievements(lineUserId);
        res.json(achievements);
    } catch (error) {
        console.error('Error fetching achievements:', error);
        res.status(500).json({ error: 'Failed to fetch achievements' });
    }
});

// Unlock achievement
app.post('/api/achievements', async (req, res) => {
    const { lineUserId, achievementId } = req.body;
    
    if (!lineUserId || !achievementId) {
        return res.status(400).json({ error: 'Missing lineUserId or achievementId' });
    }
    
    try {
        const result = await firestoreService.unlockAchievement(lineUserId, achievementId);
        res.json({
            success: true,
            newUnlock: result.newUnlock,
            achievementId
        });
    } catch (error) {
        console.error('Error unlocking achievement:', error);
        res.status(500).json({ error: 'Failed to unlock achievement' });
    }
});

// Get user streak data
app.get('/api/streak/:lineUserId', async (req, res) => {
    const { lineUserId } = req.params;
    
    try {
        const streak = await firestoreService.getUserStreak(lineUserId);
        res.json(streak || { current_streak: 0, longest_streak: 0, last_activity_date: null });
    } catch (error) {
        console.error('Error fetching streak:', error);
        res.status(500).json({ error: 'Failed to fetch streak' });
    }
});

// Update user streak
app.post('/api/streak', async (req, res) => {
    const { lineUserId, currentStreak, longestStreak, lastActivityDate } = req.body;
    
    if (!lineUserId) {
        return res.status(400).json({ error: 'Missing lineUserId' });
    }
    
    try {
        await firestoreService.updateUserStreak(lineUserId, {
            currentStreak,
            longestStreak,
            lastActivityDate
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating streak:', error);
        res.status(500).json({ error: 'Failed to update streak' });
    }
});

// Export LINE client for use in routes
app.set('lineClient', lineClient);
app.set('lineConfig', lineConfig);
app.set('firestoreService', firestoreService);

// Authentication routes for mobile-first LINE app
app.post('/api/auth/line', async (req, res) => {
    const { lineUserId, displayName, pictureUrl, statusMessage } = req.body;
    
    if (!lineUserId || !displayName) {
        return res.status(400).json({ error: 'lineUserId and displayName are required' });
    }
    
    try {
        // Create or update user in Firestore
        const user = await firestoreService.createOrUpdateUser(lineUserId, {
            displayName,
            pictureUrl,
            statusMessage,
            lastLogin: new Date().toISOString()
        });
        
        // Generate simple token (in production, use proper JWT)
        const token = Buffer.from(`${lineUserId}:${Date.now()}`).toString('base64');
        
        res.json({ 
            success: true, 
            user,
            token
        });
    } catch (error) {
        console.error('Error in LINE auth:', error);
        res.status(500).json({ 
            error: 'Failed to authenticate',
            details: error.message
        });
    }
});

// Demo login endpoint for development
app.post('/api/demo/login', async (req, res) => {
    try {
        const demoUserId = `demo_${Date.now()}`;
        const user = await firestoreService.createOrUpdateUser(demoUserId, {
            displayName: 'Demo User',
            pictureUrl: null,
            isDemo: true
        });
        
        const token = Buffer.from(`${demoUserId}:${Date.now()}`).toString('base64');
        
        res.json({ 
            success: true, 
            user,
            token
        });
    } catch (error) {
        console.error('Error in demo login:', error);
        res.status(500).json({ 
            error: 'Failed to create demo user'
        });
    }
});

// Get current user
app.get('/api/user', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const token = authHeader.substring(7);
        const decoded = Buffer.from(token, 'base64').toString();
        const [lineUserId] = decoded.split(':');
        
        const user = await firestoreService.getUser(lineUserId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(user);
    } catch (error) {
        console.error('Error getting user:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// Get all activities (for logged in user)
app.get('/api/activities', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const token = authHeader.substring(7);
        const decoded = Buffer.from(token, 'base64').toString();
        const [lineUserId] = decoded.split(':');
        
        const activities = await firestoreService.getUserActivities(lineUserId);
        res.json({ activities });
    } catch (error) {
        console.error('Error getting activities:', error);
        res.status(500).json({ error: 'Failed to get activities' });
    }
});

// Cleanup expired cache and old quota records periodically
setInterval(() => {
    firestoreService.cleanupExpiredCache().catch(console.error);
    lineQuotaService.cleanupOldRecords().catch(console.error);
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