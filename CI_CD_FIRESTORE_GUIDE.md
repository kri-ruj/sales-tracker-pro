# CI/CD Pipeline with Firestore Support

## ✅ What's Updated

The CI/CD pipeline now fully supports the Firestore migration:

### 1. **Version Management**
- Auto-bumps version on every commit
- Synchronizes versions across all files
- Validates versions before deployment

### 2. **Backend Deployment**
- Uses `server-firestore.js` as main entry point
- Installs production dependencies only
- Configures environment variables:
  - `USE_SECRET_MANAGER: true`
  - `GOOGLE_CLOUD_PROJECT: salesappfkt`
  - `NODE_ENV: production`

### 3. **Health Validation**
- Checks backend health after deployment
- Verifies Firestore database connectivity
- Fails pipeline if database is unhealthy

### 4. **Secret Management**
- Secrets stored in Google Secret Manager:
  - `line-channel-access-token`
  - `line-channel-secret`
  - `admin-token`
- App Engine service account has access
- No secrets in code or app.yaml

## 🚀 How It Works

1. **Push to main branch** triggers pipeline
2. **Version bump** (e.g., 3.6.4 → 3.6.5)
3. **Deploy backend** with Firestore configuration
4. **Deploy frontend** with updated version
5. **Validate deployment**:
   - Check versions match
   - Verify database is healthy
   - Confirm services are running

## 📋 Requirements

### GitHub Secrets Required:
- `GCP_PROJECT_ID`: salesappfkt
- `GCP_SA_KEY`: Service account JSON key

### Google Cloud Setup:
- ✅ Firestore database: `sales-tracker-db`
- ✅ Secret Manager with LINE tokens
- ✅ App Engine enabled

## 🔍 Monitoring

After deployment, the pipeline checks:

```bash
# Backend health
https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/health

Expected response:
{
  "status": "OK",
  "dbStatus": "healthy",
  "database": "firestore",
  "version": "3.6.5"
}
```

## 🛠️ Troubleshooting

### Database Connection Issues
1. Check Firestore database exists
2. Verify service account permissions
3. Check Secret Manager access

### Version Mismatches
- Pipeline automatically syncs versions
- Run `node scripts/version-manager.js sync` locally

### Deployment Failures
- Check GitHub Actions logs
- Verify GCP quotas not exceeded
- Ensure secrets are correctly set

## 🎯 Best Practices

1. **Always use main branch** for deployments
2. **Don't manually edit versions** - let CI/CD handle it
3. **Monitor costs** in GCP Console (should be $0)
4. **Check health endpoint** after deployments

The pipeline ensures zero-downtime deployments with automatic rollback if health checks fail!