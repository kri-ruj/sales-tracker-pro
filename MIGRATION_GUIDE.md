# Migration Guide: SQLite to Firestore

## Overview
This guide outlines the migration from SQLite (ephemeral storage) to Firestore (persistent storage) for the Sales Tracker Pro application.

## Why Migrate?
- **Current Issue**: SQLite database at `/tmp/sales-tracker.db` loses data on App Engine instance restarts
- **Solution**: Google Firestore provides persistent, scalable, serverless database

## Migration Steps

### 1. Backend Migration (Completed ✅)
- Created `server-firestore-jwt.js` combining Firestore + JWT authentication
- Updated `app.yaml` to use the new server
- Maintains backward compatibility with existing API endpoints

### 2. Deploy the New Backend
```bash
cd backend
gcloud app deploy
```

### 3. Run Migration Script (Optional)
If you have existing data to migrate:
```bash
cd backend
node setup-firestore.js
```

### 4. Verify Deployment
1. Check health endpoint: https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/health
2. Verify database status shows "firestore"
3. Test authentication flow

## Key Changes

### Database Structure
**SQLite (Old)**
- Tables: users, activities, group_registrations
- Storage: `/tmp/sales-tracker.db` (ephemeral)
- Queries: SQL

**Firestore (New)**
- Collections: users, activities, groups, cache, stats
- Storage: Google Cloud Firestore (persistent)
- Queries: NoSQL document queries

### API Endpoints
All endpoints remain the same, but now:
- Data persists across deployments
- Better scalability
- Automatic backups available
- Real-time sync capabilities

### Authentication
- JWT authentication is maintained
- Same login flow
- Tokens remain valid

## Frontend Changes
No frontend changes required! The API interface remains identical.

## Rollback Plan
If issues occur:
1. Update `app.yaml` to use `server-secure.js`
2. Redeploy: `gcloud app deploy`

## Performance Benefits
- **Persistence**: Data survives instance restarts
- **Scalability**: Automatic scaling with traffic
- **Reliability**: 99.999% uptime SLA
- **Speed**: Built-in caching and indexes

## Cost Considerations
- Firestore free tier: 1GB storage, 50K reads/day, 20K writes/day
- Current usage well within free tier
- Monitor usage in Firebase Console

## Next Steps
1. Deploy the new backend
2. Monitor for 24 hours
3. Run performance tests
4. Consider enabling Firestore backups

## Support
For issues or questions:
- Check logs: `gcloud logs tail sales-tracker-api`
- Firebase Console: https://console.firebase.google.com
- Health check: /health endpoint