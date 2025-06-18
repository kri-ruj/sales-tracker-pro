const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Client } = require('@line/bot-sdk');
const jwt = require('jsonwebtoken');
const { body, param, query, validationResult } = require('express-validator');
require('dotenv').config();

// Import Firestore service
const firestoreService = require('./services/firestore.service');
const { createActivitySubmissionFlex, sendFlexMessage } = require('./activity-flex-message-compact');
const lineQuotaService = require('./services/line-quota.service');

const app = express();
const PORT = process.env.PORT || 10000;

// JWT Secret (should be in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'finnergy-sales-tracker-jwt-secret-2025-production-key-secure';

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

// Validation middleware
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Error handling wrapper
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

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
        authEnabled: true,
        timestamp: new Date().toISOString() 
    });
});

// JWT Authentication endpoint
app.post('/api/auth/login', [
    body('lineUserId').isString().notEmpty().trim().escape(),
    body('displayName').isString().notEmpty().trim().escape(),
    validate
], asyncHandler(async (req, res) => {
    const { lineUserId, displayName } = req.body;
    
    // Get or create user in Firestore
    let user = await firestoreService.getUser(lineUserId);
    
    if (!user) {
        // Create new user
        await firestoreService.createOrUpdateUser(lineUserId, {
            displayName,
            lineUserId
        });
        user = { lineUserId, displayName };
    }

    // Generate JWT
    const token = jwt.sign(
        { lineUserId, displayName: user.displayName || displayName },
        JWT_SECRET,
        { expiresIn: '7d' }
    );

    res.json({ token, user });
}));

// Google authentication endpoint
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client();

app.post('/api/auth/google', [
    body('idToken').isString().notEmpty(),
    validate
], asyncHandler(async (req, res) => {
    const { idToken } = req.body;
    
    try {
        // Verify Google ID token
        const ticket = await googleClient.verifyIdToken({
            idToken: idToken,
            audience: process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com'
        });
        
        const payload = ticket.getPayload();
        const googleId = payload['sub'];
        const email = payload['email'];
        const name = payload['name'];
        const picture = payload['picture'];
        
        // Get or create user in Firestore
        let user = await firestoreService.getUser(googleId);
        
        if (!user) {
            // Create new user
            await firestoreService.createOrUpdateUser(googleId, {
                displayName: name,
                email: email,
                pictureUrl: picture,
                googleId: googleId
            });
            user = { googleId, displayName: name, email, pictureUrl: picture };
        }
        
        // Generate JWT
        const token = jwt.sign(
            { 
                lineUserId: googleId, 
                displayName: user.displayName || name,
                email: email,
                authMethod: 'google'
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({ 
            token, 
            user: {
                ...user,
                googleId,
                email,
                name
            }
        });
    } catch (error) {
        console.error('Google auth error:', error);
        res.status(401).json({ error: 'Invalid Google token' });
    }
}));

// Get user data with JWT authentication
app.get('/api/users/:userId', authenticateToken, [
    param('userId').isLength({ min: 1 }).escape(),
    validate
], asyncHandler(async (req, res) => {
    const { userId } = req.params;
    
    // Authorization: Users can only access their own data
    if (req.user.lineUserId !== userId) {
        return res.status(403).json({ error: 'Cannot access other users data' });
    }
    
    const user = await firestoreService.getUser(userId);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
}));

// User registration/update
app.post('/api/users', [
    body('lineUserId').optional().isString().notEmpty().trim().escape(),
    body('userId').optional().isString().notEmpty().trim().escape(),
    body('displayName').optional().isString().notEmpty().trim().escape(),
    body('name').optional().isString().notEmpty().trim().escape(),
    body('pictureUrl').optional().isURL(),
    body('statusMessage').optional().isString().trim().escape(),
    body('email').optional().isEmail().normalizeEmail(),
    validate
], asyncHandler(async (req, res) => {
    const { lineUserId, userId, displayName, name, pictureUrl, statusMessage, email } = req.body;
    
    // Support both parameter formats
    const userIdParam = lineUserId || userId;
    const nameParam = displayName || name;
    
    if (!userIdParam || !nameParam) {
        return res.status(400).json({ error: 'userId/lineUserId and name/displayName are required' });
    }
    
    await firestoreService.createOrUpdateUser(userIdParam, {
        displayName: nameParam,
        pictureUrl,
        statusMessage,
        email
    });
    
    res.json({ 
        success: true,
        user: { 
            lineUserId: userIdParam, 
            displayName: nameParam, 
            pictureUrl, 
            statusMessage, 
            email 
        }
    });
}));

// Create activity with JWT authentication
app.post('/api/activities', authenticateToken, [
    body('lineUserId').optional().isString().notEmpty().trim().escape(),
    body('userId').optional().isString().notEmpty().trim().escape(),
    body('activityType').optional().isString().trim(),
    body('type').optional().isString().trim(),
    body('title').optional().isString().isLength({ min: 1, max: 200 }).trim().escape(),
    body('points').isInt({ min: 0, max: 1000 }),
    body('quantity').optional().isInt({ min: 1, max: 100 }).toInt(),
    body('timestamp').optional().isISO8601(),
    body('date').optional().isISO8601(),
    validate
], asyncHandler(async (req, res) => {
    const { 
        lineUserId, userId, 
        activityType, type,
        title,
        points,
        quantity = 1,
        timestamp,
        date
    } = req.body;
    
    // Support both parameter formats
    const userIdParam = lineUserId || userId;
    const typeParam = activityType || type;
    const titleParam = title || `${typeParam} activity`;
    const dateParam = date || (timestamp ? new Date(timestamp).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    
    if (!userIdParam || !typeParam || points === undefined) {
        return res.status(400).json({ error: 'userId, type, and points are required' });
    }
    
    // Authorization: Users can only create activities for themselves
    if (req.user.lineUserId !== userIdParam) {
        return res.status(403).json({ error: 'Cannot create activities for other users' });
    }
    
    // Map frontend activity types to backend types
    const activityTypeMap = {
        'phone': 'โทร',
        'meeting': 'นัด', 
        'quote': 'ชิง',
        'collab': 'ข่าวสาร',
        'present': 'เริ่มเซน',
        'training': 'เริ่มเซน',
        'contract': 'ชิง',
        'other': 'ข่าวสาร'
    };
    
    const mappedType = activityTypeMap[typeParam] || 'ข่าวสาร';
    
    const activity = await firestoreService.createActivity({
        lineUserId: userIdParam,
        activityType: mappedType,
        title: titleParam,
        points: points * quantity,
        date: dateParam
    });
    
    res.status(201).json({ 
        success: true,
        activity
    });
}));

// Get user activities with JWT authentication
app.get('/api/activities/:lineUserId', authenticateToken, [
    param('lineUserId').isLength({ min: 1 }).escape(),
    validate
], asyncHandler(async (req, res) => {
    const { lineUserId } = req.params;
    
    // Authorization: Users can only access their own activities
    if (req.user.lineUserId !== lineUserId) {
        return res.status(403).json({ error: 'Cannot access other users activities' });
    }
    
    const activities = await firestoreService.getUserActivities(lineUserId);
    
    // Map backend format to frontend format
    const mappedActivities = activities.map(activity => ({
        id: activity.id,
        type: mapBackendToFrontendType(activity.activityType),
        points: activity.points,
        timestamp: activity.createdAt,
        title: activity.title,
        description: activity.description || ''
    }));
    
    res.json(mappedActivities);
}));

// Helper function to map backend types to frontend types
function mapBackendToFrontendType(backendType) {
    const typeMap = {
        'โทร': 'phone',
        'นัด': 'meeting',
        'ชิง': 'quote',
        'ข่าวสาร': 'collab',
        'เริ่มเซน': 'present'
    };
    return typeMap[backendType] || 'other';
}

// Delete activity with JWT authentication
app.delete('/api/activities/:id', [
    param('id').isLength({ min: 1 }),
    validate
], authenticateToken, asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Get activity to check ownership
    const activities = await firestoreService.getUserActivities(req.user.lineUserId);
    const activity = activities.find(a => a.id === id);
    
    if (!activity) {
        return res.status(404).json({ error: 'Activity not found' });
    }
    
    await firestoreService.deleteActivity(id);
    res.json({ message: 'Activity deleted successfully' });
}));

// Get leaderboard (public endpoint)
app.get('/api/leaderboard', [
    query('period').isIn(['today', 'week', 'month']),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    validate
], asyncHandler(async (req, res) => {
    const { period } = req.query;
    
    const periodMap = {
        'today': 'daily',
        'week': 'weekly',
        'month': 'monthly'
    };
    
    const leaderboard = await firestoreService.getLeaderboard(periodMap[period]);
    
    res.json({ 
        leaderboard: leaderboard.entries.map((entry, index) => ({
            ...entry,
            line_user_id: entry.userId,
            display_name: entry.displayName,
            picture_url: entry.pictureUrl,
            total_points: entry.points,
            activity_count: entry.activities
        }))
    });
}));

// Get user achievements with JWT authentication
app.get('/api/achievements/:lineUserId', authenticateToken, [
    param('lineUserId').isLength({ min: 1 }).escape(),
    validate
], asyncHandler(async (req, res) => {
    const { lineUserId } = req.params;
    
    // Authorization check
    if (req.user.lineUserId !== lineUserId) {
        return res.status(403).json({ error: 'Cannot access other users achievements' });
    }
    
    const achievements = await firestoreService.getUserAchievements(lineUserId);
    res.json(achievements);
}));

// Get user streak with JWT authentication
app.get('/api/streak/:lineUserId', authenticateToken, [
    param('lineUserId').isLength({ min: 1 }).escape(),
    validate
], asyncHandler(async (req, res) => {
    const { lineUserId } = req.params;
    
    // Authorization check
    if (req.user.lineUserId !== lineUserId) {
        return res.status(403).json({ error: 'Cannot access other users streak' });
    }
    
    const streak = await firestoreService.getUserStreak(lineUserId);
    res.json(streak);
}));

// Update user streak with JWT authentication
app.put('/api/streak/:lineUserId', authenticateToken, [
    param('lineUserId').isLength({ min: 1 }).escape(),
    body('currentStreak').isInt({ min: 0 }),
    body('longestStreak').isInt({ min: 0 }),
    body('lastActivityDate').optional().isISO8601(),
    validate
], asyncHandler(async (req, res) => {
    const { lineUserId } = req.params;
    const { currentStreak, longestStreak, lastActivityDate } = req.body;
    
    // Authorization check
    if (req.user.lineUserId !== lineUserId) {
        return res.status(403).json({ error: 'Cannot update other users streak' });
    }
    
    await firestoreService.updateUserStreak(lineUserId, {
        currentStreak,
        longestStreak,
        lastActivityDate
    });
    
    res.json({ success: true });
}));

// Get team stats (public endpoint)
app.get('/api/team/stats', asyncHandler(async (req, res) => {
    const stats = await firestoreService.getTeamStats();
    res.json(stats);
}));

// LINE webhook handler
app.post('/webhook', asyncHandler(async (req, res) => {
    const events = req.body.events;
    
    for (const event of events) {
        if (event.type === 'message' && event.message.type === 'text') {
            await handleLineMessage(event);
        }
    }
    
    res.status(200).send('OK');
}));

// Handle LINE messages
async function handleLineMessage(event) {
    const { replyToken, source, message } = event;
    const messageText = message.text.trim().toLowerCase();
    
    // Handle commands
    if (messageText === '/register') {
        if (source.type !== 'group' && source.type !== 'room') {
            await lineClient.replyMessage(replyToken, {
                type: 'text',
                text: '❌ This command only works in groups!'
            });
            return;
        }
        
        const groupId = source.groupId || source.roomId;
        await firestoreService.registerGroup(groupId, '', source.userId);
        
        await lineClient.replyMessage(replyToken, {
            type: 'text',
            text: '✅ Group registered for activity notifications!'
        });
    }
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
async function startServer() {
    try {
        // Initialize LINE client
        await initializeLineClient();
        
        // Start cleanup interval for cache
        setInterval(() => {
            firestoreService.cleanupExpiredCache();
        }, 60 * 60 * 1000); // Every hour
        
        app.listen(PORT, () => {
            console.log(`✅ Server running on port ${PORT}`);
            console.log(`📊 Using Firestore database`);
            console.log(`🔐 JWT authentication enabled`);
            console.log(`🤖 LINE integration ${lineClient ? 'ready' : 'disabled'}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();

module.exports = app;