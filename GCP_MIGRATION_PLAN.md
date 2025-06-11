# Sales Tracker Pro - Complete GCP Migration Plan

## Executive Summary

This comprehensive migration plan outlines the transition from the current SQLite-based architecture to a fully-managed Google Cloud Platform (GCP) infrastructure. The migration will enhance scalability, reliability, and security while maintaining all existing functionality.

## Current Architecture Analysis

### Existing Components
1. **Frontend**: Static HTML/JS/CSS served via App Engine (python39 runtime)
2. **Backend**: Express.js API on App Engine (nodejs20 runtime)
3. **Database**: SQLite file stored at `/tmp/sales-tracker.db` (temporary storage)
4. **Authentication**: LINE LIFF SDK
5. **Notifications**: LINE Messaging API
6. **Secrets**: Hardcoded in `app.yaml` (security risk)
7. **Cache**: No caching mechanism
8. **Monitoring**: Basic health checks only

### Current Limitations
- SQLite database is stored in `/tmp` (ephemeral storage)
- No data persistence across instance restarts
- Secrets exposed in configuration files
- No caching layer for performance
- Limited monitoring and observability
- No background job processing
- Single-region deployment

## Proposed GCP Architecture

### 1. Database Migration - Cloud SQL (PostgreSQL)

**Why Cloud SQL over Firestore:**
- Current app uses relational data model (users, activities, groups)
- Complex queries with JOINs for leaderboards
- Aggregation queries for statistics
- Minimal code changes required (SQLite → PostgreSQL)

**Implementation Steps:**
```yaml
# terraform/cloud-sql.tf
resource "google_sql_database_instance" "sales_tracker" {
  name             = "sales-tracker-db"
  database_version = "POSTGRES_15"
  region           = "asia-southeast1"
  
  settings {
    tier = "db-f1-micro"  # Free tier eligible
    
    backup_configuration {
      enabled = true
      start_time = "03:00"
    }
    
    ip_configuration {
      ipv4_enabled = true
      private_network = google_compute_network.vpc.id
    }
  }
}
```

**Database Schema Migration:**
```sql
-- migrations/001_initial_schema.sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    line_user_id VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    picture_url TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE activities (
    id SERIAL PRIMARY KEY,
    line_user_id VARCHAR(255) NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    subtitle TEXT,
    points INTEGER NOT NULL,
    count INTEGER DEFAULT 1,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (line_user_id) REFERENCES users(line_user_id)
);

CREATE TABLE group_registrations (
    id SERIAL PRIMARY KEY,
    group_id VARCHAR(255) UNIQUE NOT NULL,
    group_name VARCHAR(255),
    registered_by VARCHAR(255) NOT NULL,
    notifications_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (registered_by) REFERENCES users(line_user_id)
);

-- Indexes for performance
CREATE INDEX idx_activities_user_date ON activities(line_user_id, date);
CREATE INDEX idx_activities_date ON activities(date);
```

### 2. Secret Management - Google Secret Manager

**Implementation:**
```javascript
// backend/services/secrets.js
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

class SecretService {
    constructor() {
        this.client = new SecretManagerServiceClient();
        this.projectId = process.env.GOOGLE_CLOUD_PROJECT;
    }

    async getSecret(name) {
        const [version] = await this.client.accessSecretVersion({
            name: `projects/${this.projectId}/secrets/${name}/versions/latest`,
        });
        
        return version.payload.data.toString();
    }

    async initialize() {
        // Load all secrets at startup
        process.env.LINE_CHANNEL_ACCESS_TOKEN = await this.getSecret('line-channel-access-token');
        process.env.LINE_CHANNEL_SECRET = await this.getSecret('line-channel-secret');
        process.env.DATABASE_URL = await this.getSecret('database-url');
    }
}
```

**Secrets to Migrate:**
- `line-channel-access-token`
- `line-channel-secret`
- `database-url`
- `redis-connection-string`

### 3. Storage Solutions - Cloud Storage

**For Static Assets:**
```yaml
# backend/storage-config.yaml
buckets:
  - name: sales-tracker-assets
    location: ASIA-SOUTHEAST1
    storage_class: STANDARD
    lifecycle:
      - action: { type: Delete }
        condition: { age: 365 }
```

**For User Uploads (future feature):**
```javascript
// backend/services/storage.js
const { Storage } = require('@google-cloud/storage');

class StorageService {
    constructor() {
        this.storage = new Storage();
        this.bucketName = 'sales-tracker-uploads';
    }

    async uploadFile(file, userId) {
        const fileName = `users/${userId}/${Date.now()}-${file.originalname}`;
        const bucket = this.storage.bucket(this.bucketName);
        const blob = bucket.file(fileName);
        
        await blob.save(file.buffer, {
            metadata: {
                contentType: file.mimetype,
            },
        });
        
        return `https://storage.googleapis.com/${this.bucketName}/${fileName}`;
    }
}
```

### 4. Caching Layer - Memorystore (Redis)

**Cache Strategy:**
```javascript
// backend/services/cache.js
const redis = require('redis');

class CacheService {
    constructor() {
        this.client = redis.createClient({
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT,
        });
    }

    // Cache patterns
    async cacheLeaderboard(period, data) {
        const key = `leaderboard:${period}`;
        await this.client.setex(key, 300, JSON.stringify(data)); // 5 min TTL
    }

    async cacheUserStats(userId, stats) {
        const key = `user:${userId}:stats`;
        await this.client.setex(key, 600, JSON.stringify(stats)); // 10 min TTL
    }

    async cacheTeamStats(date, stats) {
        const key = `team:stats:${date}`;
        await this.client.setex(key, 3600, JSON.stringify(stats)); // 1 hour TTL
    }
}
```

**Cache Implementation:**
```javascript
// backend/middleware/cache.js
const cacheMiddleware = (keyPattern, ttl = 300) => {
    return async (req, res, next) => {
        const key = keyPattern(req);
        const cached = await cache.get(key);
        
        if (cached) {
            return res.json(JSON.parse(cached));
        }
        
        // Store original json method
        const originalJson = res.json;
        res.json = function(data) {
            cache.setex(key, ttl, JSON.stringify(data));
            originalJson.call(this, data);
        };
        
        next();
    };
};

// Usage
app.get('/api/leaderboard', 
    cacheMiddleware(req => `leaderboard:${req.query.period}`, 300),
    leaderboardController
);
```

### 5. Background Jobs - Cloud Tasks

**Daily Leaderboard Job:**
```javascript
// backend/services/cloud-tasks.js
const { CloudTasksClient } = require('@google-cloud/tasks');

class TaskService {
    constructor() {
        this.client = new CloudTasksClient();
        this.queuePath = this.client.queuePath(
            process.env.GOOGLE_CLOUD_PROJECT,
            'asia-southeast1',
            'daily-tasks'
        );
    }

    async scheduleDailyLeaderboard() {
        const task = {
            httpRequest: {
                httpMethod: 'POST',
                url: `${process.env.BACKEND_URL}/api/jobs/daily-leaderboard`,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CloudTasks-Token': process.env.CLOUD_TASKS_TOKEN,
                },
            },
            scheduleTime: {
                seconds: Math.floor(Date.now() / 1000) + 86400, // 24 hours
            },
        };

        await this.client.createTask({ parent: this.queuePath, task });
    }
}
```

**Cloud Scheduler Configuration:**
```yaml
# terraform/cloud-scheduler.tf
resource "google_cloud_scheduler_job" "daily_leaderboard" {
  name             = "daily-leaderboard"
  schedule         = "0 22 * * *"  # 10 PM Bangkok time
  time_zone        = "Asia/Bangkok"
  
  http_target {
    uri = "${var.backend_url}/api/jobs/daily-leaderboard"
    http_method = "POST"
    
    headers = {
      "Content-Type" = "application/json"
      "X-CloudScheduler-Token" = var.scheduler_token
    }
  }
}
```

### 6. Monitoring - Cloud Operations Suite

**Application Performance Monitoring:**
```javascript
// backend/monitoring/trace.js
const { TraceExporter } = require('@google-cloud/opentelemetry-cloud-trace-exporter');
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');

const provider = new NodeTracerProvider();
provider.addSpanProcessor(
    new BatchSpanProcessor(new TraceExporter())
);
provider.register();

// Custom metrics
const { MeterProvider } = require('@opentelemetry/sdk-metrics');
const { MetricExporter } = require('@google-cloud/opentelemetry-cloud-monitoring-exporter');

const meterProvider = new MeterProvider({
    exporter: new MetricExporter(),
    interval: 60000,
});

const meter = meterProvider.getMeter('sales-tracker');
const activityCounter = meter.createCounter('activities_submitted');
const loginCounter = meter.createCounter('user_logins');
```

**Error Reporting:**
```javascript
// backend/monitoring/error-reporting.js
const { ErrorReporting } = require('@google-cloud/error-reporting');

const errors = new ErrorReporting({
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    reportMode: 'production',
});

// Express error handler
app.use((err, req, res, next) => {
    errors.report(err);
    res.status(500).json({ error: 'Internal server error' });
});
```

**Custom Dashboards:**
```yaml
# monitoring/dashboards/sales-tracker.yaml
displayName: "Sales Tracker Dashboard"
gridLayout:
  widgets:
    - title: "Active Users"
      xyChart:
        dataSets:
          - timeSeriesQuery:
              timeSeriesFilter:
                filter: metric.type="custom.googleapis.com/sales-tracker/active_users"
    
    - title: "Activities per Hour"
      xyChart:
        dataSets:
          - timeSeriesQuery:
              timeSeriesFilter:
                filter: metric.type="custom.googleapis.com/sales-tracker/activities_count"
    
    - title: "API Latency"
      xyChart:
        dataSets:
          - timeSeriesQuery:
              timeSeriesFilter:
                filter: metric.type="appengine.googleapis.com/http/server/response_latencies"
```

### 7. Additional GCP Services

**Cloud CDN for Static Assets:**
```yaml
# terraform/cdn.tf
resource "google_compute_backend_bucket" "static_assets" {
  name        = "sales-tracker-cdn"
  bucket_name = google_storage_bucket.static_assets.name
  enable_cdn  = true
  
  cdn_policy {
    cache_mode = "CACHE_ALL_STATIC"
    default_ttl = 3600
    max_ttl = 86400
  }
}
```

**Cloud Armor for Security:**
```yaml
# terraform/cloud-armor.tf
resource "google_compute_security_policy" "policy" {
  name = "sales-tracker-security"
  
  rule {
    action   = "deny(403)"
    priority = "1000"
    match {
      expr {
        expression = "origin.region_code == 'CN'"
      }
    }
  }
  
  rule {
    action   = "rate_based_ban"
    priority = "2000"
    match {
      versioned_expr = "SRC_IPS_V1"
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action = "deny(429)"
      rate_limit_threshold {
        count = 100
        interval_sec = 60
      }
    }
  }
}
```

## Migration Timeline

### Phase 1: Infrastructure Setup (Week 1)
- [ ] Set up Cloud SQL instance
- [ ] Configure Secret Manager
- [ ] Set up Memorystore Redis
- [ ] Create Cloud Storage buckets
- [ ] Configure VPC and networking

### Phase 2: Code Migration (Week 2)
- [ ] Update database connection code
- [ ] Implement secret management
- [ ] Add caching layer
- [ ] Update environment variables
- [ ] Test in staging environment

### Phase 3: Data Migration (Week 3)
- [ ] Export SQLite data
- [ ] Transform data for PostgreSQL
- [ ] Import to Cloud SQL
- [ ] Verify data integrity
- [ ] Set up automated backups

### Phase 4: Monitoring Setup (Week 4)
- [ ] Configure Cloud Trace
- [ ] Set up Cloud Monitoring
- [ ] Create custom dashboards
- [ ] Configure alerts
- [ ] Set up log aggregation

### Phase 5: Deployment (Week 5)
- [ ] Deploy to staging
- [ ] Performance testing
- [ ] Security audit
- [ ] Deploy to production
- [ ] Monitor for 48 hours

## Cost Optimization

### Estimated Monthly Costs
```
Cloud SQL (db-f1-micro):        $7.50
Memorystore (1GB):             $35.00
Secret Manager:                 $0.30
Cloud Storage:                  $0.50
Cloud Tasks:                    $0.00 (free tier)
Cloud Scheduler:                $0.00 (free tier)
Monitoring:                     $0.00 (free tier)
App Engine:                     $0.00 (free tier)
----------------------------------------
Total:                         ~$43.30/month
```

### Cost Optimization Strategies
1. Use committed use discounts for Cloud SQL
2. Enable auto-scaling for App Engine
3. Use lifecycle policies for Cloud Storage
4. Implement efficient caching strategies
5. Use Cloud CDN for static assets

## Security Enhancements

### Secret Rotation
```javascript
// backend/services/secret-rotation.js
class SecretRotation {
    async rotateLineToken() {
        // 1. Generate new token via LINE API
        const newToken = await this.lineApi.regenerateToken();
        
        // 2. Update Secret Manager
        await this.secretManager.updateSecret('line-channel-access-token', newToken);
        
        // 3. Trigger App Engine restart
        await this.appEngine.restartService('sales-tracker-api');
    }
}
```

### IAM Best Practices
```yaml
# terraform/iam.tf
# Service account for backend
resource "google_service_account" "backend" {
  account_id   = "sales-tracker-backend"
  display_name = "Sales Tracker Backend Service Account"
}

# Minimal permissions
resource "google_project_iam_member" "backend_sql" {
  role   = "roles/cloudsql.client"
  member = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_project_iam_member" "backend_secrets" {
  role   = "roles/secretmanager.secretAccessor"
  member = "serviceAccount:${google_service_account.backend.email}"
}
```

## Rollback Plan

### Database Rollback
1. Stop all traffic to new system
2. Export PostgreSQL data
3. Convert back to SQLite format
4. Deploy old codebase
5. Import data to SQLite

### Quick Rollback Script
```bash
#!/bin/bash
# rollback.sh

# 1. Switch traffic back to old version
gcloud app services set-traffic sales-tracker-api --splits v1=100

# 2. Disable new infrastructure
gcloud sql instances patch sales-tracker-db --no-backup

# 3. Export current data
gcloud sql export csv sales-tracker-db gs://backup/emergency-export.csv

# 4. Notify team
curl -X POST $SLACK_WEBHOOK -d '{"text":"Emergency rollback initiated"}'
```

## Post-Migration Optimization

### Performance Tuning
1. Query optimization with EXPLAIN ANALYZE
2. Connection pooling configuration
3. Redis cache warming strategies
4. CDN cache headers optimization

### Monitoring Alerts
```yaml
# monitoring/alerts.yaml
alerts:
  - name: high-error-rate
    condition: error_rate > 5%
    duration: 5m
    notification: pagerduty
    
  - name: database-connection-pool
    condition: connection_pool_usage > 80%
    duration: 10m
    notification: email
    
  - name: api-latency
    condition: p95_latency > 1000ms
    duration: 5m
    notification: slack
```

## Success Metrics

### KPIs to Track
1. **Performance**: API response time < 200ms (p95)
2. **Availability**: 99.9% uptime
3. **Cost**: Stay within $50/month budget
4. **Security**: Zero security incidents
5. **User Experience**: No degradation in features

### Monitoring Dashboard
- Real-time active users
- API response times
- Database query performance
- Cache hit rates
- Error rates
- Cost tracking

## Conclusion

This migration plan transforms Sales Tracker Pro from a simple SQLite-based application to a robust, scalable GCP-native solution. The phased approach ensures minimal disruption while adding significant improvements in reliability, security, and performance.

The total implementation time is estimated at 5 weeks, with an ongoing monthly cost of approximately $43.30. The investment provides enterprise-grade infrastructure with room for growth and additional features.