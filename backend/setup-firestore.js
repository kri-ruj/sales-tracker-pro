#!/usr/bin/env node

/**
 * Firestore Setup Script
 * This script initializes Firestore collections and migrates data from SQLite
 */

const admin = require('firebase-admin');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS 
  ? require(process.env.GOOGLE_APPLICATION_CREDENTIALS)
  : null;

if (!serviceAccount && process.env.NODE_ENV === 'production') {
  // In production, use Application Default Credentials
  admin.initializeApp({
    projectId: 'salesappfkt',
    databaseId: 'sales-tracker-db'
  });
} else if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'salesappfkt',
    databaseId: 'sales-tracker-db'
  });
} else {
  console.log('⚠️  No credentials found. Using emulator or expecting them in production.');
  admin.initializeApp({
    projectId: 'salesappfkt',
    databaseId: 'sales-tracker-db'
  });
}

const db = admin.firestore({
  databaseId: 'sales-tracker-db'
});

// Collection references
const collections = {
  users: db.collection('users'),
  activities: db.collection('activities'),
  groups: db.collection('groups'),
  cache: db.collection('cache'),
  stats: db.collection('stats')
};

// Create composite indexes
async function createIndexes() {
  console.log('📑 Creating Firestore indexes...');
  
  // Note: Composite indexes need to be created in Firebase Console or via CLI
  // These are the indexes we need:
  const indexes = [
    'activities: lineUserId ASC, date DESC',
    'activities: date DESC, points DESC',
    'activities: lineUserId ASC, created_at DESC'
  ];
  
  console.log('Please create these composite indexes in Firebase Console:');
  indexes.forEach(idx => console.log(`  - ${idx}`));
}

// Migrate data from SQLite to Firestore
async function migrateFromSQLite() {
  console.log('🔄 Starting SQLite to Firestore migration...');
  
  const dbPath = process.env.NODE_ENV === 'production' 
    ? '/tmp/sales-tracker.db' 
    : './sales-tracker.db';
    
  // Check if SQLite database exists
  const fs = require('fs');
  if (!fs.existsSync(dbPath)) {
    console.log('ℹ️  No SQLite database found. Skipping migration.');
    return;
  }
  
  const sqliteDb = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
  
  try {
    // Migrate users
    console.log('👥 Migrating users...');
    await new Promise((resolve, reject) => {
      sqliteDb.all('SELECT * FROM users', async (err, rows) => {
        if (err) {
          console.log('No users table found:', err.message);
          resolve();
          return;
        }
        
        for (const user of rows || []) {
          try {
            await collections.users.doc(user.line_user_id).set({
              displayName: user.display_name,
              pictureUrl: user.picture_url,
              settings: JSON.parse(user.settings || '{}'),
              createdAt: admin.firestore.Timestamp.fromDate(new Date(user.created_at)),
              updatedAt: admin.firestore.Timestamp.fromDate(new Date(user.updated_at))
            });
            console.log(`  ✅ Migrated user: ${user.display_name}`);
          } catch (error) {
            console.error(`  ❌ Failed to migrate user ${user.line_user_id}:`, error);
          }
        }
        resolve();
      });
    });
    
    // Migrate activities
    console.log('📊 Migrating activities...');
    await new Promise((resolve, reject) => {
      sqliteDb.all('SELECT * FROM activities', async (err, rows) => {
        if (err) {
          console.log('No activities table found:', err.message);
          resolve();
          return;
        }
        
        const batch = db.batch();
        let batchCount = 0;
        
        for (const activity of rows || []) {
          try {
            const activityRef = collections.activities.doc();
            batch.set(activityRef, {
              lineUserId: activity.line_user_id,
              activityType: activity.activity_type,
              title: activity.title,
              subtitle: activity.subtitle,
              points: activity.points,
              count: activity.count || 1,
              date: activity.date,
              createdAt: admin.firestore.Timestamp.fromDate(new Date(activity.created_at))
            });
            batchCount++;
            
            // Firestore batch limit is 500
            if (batchCount >= 500) {
              await batch.commit();
              batchCount = 0;
            }
          } catch (error) {
            console.error(`  ❌ Failed to migrate activity ${activity.id}:`, error);
          }
        }
        
        if (batchCount > 0) {
          await batch.commit();
        }
        
        console.log(`  ✅ Migrated ${rows.length} activities`);
        resolve();
      });
    });
    
    // Migrate groups
    console.log('👥 Migrating groups...');
    await new Promise((resolve, reject) => {
      sqliteDb.all('SELECT * FROM group_registrations', async (err, rows) => {
        if (err) {
          console.log('No groups table found:', err.message);
          resolve();
          return;
        }
        
        for (const group of rows || []) {
          try {
            await collections.groups.doc(group.group_id).set({
              groupName: group.group_name,
              registeredBy: group.registered_by,
              notificationsEnabled: group.notifications_enabled === 1,
              createdAt: admin.firestore.Timestamp.fromDate(new Date(group.created_at))
            });
            console.log(`  ✅ Migrated group: ${group.group_name || group.group_id}`);
          } catch (error) {
            console.error(`  ❌ Failed to migrate group ${group.group_id}:`, error);
          }
        }
        resolve();
      });
    });
    
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    sqliteDb.close();
  }
}

// Set up initial data structure
async function setupCollections() {
  console.log('🏗️  Setting up Firestore collections...');
  
  // Create a sample document in each collection to establish structure
  try {
    // Stats collection for aggregated data
    await collections.stats.doc('daily').set({
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      totalUsers: 0,
      totalActivities: 0,
      totalPoints: 0
    });
    
    // Cache collection with TTL example
    await collections.cache.doc('_sample').set({
      description: 'This is a sample cache document',
      data: {},
      expiresAt: admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
      )
    });
    
    console.log('✅ Collections set up successfully!');
    
  } catch (error) {
    console.error('❌ Failed to set up collections:', error);
  }
}

// Main execution
async function main() {
  console.log('🚀 Firestore Setup Script');
  console.log('========================\n');
  
  try {
    // Create indexes info
    await createIndexes();
    
    // Set up collections
    await setupCollections();
    
    // Migrate existing data
    await migrateFromSQLite();
    
    console.log('\n✅ Firestore setup completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Create composite indexes in Firebase Console');
    console.log('2. Update backend code to use Firestore');
    console.log('3. Test the application');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().then(() => process.exit(0));
}

module.exports = { collections, db };