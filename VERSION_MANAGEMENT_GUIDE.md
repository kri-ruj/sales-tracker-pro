# Version Management System Guide

## Overview

This comprehensive version management system ensures version consistency across all services and prevents version mismatches that were causing confusion in production deployments.

## Components

### 1. Version Manager Script (`scripts/version-manager.js`)
The central tool for managing versions across the entire project.

**Commands:**
```bash
# Check current version
node scripts/version-manager.js current

# Validate all versions match
node scripts/version-manager.js validate

# Synchronize version across all files
node scripts/version-manager.js sync

# Bump version (patch/minor/major)
node scripts/version-manager.js bump patch

# Pre-deployment check
node scripts/version-manager.js check
```

### 2. Safe Deploy Script (`scripts/safe-deploy.sh`)
A deployment script that enforces version consistency before deploying.

```bash
# Make executable
chmod +x scripts/safe-deploy.sh

# Run safe deployment
./scripts/safe-deploy.sh
```

This script:
- Validates version consistency
- Runs tests
- Commits changes if needed
- Deploys both frontend and backend
- Validates post-deployment versions
- Creates deployment records

### 3. Version Check Middleware (`backend/middleware/version-check.js`)
Runtime version validation that:
- Adds version headers to all API responses
- Logs version mismatches
- Provides health check endpoints

### 4. Version Monitor Routes (`backend/routes/version-monitor.js`)
API endpoints for version monitoring:
- `GET /api/version` - Current service version
- `GET /api/version/health` - Detailed version health check
- `GET /api/version/monitor` - Check all services versions
- `POST /api/version/sync` - Trigger version sync (admin only)

### 5. Version Monitor Dashboard (`version-monitor.html`)
A visual dashboard to monitor version status across all services.

## Version Sources

The system updates versions in these locations:
1. `VERSION` file (single source of truth)
2. `config.js` - Frontend configuration
3. `index.html` - Version display in UI
4. `backend/package.json` - Backend package version
5. `backend/server.js` - API version references
6. `package.json` - Root package version
7. `app.yaml` files - App Engine environment variables

## CI/CD Integration

The GitHub Actions workflow now:
1. Validates version consistency before deployment
2. Auto-syncs versions if mismatches are found
3. Bumps version automatically on each deployment
4. Validates deployed versions after deployment
5. Fails the pipeline if versions don't match

## Usage Workflow

### Daily Development
```bash
# Before starting work, check versions
node scripts/version-manager.js validate

# If issues found, sync
node scripts/version-manager.js sync
```

### Before Deployment
```bash
# Use the safe deploy script
./scripts/safe-deploy.sh

# Or manually:
node scripts/version-manager.js bump patch
node scripts/version-manager.js sync
git add .
git commit -m "Bump version"
git push
```

### Monitoring Production
1. Check the version monitor endpoint:
   ```
   https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/api/version/monitor
   ```

2. Or use the visual dashboard by opening `version-monitor.html`

## Troubleshooting

### Version Mismatch After Deployment
1. Run `node scripts/version-manager.js validate` locally
2. Check the monitor endpoint for specific service issues
3. If needed, run sync and redeploy

### CI/CD Failures
- Check the "Version Management" job logs
- Ensure all files are accessible
- Verify GitHub secrets are set correctly

### Local vs Production Mismatch
- Always pull latest changes before deploying
- Use the safe deploy script which handles git sync
- Check deployment records in `deployments/` directory

## Version Lock File

The system creates `.version.lock` with:
- Current version
- Version hash for integrity
- Timestamp
- Git commit reference
- Number of files updated

This helps track version changes and ensures integrity.

## Best Practices

1. **Always use the VERSION file as the source of truth**
2. **Never manually edit version numbers in individual files**
3. **Use the version manager commands for all version operations**
4. **Run validation before and after deployments**
5. **Monitor production versions regularly**

## Security

- Version sync endpoint requires authentication
- Version headers help detect client/server mismatches
- Lock file prevents tampering
- CI/CD uses secure version hashing

## Future Improvements

- Automated alerts on version mismatches
- Version rollback functionality
- Multi-environment version tracking
- Integration with monitoring services