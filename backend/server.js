const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Client } = require('@line/bot-sdk');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();
const { createActivitySubmissionFlex, sendFlexMessage } = require('./activity-flex-message-compact');

// Activity Types (for reference)
const ACTIVITY_TYPES = [
    { id: 'phone', name: 'Phone Call', emoji: '📱', points: 20 },
    { id: 'meeting', name: 'Meeting', emoji: '🤝', points: 50 },
    { id: 'quote', name: 'Quotation', emoji: '📋', points: 10 },
    { id: 'collab', name: 'Collaboration', emoji: '👥', points: 15 },
    { id: 'present', name: 'Presentation', emoji: '📊', points: 30 },
    { id: 'training', name: 'Training', emoji: '🎓', points: 40 },
    { id: 'contract', name: 'Contract', emoji: '📄', points: 25 },
    { id: 'other', name: 'Other', emoji: '✨', points: 15 }
];

const app = express();
const PORT = process.env.PORT || 10000;

// LINE Messaging API configuration
const lineConfig = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const lineClient = new Client(lineConfig);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Version management middleware
const { versionCheckMiddleware } = require('./middleware/version-check');
app.use(versionCheckMiddleware);

// Initialize SQLite database - use file for persistence
const dbPath = process.env.NODE_ENV === 'production' ? '/tmp/sales-tracker.db' : './sales-tracker.db';
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database at:', dbPath);
    }
});

// Create tables
db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        line_user_id TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        picture_url TEXT,
        settings TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Activities table
    db.run(`CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        line_user_id TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        title TEXT NOT NULL,
        subtitle TEXT,
        points INTEGER NOT NULL,
        count INTEGER DEFAULT 1,
        date TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (line_user_id) REFERENCES users (line_user_id)
    )`);

    // Group registrations table
    db.run(`CREATE TABLE IF NOT EXISTS group_registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id TEXT UNIQUE NOT NULL,
        group_name TEXT,
        registered_by TEXT NOT NULL,
        notifications_enabled INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (registered_by) REFERENCES users (line_user_id)
    )`);

    // User achievements table
    db.run(`CREATE TABLE IF NOT EXISTS user_achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        line_user_id TEXT NOT NULL,
        achievement_id TEXT NOT NULL,
        unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(line_user_id, achievement_id),
        FOREIGN KEY(line_user_id) REFERENCES users(line_user_id)
    )`);

    // User streaks table
    db.run(`CREATE TABLE IF NOT EXISTS user_streaks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        line_user_id TEXT UNIQUE NOT NULL,
        current_streak INTEGER DEFAULT 0,
        longest_streak INTEGER DEFAULT 0,
        last_activity_date DATE,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(line_user_id) REFERENCES users(line_user_id)
    )`);
});

// Routes

// Version monitoring routes
const versionMonitorRoutes = require('./routes/version-monitor');
app.use('/api', versionMonitorRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    const packageVersion = require('./package.json').version;
    res.status(200).json({ 
        status: 'OK', 
        message: 'Sales Tracker LINE Backend is running',
        version: packageVersion,
        timestamp: new Date().toISOString() 
    });
});

// Debug endpoint to check registered groups
app.get('/api/debug/groups', (req, res) => {
    db.all('SELECT * FROM group_registrations', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ 
                groups: rows || [],
                count: rows ? rows.length : 0,
                dbPath: dbPath,
                hasToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN
            });
        }
    });
});

// Basic API info
app.get('/', (req, res) => {
    const packageVersion = require('./package.json').version;
    res.json({ 
        message: 'Sales Tracker API',
        status: 'running',
        version: packageVersion,
        endpoints: ['/health', '/api/users', '/api/activities', '/api/team/stats', '/webhook', '/api/debug/groups', '/api/version', '/api/version/health', '/api/version/monitor']
    });
});

// User registration/update
app.post('/api/users', (req, res) => {
    const { lineUserId, displayName, pictureUrl, userId, name } = req.body;
    
    // Support both parameter formats
    const userIdParam = lineUserId || userId;
    const nameParam = displayName || name;

    if (!userIdParam || !nameParam) {
        return res.status(400).json({ error: 'userId/lineUserId and name/displayName are required' });
    }

    const query = `INSERT OR REPLACE INTO users (line_user_id, display_name, picture_url, updated_at)
                   VALUES (?, ?, ?, CURRENT_TIMESTAMP)`;

    db.run(query, [userIdParam, nameParam, pictureUrl], function(err) {
        if (err) {
            console.error('Error saving user:', err);
            return res.status(500).json({ error: 'Failed to save user' });
        }

        res.json({ success: true, userId: this.lastID });
    });
});

// Sync activities from frontend (batch submission)
app.post('/api/activities/sync', async (req, res) => {
    const { userId, userName, userPicture, activities } = req.body;

    if (!userId || !userName || !activities || !Array.isArray(activities)) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`Syncing ${activities.length} activities for user ${userName}`);

    try {
        // First, ensure user exists
        await new Promise((resolve, reject) => {
            const userQuery = `INSERT OR REPLACE INTO users (line_user_id, display_name, picture_url, updated_at)
                             VALUES (?, ?, ?, CURRENT_TIMESTAMP)`;
            db.run(userQuery, [userId, userName, userPicture], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Insert all activities
        const insertPromises = activities.map(activity => {
            return new Promise((resolve, reject) => {
                const query = `INSERT INTO activities (line_user_id, activity_type, title, subtitle, points, count, date)
                             VALUES (?, ?, ?, ?, ?, ?, ?)`;
                const params = [
                    userId,
                    activity.type || activity.id?.split('_')[0] || 'unknown',
                    activity.title,
                    activity.subtitle || '',
                    activity.points,
                    1,
                    activity.date || new Date().toISOString().split('T')[0]
                ];
                
                db.run(query, params, function(err) {
                    if (err) {
                        console.error('Error inserting activity:', err);
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                });
            });
        });

        await Promise.all(insertPromises);

        // Calculate total points
        const totalPoints = activities.reduce((sum, act) => sum + act.points, 0);

        // Get team stats for today
        const teamStats = await new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    COUNT(DISTINCT line_user_id) as activeUsers,
                    SUM(points * count) as totalPoints,
                    COUNT(*) as totalActivities
                FROM activities 
                WHERE date = date('now')
            `;
            db.get(query, (err, row) => {
                if (err) reject(err);
                else resolve(row || { activeUsers: 0, totalPoints: 0, totalActivities: 0 });
            });
        });

        // Get today's leaderboard
        const todayLeaderboard = await new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    u.line_user_id as userId,
                    u.display_name as userName,
                    u.picture_url as pictureUrl,
                    SUM(a.points * a.count) as totalPoints,
                    COUNT(a.id) as activityCount
                FROM users u
                JOIN activities a ON u.line_user_id = a.line_user_id
                WHERE a.date = date('now')
                GROUP BY u.line_user_id, u.display_name, u.picture_url
                ORDER BY totalPoints DESC
                LIMIT 10
            `;
            db.all(query, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        // Send notifications to registered groups
        if (process.env.LINE_CHANNEL_ACCESS_TOKEN) {
            console.log('LINE_CHANNEL_ACCESS_TOKEN is configured, checking for registered groups...');
            const registeredGroups = await new Promise((resolve, reject) => {
                db.all('SELECT group_id FROM group_registrations WHERE notifications_enabled = 1', (err, rows) => {
                    if (err) {
                        console.error('Error fetching registered groups:', err);
                        reject(err);
                    } else {
                        console.log('Raw query result:', rows);
                        resolve(rows || []);
                    }
                });
            });

            console.log(`Found ${registeredGroups.length} registered groups for notifications`);

            // Create user profile object
            const userProfile = {
                userId: userId,
                displayName: userName,
                pictureUrl: userPicture
            };

            // Send flex message to each registered group
            for (const group of registeredGroups) {
                try {
                    const flexMessage = createActivitySubmissionFlex(
                        userName,
                        activities,
                        totalPoints,
                        teamStats,
                        userProfile,
                        todayLeaderboard
                    );
                    
                    await sendFlexMessage(
                        flexMessage,
                        process.env.LINE_CHANNEL_ACCESS_TOKEN,
                        group.group_id
                    );
                    console.log(`Sent activity notification to group ${group.group_id}`);
                } catch (error) {
                    console.error(`Failed to send notification to group ${group.group_id}:`, error);
                }
            }
        }

        res.json({ 
            success: true, 
            message: `${activities.length} activities synced successfully`,
            totalPoints,
            teamStats,
            userRank: todayLeaderboard.findIndex(u => u.userId === userId) + 1
        });

    } catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({ error: 'Failed to sync activities' });
    }
});

// Save activity
app.post('/api/activities', async (req, res) => {
    const { lineUserId, activityType, title, subtitle, points, count, date, groupId, userId, type, quantity, timestamp } = req.body;
    
    // Support both parameter formats
    const userIdParam = lineUserId || userId;
    const typeParam = activityType || type;
    const countParam = count || quantity || 1;
    const dateParam = date || (timestamp ? new Date(timestamp).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    const titleParam = title || (ACTIVITY_TYPES.find(t => t.id === typeParam)?.name || typeParam);

    if (!userIdParam || !typeParam || !points) {
        return res.status(400).json({ error: 'Missing required fields: userId, type, points' });
    }

    const query = `INSERT INTO activities (line_user_id, activity_type, title, subtitle, points, count, date)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`;

    db.run(query, [userIdParam, typeParam, titleParam, subtitle || '', points, countParam, dateParam], async function(err) {
        if (err) {
            console.error('Error saving activity:', err);
            return res.status(500).json({ error: 'Failed to save activity' });
        }

        const activityId = this.lastID;

        // Send notification to LINE group if groupId provided
        if (groupId && process.env.LINE_CHANNEL_ACCESS_TOKEN) {
            try {
                await sendGroupNotification(groupId, {
                    lineUserId: userIdParam,
                    title: titleParam,
                    subtitle: subtitle || '',
                    points,
                    count: countParam
                });
            } catch (error) {
                console.error('Failed to send LINE notification:', error);
            }
        }

        res.json({ success: true, activityId });
    });
});

// Get user activities
app.get('/api/activities/:lineUserId', (req, res) => {
    const { lineUserId } = req.params;
    const { date, limit = 50 } = req.query;

    let query = `SELECT * FROM activities WHERE line_user_id = ?`;
    let params = [lineUserId];

    if (date) {
        query += ` AND date = ?`;
        params.push(date);
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(parseInt(limit));

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error fetching activities:', err);
            return res.status(500).json({ error: 'Failed to fetch activities' });
        }

        res.json(rows);
    });
});

// Get user achievements
app.get('/api/achievements/:lineUserId', (req, res) => {
    const { lineUserId } = req.params;
    
    const query = `SELECT achievement_id, unlocked_at FROM user_achievements WHERE line_user_id = ?`;
    
    db.all(query, [lineUserId], (err, rows) => {
        if (err) {
            console.error('Error fetching achievements:', err);
            return res.status(500).json({ error: 'Failed to fetch achievements' });
        }
        
        res.json(rows);
    });
});

// Unlock achievement
app.post('/api/achievements', (req, res) => {
    const { lineUserId, achievementId } = req.body;
    
    if (!lineUserId || !achievementId) {
        return res.status(400).json({ error: 'Missing lineUserId or achievementId' });
    }
    
    const query = `INSERT OR IGNORE INTO user_achievements (line_user_id, achievement_id) VALUES (?, ?)`;
    
    db.run(query, [lineUserId, achievementId], function(err) {
        if (err) {
            console.error('Error unlocking achievement:', err);
            return res.status(500).json({ error: 'Failed to unlock achievement' });
        }
        
        res.json({ 
            success: true, 
            newUnlock: this.changes > 0,
            achievementId 
        });
    });
});

// Get user streak data
app.get('/api/streak/:lineUserId', (req, res) => {
    const { lineUserId } = req.params;
    
    const query = `SELECT current_streak, longest_streak, last_activity_date FROM user_streaks WHERE line_user_id = ?`;
    
    db.get(query, [lineUserId], (err, row) => {
        if (err) {
            console.error('Error fetching streak:', err);
            return res.status(500).json({ error: 'Failed to fetch streak' });
        }
        
        res.json(row || { current_streak: 0, longest_streak: 0, last_activity_date: null });
    });
});

// Update user streak
app.post('/api/streak', (req, res) => {
    const { lineUserId, currentStreak, longestStreak, lastActivityDate } = req.body;
    
    if (!lineUserId) {
        return res.status(400).json({ error: 'Missing lineUserId' });
    }
    
    const query = `
        INSERT OR REPLACE INTO user_streaks 
        (line_user_id, current_streak, longest_streak, last_activity_date, updated_at) 
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    
    db.run(query, [lineUserId, currentStreak, longestStreak, lastActivityDate], function(err) {
        if (err) {
            console.error('Error updating streak:', err);
            return res.status(500).json({ error: 'Failed to update streak' });
        }
        
        res.json({ success: true });
    });
});

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
    const { date, period = 'today' } = req.query;

    let dateCondition = '';
    if (period === 'today') {
        dateCondition = date ? `WHERE a.date = '${date}'` : `WHERE a.date = date('now')`;
    } else if (period === 'week') {
        dateCondition = `WHERE a.date >= date('now', '-7 days')`;
    } else if (period === 'month') {
        dateCondition = `WHERE a.date >= date('now', '-30 days')`;
    }

    const query = `
        SELECT 
            u.display_name,
            u.picture_url,
            SUM(a.points * a.count) as total_points,
            COUNT(a.id) as activity_count
        FROM users u
        JOIN activities a ON u.line_user_id = a.line_user_id
        ${dateCondition}
        GROUP BY u.line_user_id, u.display_name, u.picture_url
        ORDER BY total_points DESC
        LIMIT 20
    `;

    db.all(query, (err, rows) => {
        if (err) {
            console.error('Error fetching leaderboard:', err);
            return res.status(500).json({ error: 'Failed to fetch leaderboard' });
        }

        res.json(rows);
    });
});

// Register group for notifications
app.post('/api/groups/register', (req, res) => {
    const { groupId, groupName, registeredBy } = req.body;

    if (!groupId || !registeredBy) {
        return res.status(400).json({ error: 'groupId and registeredBy are required' });
    }

    const query = `INSERT OR REPLACE INTO group_registrations (group_id, group_name, registered_by)
                   VALUES (?, ?, ?)`;

    db.run(query, [groupId, groupName, registeredBy], function(err) {
        if (err) {
            console.error('Error registering group:', err);
            return res.status(500).json({ error: 'Failed to register group' });
        }

        res.json({ success: true, message: 'Group registered for notifications' });
    });
});

// User settings endpoints
app.get('/api/user/:lineUserId/settings', (req, res) => {
    const { lineUserId } = req.params;
    
    const query = `SELECT settings FROM users WHERE line_user_id = ?`;
    
    db.get(query, [lineUserId], (err, row) => {
        if (err) {
            console.error('Error fetching settings:', err);
            return res.status(500).json({ error: 'Failed to fetch settings' });
        }
        
        const defaultSettings = {
            userName: '',
            userEmail: '',
            dailyGoal: 50,
            weeklyGoal: 300,
            notifications: true,
            lineNotifications: true,
            soundEffects: true
        };
        
        const settings = row?.settings ? JSON.parse(row.settings) : defaultSettings;
        res.json(settings);
    });
});

app.post('/api/user/:lineUserId/settings', (req, res) => {
    const { lineUserId } = req.params;
    const settings = req.body;
    
    const query = `UPDATE users SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE line_user_id = ?`;
    
    db.run(query, [JSON.stringify(settings), lineUserId], function(err) {
        if (err) {
            console.error('Error saving settings:', err);
            return res.status(500).json({ error: 'Failed to save settings' });
        }
        
        res.json({ 
            success: true, 
            message: 'Settings saved successfully'
        });
    });
});

// User login notification
app.post('/api/user/login', async (req, res) => {
    const { userId, userProfile } = req.body;
    
    if (!userId || !userProfile) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
        // Update user profile in database
        const query = `INSERT OR REPLACE INTO users (line_user_id, display_name, picture_url, updated_at)
                       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`;
        
        await new Promise((resolve, reject) => {
            db.run(query, [userId, userProfile.displayName, userProfile.pictureUrl], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
        
        console.log(`User logged in: ${userProfile.displayName} (${userId})`);
        
        // Could send login notification to groups if needed
        // For now, just log the login event
        
        res.json({ 
            success: true, 
            message: 'Login recorded successfully',
            userId: userId
        });
        
    } catch (error) {
        console.error('Login notification error:', error);
        res.status(500).json({ error: 'Failed to record login' });
    }
});

// Dashboard statistics endpoint
app.get('/api/user/:lineUserId/dashboard', (req, res) => {
    const { lineUserId } = req.params;
    
    // Get user's total points and activity stats
    const statsQuery = `
        SELECT 
            SUM(points * count) as totalPoints,
            COUNT(*) as totalActivities,
            MAX(date) as lastActivityDate
        FROM activities 
        WHERE line_user_id = ?
    `;
    
    // Get today's points
    const todayQuery = `
        SELECT SUM(points * count) as todayPoints
        FROM activities 
        WHERE line_user_id = ? AND date = date('now')
    `;
    
    // Get this week's points
    const weekQuery = `
        SELECT SUM(points * count) as weekPoints
        FROM activities 
        WHERE line_user_id = ? AND date >= date('now', '-7 days')
    `;
    
    db.get(statsQuery, [lineUserId], (err, stats) => {
        if (err) {
            console.error('Error fetching dashboard stats:', err);
            return res.status(500).json({ error: 'Failed to fetch dashboard data' });
        }
        
        db.get(todayQuery, [lineUserId], (err, todayData) => {
            if (err) {
                console.error('Error fetching today stats:', err);
                return res.status(500).json({ error: 'Failed to fetch today data' });
            }
            
            db.get(weekQuery, [lineUserId], (err, weekData) => {
                if (err) {
                    console.error('Error fetching week stats:', err);
                    return res.status(500).json({ error: 'Failed to fetch week data' });
                }
                
                const totalPoints = stats?.totalPoints || 0;
                const currentLevel = Math.floor(totalPoints / 100) + 1;
                
                const dashboardData = {
                    totalPoints,
                    currentLevel,
                    todayPoints: todayData?.todayPoints || 0,
                    weekPoints: weekData?.weekPoints || 0,
                    totalActivities: stats?.totalActivities || 0,
                    lastActivityDate: stats?.lastActivityDate
                };
                
                res.json(dashboardData);
            });
        });
    });
});

// Analytics endpoint - Activity trends over time
app.get('/api/analytics/trends', async (req, res) => {
    const { lineUserId, days = 30 } = req.query;
    
    if (!lineUserId) {
        return res.status(400).json({ error: 'lineUserId is required' });
    }
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    db.all(
        `SELECT date, activity_type, points 
         FROM activities 
         WHERE line_user_id = ? AND date >= ? AND date <= ?
         ORDER BY date ASC`,
        [lineUserId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]],
        (err, activities) => {
            if (err) {
                console.error('Error getting trends:', err);
                return res.status(500).json({ error: 'Failed to get trends' });
            }
            
            // Group by date and activity type
            const trends = {};
            activities.forEach(activity => {
                const date = activity.date;
                if (!trends[date]) {
                    trends[date] = { date, total: 0, types: {} };
                }
                trends[date].total += activity.points;
                trends[date].types[activity.activity_type] = 
                    (trends[date].types[activity.activity_type] || 0) + activity.points;
            });
            
            res.json({
                period: `${days} days`,
                data: Object.values(trends).sort((a, b) => a.date.localeCompare(b.date))
            });
        }
    );
});

// Analytics endpoint - Activity type breakdown
app.get('/api/analytics/breakdown', async (req, res) => {
    const { lineUserId, period = 'monthly' } = req.query;
    
    if (!lineUserId) {
        return res.status(400).json({ error: 'lineUserId is required' });
    }
    
    let startDate = new Date();
    if (period === 'daily') {
        startDate.setHours(0, 0, 0, 0);
    } else if (period === 'weekly') {
        startDate.setDate(startDate.getDate() - 7);
    } else {
        startDate.setMonth(startDate.getMonth() - 1);
    }
    
    db.all(
        `SELECT activity_type, title, points 
         FROM activities 
         WHERE line_user_id = ? AND date >= ?`,
        [lineUserId, startDate.toISOString().split('T')[0]],
        (err, activities) => {
            if (err) {
                console.error('Error getting breakdown:', err);
                return res.status(500).json({ error: 'Failed to get breakdown' });
            }
            
            // Calculate breakdown by activity type
            const breakdown = {};
            let totalPoints = 0;
            
            activities.forEach(activity => {
                if (!breakdown[activity.activity_type]) {
                    breakdown[activity.activity_type] = {
                        type: activity.activity_type,
                        title: activity.title,
                        count: 0,
                        points: 0
                    };
                }
                breakdown[activity.activity_type].count += 1;
                breakdown[activity.activity_type].points += activity.points;
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
        }
    );
});

// Analytics endpoint - Performance metrics
app.get('/api/analytics/performance', async (req, res) => {
    const { lineUserId } = req.query;
    
    if (!lineUserId) {
        return res.status(400).json({ error: 'lineUserId is required' });
    }
    
    // Get current month performance
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    
    // Get current month data
    db.get(
        `SELECT COUNT(*) as activityCount, SUM(points) as totalPoints
         FROM activities 
         WHERE line_user_id = ? AND date >= ?`,
        [lineUserId, monthStart.toISOString().split('T')[0]],
        (err, currentMonth) => {
            if (err) {
                console.error('Error getting current month:', err);
                return res.status(500).json({ error: 'Failed to get performance' });
            }
            
            // Get last month data
            db.get(
                `SELECT COUNT(*) as activityCount, SUM(points) as totalPoints
                 FROM activities 
                 WHERE line_user_id = ? AND date >= ? AND date <= ?`,
                [lineUserId, lastMonthStart.toISOString().split('T')[0], lastMonthEnd.toISOString().split('T')[0]],
                (err, lastMonth) => {
                    if (err) {
                        console.error('Error getting last month:', err);
                        return res.status(500).json({ error: 'Failed to get performance' });
                    }
                    
                    // Get best day
                    db.get(
                        `SELECT date, SUM(points) as points
                         FROM activities 
                         WHERE line_user_id = ?
                         GROUP BY date
                         ORDER BY points DESC
                         LIMIT 1`,
                        [lineUserId],
                        (err, bestDay) => {
                            if (err) {
                                console.error('Error getting best day:', err);
                                return res.status(500).json({ error: 'Failed to get performance' });
                            }
                            
                            const currentPoints = currentMonth?.totalPoints || 0;
                            const lastPoints = lastMonth?.totalPoints || 0;
                            const growth = lastPoints > 0 ? 
                                Math.round(((currentPoints - lastPoints) / lastPoints) * 100) : 0;
                            
                            res.json({
                                currentMonth: {
                                    points: currentPoints,
                                    activities: currentMonth?.activityCount || 0
                                },
                                lastMonth: {
                                    points: lastPoints,
                                    activities: lastMonth?.activityCount || 0
                                },
                                growth,
                                bestDay: bestDay || { date: null, points: 0 },
                                averagePerDay: currentMonth?.activityCount > 0 ?
                                    Math.round(currentPoints / (new Date().getDate())) : 0
                            });
                        }
                    );
                }
            );
        }
    );
});

// LINE Webhook for bot commands
app.post('/webhook', async (req, res) => {
    try {
        const events = req.body.events;

        for (const event of events) {
            if (event.type === 'message' && event.message.type === 'text') {
                await handleTextMessage(event);
            } else if (event.type === 'join') {
                await handleJoinEvent(event);
            }
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).send('Error');
    }
});

// Handle text messages (bot commands)
async function handleTextMessage(event) {
    const { replyToken, source, message } = event;
    const text = message.text.toLowerCase();

    if (text.startsWith('/register')) {
        if (source.type === 'group') {
            // Register group for notifications
            const groupId = source.groupId;
            const userId = source.userId;

            db.run(
                `INSERT OR REPLACE INTO group_registrations (group_id, registered_by) VALUES (?, ?)`,
                [groupId, userId],
                function(err) {
                    if (!err) {
                        replyMessage(replyToken, {
                            type: 'text',
                            text: '✅ This group is now registered for sales activity notifications!'
                        });
                    }
                }
            );
        } else {
            replyMessage(replyToken, {
                type: 'text',
                text: '❌ This command can only be used in group chats.'
            });
        }
    } else if (text === '/leaderboard' || text === '/stats') {
        // Send leaderboard
        const leaderboard = await getLeaderboard();
        replyMessage(replyToken, createLeaderboardMessage(leaderboard));
    } else if (text === '/help') {
        replyMessage(replyToken, {
            type: 'text',
            text: `🤖 Sales Tracker Bot Commands:

/register - Register this group for notifications
/leaderboard - Show team rankings
/stats - Show today's statistics
/help - Show this help message

📱 Open the Sales Tracker:
https://kri-ruj.github.io/sales-tracker-pro/`
        });
    }
}

// Handle join events
async function handleJoinEvent(event) {
    const { replyToken } = event;
    
    const welcomeMessage = {
        type: 'text',
        text: `🏆 Welcome to Sales Tracker!

Use /register to enable activity notifications in this group.
Use /help to see all available commands.

📱 Start tracking: https://kri-ruj.github.io/sales-tracker-pro/`
    };

    await replyMessage(replyToken, welcomeMessage);
}

// Send group notification
async function sendGroupNotification(groupId, activity) {
    try {
        // Get user info
        const user = await getUserInfo(activity.lineUserId);
        const displayName = user ? user.display_name : 'Team Member';

        const message = {
            type: 'flex',
            altText: `🎉 ${displayName} completed ${activity.title}! +${activity.points * activity.count} points`,
            contents: {
                type: 'bubble',
                size: 'compact',
                header: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: '🏆 Sales Achievement!',
                            weight: 'bold',
                            color: '#06C755',
                            size: 'md'
                        }
                    ],
                    backgroundColor: '#F0FDF4'
                },
                body: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: `${displayName} completed:`,
                            size: 'sm',
                            color: '#666666'
                        },
                        {
                            type: 'text',
                            text: activity.title,
                            weight: 'bold',
                            size: 'lg',
                            wrap: true,
                            margin: 'xs'
                        },
                        {
                            type: 'separator',
                            margin: 'md'
                        },
                        {
                            type: 'box',
                            layout: 'horizontal',
                            contents: [
                                {
                                    type: 'text',
                                    text: `+${activity.points * activity.count} points`,
                                    color: '#06C755',
                                    weight: 'bold',
                                    flex: 1
                                },
                                {
                                    type: 'text',
                                    text: `Count: ${activity.count}`,
                                    color: '#999999',
                                    align: 'end'
                                }
                            ],
                            margin: 'md'
                        }
                    ]
                },
                footer: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'button',
                            action: {
                                type: 'uri',
                                label: '📊 Open Sales Tracker',
                                uri: 'https://liff.line.me/2007552096'
                            },
                            style: 'primary',
                            color: '#06C755'
                        }
                    ]
                }
            }
        };

        await lineClient.pushMessage(groupId, message);
    } catch (error) {
        console.error('Error sending group notification:', error);
    }
}

// Helper functions
async function replyMessage(replyToken, message) {
    try {
        await lineClient.replyMessage(replyToken, message);
    } catch (error) {
        console.error('Error replying message:', error);
    }
}

function getUserInfo(lineUserId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE line_user_id = ?', [lineUserId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function getLeaderboard() {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT 
                u.display_name,
                SUM(a.points * a.count) as total_points,
                COUNT(a.id) as activity_count
            FROM users u
            JOIN activities a ON u.line_user_id = a.line_user_id
            WHERE a.date = date('now')
            GROUP BY u.line_user_id, u.display_name
            ORDER BY total_points DESC
            LIMIT 10
        `;

        db.all(query, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function createLeaderboardMessage(leaderboard) {
    if (leaderboard.length === 0) {
        return {
            type: 'text',
            text: '📊 No activities recorded today. Start tracking to see the leaderboard!'
        };
    }

    let leaderboardText = '🏆 Today\'s Leaderboard:\n\n';
    leaderboard.forEach((user, index) => {
        const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📍';
        leaderboardText += `${emoji} ${user.display_name}\n`;
        leaderboardText += `   ${user.total_points} points (${user.activity_count} activities)\n\n`;
    });

    leaderboardText += '📱 Track more activities: https://kri-ruj.github.io/sales-tracker-pro/';

    return {
        type: 'text',
        text: leaderboardText
    };
}

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Sales Tracker LINE Backend running on port ${PORT}`);
    console.log(`📱 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;