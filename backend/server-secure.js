const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// Security middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit login attempts
    message: 'Too many login attempts, please try again later.'
});

// Apply rate limiting to all API routes
app.use('/api/', generalLimiter);
app.use('/api/auth/', authLimiter);

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// JWT Secret (should be in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Database setup with better error handling
const dbPath = process.env.NODE_ENV === 'production' 
    ? '/tmp/sales-tracker.db' 
    : path.join(__dirname, 'sales-tracker.db');

console.log('Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
        process.exit(1);
    }
    console.log('Connected to SQLite database');
});

// Error handling wrapper
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
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

// Initialize database with indexes
db.serialize(() => {
    // Create tables with proper constraints
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            line_user_id TEXT UNIQUE NOT NULL,
            display_name TEXT NOT NULL,
            picture_url TEXT,
            status_message TEXT,
            email TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            line_user_id TEXT NOT NULL,
            activity_type TEXT NOT NULL CHECK(activity_type IN ('โทร', 'นัด', 'ชิง', 'ข่าวสาร', 'เริ่มเซน')),
            title TEXT NOT NULL,
            description TEXT,
            points INTEGER NOT NULL CHECK(points >= 0 AND points <= 1000),
            date DATE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (line_user_id) REFERENCES users(line_user_id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS group_registrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id TEXT UNIQUE NOT NULL,
            group_name TEXT,
            registered_by TEXT,
            notifications_enabled BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // User achievements table
    db.run(`
        CREATE TABLE IF NOT EXISTS user_achievements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            line_user_id TEXT NOT NULL,
            achievement_id TEXT NOT NULL,
            unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(line_user_id, achievement_id),
            FOREIGN KEY(line_user_id) REFERENCES users(line_user_id)
        )
    `);

    // User streaks table
    db.run(`
        CREATE TABLE IF NOT EXISTS user_streaks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            line_user_id TEXT UNIQUE NOT NULL,
            current_streak INTEGER DEFAULT 0,
            longest_streak INTEGER DEFAULT 0,
            last_activity_date DATE,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(line_user_id) REFERENCES users(line_user_id)
        )
    `);

    // Create indexes for better performance
    db.run(`CREATE INDEX IF NOT EXISTS idx_activities_user_date ON activities(line_user_id, date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_users_line_id ON users(line_user_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_groups_id ON group_registrations(group_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_achievements_user ON user_achievements(line_user_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_streaks_user ON user_streaks(line_user_id)`);
});

// Validation middleware
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '3.7.13'
    });
});

// Authentication endpoint (for demo purposes - in production, use LINE OAuth)
app.post('/api/auth/login', [
    body('lineUserId').isString().notEmpty().trim().escape(),
    body('displayName').optional().isString().trim().escape(),
    validate
], asyncHandler(async (req, res) => {
    const { lineUserId, displayName } = req.body;
    
    // In production, verify with LINE API
    // For now, create/update user and return JWT
    const user = await new Promise((resolve, reject) => {
        db.get(
            'SELECT * FROM users WHERE line_user_id = ?',
            [lineUserId],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });

    if (!user && displayName) {
        // Create new user
        await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO users (line_user_id, display_name) VALUES (?, ?)',
                [lineUserId, displayName],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    // Generate JWT
    const token = jwt.sign(
        { lineUserId, displayName: user?.display_name || displayName },
        JWT_SECRET,
        { expiresIn: '7d' }
    );

    res.json({ token, user: { lineUserId, displayName: user?.display_name || displayName } });
}));

// User registration/update with validation
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
    
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO users (line_user_id, display_name, picture_url, status_message, email, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    stmt.run(userIdParam, nameParam, pictureUrl, statusMessage, email, function(err) {
        if (err) {
            console.error('Error saving user:', err);
            return res.status(500).json({ error: 'Failed to save user', details: err.message });
        }
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
    });
    
    stmt.finalize();
}));



// Get leaderboard with validation
app.get('/api/leaderboard', [
    query('period').isIn(['today', 'week', 'month']),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    validate
], asyncHandler(async (req, res) => {
    const { period } = req.query;
    const limit = req.query.limit || 10;
    
    let dateCondition = '';
    const params = [];
    
    switch(period) {
        case 'today':
            dateCondition = 'WHERE a.date = date("now")';
            break;
        case 'week':
            dateCondition = 'WHERE a.date >= date("now", "-7 days")';
            break;
        case 'month':
            dateCondition = 'WHERE a.date >= date("now", "-30 days")';
            break;
    }
    
    const query = `
        SELECT 
            u.line_user_id,
            u.display_name,
            u.picture_url,
            SUM(a.points) as total_points,
            COUNT(a.id) as activity_count
        FROM users u
        LEFT JOIN activities a ON u.line_user_id = a.line_user_id
        ${dateCondition}
        GROUP BY u.line_user_id
        ORDER BY total_points DESC
        LIMIT ?
    `;
    
    params.push(limit);
    
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error fetching leaderboard:', err);
            return res.status(500).json({ error: 'Failed to fetch leaderboard' });
        }
        res.json({ 
            leaderboard: rows.map((row, index) => ({
                ...row,
                rank: index + 1,
                total_points: row.total_points || 0
            }))
        });
    });
}));

// Delete activity with validation
app.delete('/api/activities/:id', [
    param('id').isInt().toInt(),
    validate
], authenticateToken, asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // First check if activity belongs to user
    const activity = await new Promise((resolve, reject) => {
        db.get('SELECT line_user_id FROM activities WHERE id = ?', [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
    
    if (!activity) {
        return res.status(404).json({ error: 'Activity not found' });
    }
    
    if (activity.line_user_id !== req.user.lineUserId) {
        return res.status(403).json({ error: 'Cannot delete other users activities' });
    }
    
    db.run('DELETE FROM activities WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('Error deleting activity:', err);
            return res.status(500).json({ error: 'Failed to delete activity' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Activity not found' });
        }
        
        res.json({ message: 'Activity deleted successfully' });
    });
}));

// Create activity with JWT authentication and user isolation
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
    
    const query = `
        INSERT INTO activities (line_user_id, activity_type, title, description, points, date)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    db.run(query, [userIdParam, mappedType, titleParam, '', points * quantity, dateParam], function(err) {
        if (err) {
            console.error('Error creating activity:', err);
            return res.status(500).json({ error: 'Failed to create activity' });
        }
        
        res.status(201).json({ 
            success: true,
            activity: {
                id: this.lastID,
                lineUserId: userIdParam,
                activityType: mappedType,
                title: titleParam,
                points: points * quantity,
                date: dateParam
            }
        });
    });
}));

// Get user activities (frontend-compatible)
app.get('/api/activities/:lineUserId', authenticateToken, [
    param('lineUserId').isLength({ min: 1 }).escape(),
    validate
], asyncHandler(async (req, res) => {
    const { lineUserId } = req.params;
    const { limit = 50 } = req.query;
    
    // Authorization: Users can only access their own activities
    if (req.user.lineUserId !== lineUserId) {
        return res.status(403).json({ error: 'Cannot access other users activities' });
    }
    
    const query = `
        SELECT id, activity_type, title, description, points, date, created_at 
        FROM activities 
        WHERE line_user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
    `;
    
    db.all(query, [lineUserId, parseInt(limit)], (err, rows) => {
        if (err) {
            console.error('Error fetching activities:', err);
            return res.status(500).json({ error: 'Failed to fetch activities' });
        }
        
        // Map backend format to frontend format
        const activities = rows.map(row => ({
            id: row.id,
            type: mapBackendToFrontendType(row.activity_type),
            points: row.points,
            timestamp: row.created_at,
            title: row.title,
            description: row.description
        }));
        
        res.json(activities);
    });
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

// Get user achievements
app.get('/api/achievements/:lineUserId', authenticateToken, [
    param('lineUserId').isLength({ min: 1 }).escape(),
    validate
], asyncHandler(async (req, res) => {
    const { lineUserId } = req.params;
    
    // Authorization: Users can only access their own achievements
    if (req.user.lineUserId !== lineUserId) {
        return res.status(403).json({ error: 'Cannot access other users achievements' });
    }
    
    const query = `SELECT achievement_id, unlocked_at FROM user_achievements WHERE line_user_id = ?`;
    
    db.all(query, [lineUserId], (err, rows) => {
        if (err) {
            console.error('Error fetching achievements:', err);
            return res.status(500).json({ error: 'Failed to fetch achievements' });
        }
        
        res.json(rows);
    });
}));

// Unlock achievement
app.post('/api/achievements', authenticateToken, [
    body('lineUserId').isLength({ min: 1 }).escape(),
    body('achievementId').isLength({ min: 1 }).escape(),
    validate
], asyncHandler(async (req, res) => {
    const { lineUserId, achievementId } = req.body;
    
    // Authorization: Users can only unlock their own achievements
    if (req.user.lineUserId !== lineUserId) {
        return res.status(403).json({ error: 'Cannot unlock achievements for other users' });
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
}));

// Get user streak data
app.get('/api/streak/:lineUserId', authenticateToken, [
    param('lineUserId').isLength({ min: 1 }).escape(),
    validate
], asyncHandler(async (req, res) => {
    const { lineUserId } = req.params;
    
    // Authorization: Users can only access their own streak data
    if (req.user.lineUserId !== lineUserId) {
        return res.status(403).json({ error: 'Cannot access other users streak data' });
    }
    
    const query = `SELECT current_streak, longest_streak, last_activity_date FROM user_streaks WHERE line_user_id = ?`;
    
    db.get(query, [lineUserId], (err, row) => {
        if (err) {
            console.error('Error fetching streak:', err);
            return res.status(500).json({ error: 'Failed to fetch streak' });
        }
        
        res.json(row || { current_streak: 0, longest_streak: 0, last_activity_date: null });
    });
}));

// Update user streak
app.post('/api/streak', authenticateToken, [
    body('lineUserId').isLength({ min: 1 }).escape(),
    body('currentStreak').isInt({ min: 0 }).toInt(),
    body('longestStreak').isInt({ min: 0 }).toInt(),
    body('lastActivityDate').optional().isISO8601(),
    validate
], asyncHandler(async (req, res) => {
    const { lineUserId, currentStreak, longestStreak, lastActivityDate } = req.body;
    
    // Authorization: Users can only update their own streak data
    if (req.user.lineUserId !== lineUserId) {
        return res.status(403).json({ error: 'Cannot update other users streak data' });
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
}));

// Frontend-compatible endpoints (no authentication required)
// These are for the LIFF app frontend which doesn't handle JWT tokens

// Create activity (frontend-compatible version without JWT auth)
app.post('/api/frontend/activities', [
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
    
    const query = `
        INSERT INTO activities (line_user_id, activity_type, title, description, points, date)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    db.run(query, [userIdParam, mappedType, titleParam, '', points * quantity, dateParam], function(err) {
        if (err) {
            console.error('Error creating activity:', err);
            return res.status(500).json({ error: 'Failed to create activity' });
        }
        
        res.status(201).json({ 
            success: true,
            activity: {
                id: this.lastID,
                lineUserId: userIdParam,
                activityType: mappedType,
                title: titleParam,
                points: points * quantity,
                date: dateParam
            }
        });
    });
}));

// Get user activities (frontend-compatible)
app.get('/api/frontend/activities/:lineUserId', [
    param('lineUserId').isLength({ min: 1 }).escape(),
    validate
], asyncHandler(async (req, res) => {
    const { lineUserId } = req.params;
    const { limit = 50 } = req.query;
    
    const query = `
        SELECT id, activity_type, title, description, points, date, created_at 
        FROM activities 
        WHERE line_user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
    `;
    
    db.all(query, [lineUserId, parseInt(limit)], (err, rows) => {
        if (err) {
            console.error('Error fetching activities:', err);
            return res.status(500).json({ error: 'Failed to fetch activities' });
        }
        
        // Map backend format to frontend format
        const activities = rows.map(row => ({
            id: row.id,
            type: mapBackendToFrontendType(row.activity_type),
            points: row.points,
            timestamp: row.created_at,
            title: row.title,
            description: row.description
        }));
        
        res.json(activities);
    });
}));

// Get user achievements (frontend-compatible)
app.get('/api/frontend/achievements/:lineUserId', [
    param('lineUserId').isLength({ min: 1 }).escape(),
    validate
], asyncHandler(async (req, res) => {
    const { lineUserId } = req.params;
    
    const query = `SELECT achievement_id, unlocked_at FROM user_achievements WHERE line_user_id = ?`;
    
    db.all(query, [lineUserId], (err, rows) => {
        if (err) {
            console.error('Error fetching achievements:', err);
            return res.status(500).json({ error: 'Failed to fetch achievements' });
        }
        
        res.json(rows);
    });
}));

// Unlock achievement (frontend-compatible)
app.post('/api/frontend/achievements', [
    body('lineUserId').isLength({ min: 1 }).escape(),
    body('achievementId').isLength({ min: 1 }).escape(),
    validate
], asyncHandler(async (req, res) => {
    const { lineUserId, achievementId } = req.body;
    
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
}));

// Get user streak data (frontend-compatible)
app.get('/api/frontend/streak/:lineUserId', [
    param('lineUserId').isLength({ min: 1 }).escape(),
    validate
], asyncHandler(async (req, res) => {
    const { lineUserId } = req.params;
    
    const query = `SELECT current_streak, longest_streak, last_activity_date FROM user_streaks WHERE line_user_id = ?`;
    
    db.get(query, [lineUserId], (err, row) => {
        if (err) {
            console.error('Error fetching streak:', err);
            return res.status(500).json({ error: 'Failed to fetch streak' });
        }
        
        res.json(row || { current_streak: 0, longest_streak: 0, last_activity_date: null });
    });
}));

// Update user streak (frontend-compatible)
app.post('/api/frontend/streak', [
    body('lineUserId').isLength({ min: 1 }).escape(),
    body('currentStreak').isInt({ min: 0 }).toInt(),
    body('longestStreak').isInt({ min: 0 }).toInt(),
    body('lastActivityDate').optional().isISO8601(),
    validate
], asyncHandler(async (req, res) => {
    const { lineUserId, currentStreak, longestStreak, lastActivityDate } = req.body;
    
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
}));

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    
    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    res.status(err.status || 500).json({
        error: isDevelopment ? err.message : 'Internal server error',
        ...(isDevelopment && { stack: err.stack })
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Secure backend server running on port ${PORT}`);
    console.log(`🔒 Security features enabled: Helmet, Rate Limiting, Input Validation, JWT Auth`);
    console.log(`📊 Database: ${dbPath}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing database connection...');
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Database connection closed.');
        process.exit(0);
    });
});

module.exports = app; // For testing