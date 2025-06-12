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

    // Create indexes for better performance
    db.run(`CREATE INDEX IF NOT EXISTS idx_activities_user_date ON activities(line_user_id, date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_users_line_id ON users(line_user_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_groups_id ON group_registrations(group_id)`);
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
    body('lineUserId').isString().notEmpty().trim().escape(),
    body('displayName').isString().notEmpty().trim().escape(),
    body('pictureUrl').optional().isURL(),
    body('statusMessage').optional().isString().trim().escape(),
    body('email').optional().isEmail().normalizeEmail(),
    validate
], authenticateToken, asyncHandler(async (req, res) => {
    const { lineUserId, displayName, pictureUrl, statusMessage, email } = req.body;
    
    // Check if user has permission (should be their own profile)
    if (req.user.lineUserId !== lineUserId) {
        return res.status(403).json({ error: 'Cannot modify other users' });
    }
    
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO users (line_user_id, display_name, picture_url, status_message, email, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    stmt.run(lineUserId, displayName, pictureUrl, statusMessage, email, function(err) {
        if (err) {
            console.error('Error saving user:', err);
            return res.status(500).json({ error: 'Failed to save user', details: err.message });
        }
        res.json({ 
            message: 'User saved successfully', 
            user: { lineUserId, displayName, pictureUrl, statusMessage, email }
        });
    });
    
    stmt.finalize();
}));

// Create activity with validation
app.post('/api/activities', [
    body('lineUserId').isString().notEmpty().trim().escape(),
    body('activityType').isIn(['โทร', 'นัด', 'ชิง', 'ข่าวสาร', 'เริ่มเซน']),
    body('title').isString().isLength({ min: 1, max: 200 }).trim().escape(),
    body('description').optional().isString().isLength({ max: 1000 }).trim().escape(),
    body('points').isInt({ min: 0, max: 1000 }),
    body('date').isISO8601().toDate(),
    validate
], authenticateToken, asyncHandler(async (req, res) => {
    const { lineUserId, activityType, title, description, points, date } = req.body;
    
    // Check if user has permission
    if (req.user.lineUserId !== lineUserId) {
        return res.status(403).json({ error: 'Cannot create activities for other users' });
    }
    
    // Use parameterized query to prevent SQL injection
    const stmt = db.prepare(`
        INSERT INTO activities (line_user_id, activity_type, title, description, points, date)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(lineUserId, activityType, title, description, points, date, function(err) {
        if (err) {
            console.error('Error creating activity:', err);
            return res.status(500).json({ error: 'Failed to create activity' });
        }
        
        res.status(201).json({ 
            activity: {
                id: this.lastID,
                lineUserId,
                activityType,
                title,
                description,
                points,
                date
            },
            message: 'Activity created successfully'
        });
    });
    
    stmt.finalize();
}));

// Get activities with validation and pagination
app.get('/api/activities/:lineUserId', [
    param('lineUserId').isString().notEmpty().trim().escape(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    validate
], authenticateToken, asyncHandler(async (req, res) => {
    const { lineUserId } = req.params;
    const limit = req.query.limit || 50;
    const offset = req.query.offset || 0;
    const { startDate, endDate } = req.query;
    
    // Check if user has permission
    if (req.user.lineUserId !== lineUserId) {
        return res.status(403).json({ error: 'Cannot access other users activities' });
    }
    
    let query = 'SELECT * FROM activities WHERE line_user_id = ?';
    const params = [lineUserId];
    
    if (startDate) {
        query += ' AND date >= ?';
        params.push(startDate);
    }
    
    if (endDate) {
        query += ' AND date <= ?';
        params.push(endDate);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error fetching activities:', err);
            return res.status(500).json({ error: 'Failed to fetch activities' });
        }
        res.json({ activities: rows });
    });
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