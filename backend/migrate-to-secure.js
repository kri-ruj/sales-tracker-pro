const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = process.env.NODE_ENV === 'production' 
    ? '/tmp/sales-tracker.db' 
    : path.join(__dirname, 'sales-tracker.db');

console.log('🔄 Starting database migration...');
console.log('📊 Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err);
        process.exit(1);
    }
    console.log('✅ Connected to SQLite database');
});

// Run migrations
db.serialize(() => {
    console.log('📝 Adding indexes for better performance...');
    
    // Add indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_activities_user_date ON activities(line_user_id, date)`, (err) => {
        if (err) console.error('❌ Error creating idx_activities_user_date:', err);
        else console.log('✅ Created index: idx_activities_user_date');
    });
    
    db.run(`CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date)`, (err) => {
        if (err) console.error('❌ Error creating idx_activities_date:', err);
        else console.log('✅ Created index: idx_activities_date');
    });
    
    db.run(`CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at)`, (err) => {
        if (err) console.error('❌ Error creating idx_activities_created:', err);
        else console.log('✅ Created index: idx_activities_created');
    });
    
    db.run(`CREATE INDEX IF NOT EXISTS idx_users_line_id ON users(line_user_id)`, (err) => {
        if (err) console.error('❌ Error creating idx_users_line_id:', err);
        else console.log('✅ Created index: idx_users_line_id');
    });
    
    db.run(`CREATE INDEX IF NOT EXISTS idx_groups_id ON group_registrations(group_id)`, (err) => {
        if (err) console.error('❌ Error creating idx_groups_id:', err);
        else console.log('✅ Created index: idx_groups_id');
    });
    
    // Add email column to users table if it doesn't exist
    db.run(`ALTER TABLE users ADD COLUMN email TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Error adding email column:', err);
        } else if (!err) {
            console.log('✅ Added email column to users table');
        }
    });
    
    // Add updated_at column to users table if it doesn't exist
    db.run(`ALTER TABLE users ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Error adding updated_at column:', err);
        } else if (!err) {
            console.log('✅ Added updated_at column to users table');
        }
    });
    
    // Verify table structure
    console.log('\n📊 Verifying table structure...');
    
    db.all("SELECT sql FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) {
            console.error('❌ Error reading table structure:', err);
        } else {
            console.log('\n✅ Current table definitions:');
            tables.forEach(table => {
                console.log(`\n${table.sql}`);
            });
        }
        
        // Close database
        db.close((err) => {
            if (err) {
                console.error('❌ Error closing database:', err);
            } else {
                console.log('\n✅ Migration completed successfully!');
                console.log('🎉 Your database is now optimized with indexes and ready for the secure server.');
            }
        });
    });
});