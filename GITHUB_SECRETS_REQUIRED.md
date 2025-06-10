# GitHub Secrets Required for CI/CD

To enable the CI/CD pipeline, you need to set up the following secrets in your GitHub repository:

## Required Secrets

### 1. Google Cloud Platform
- **GCP_PROJECT_ID**: `salesappfkt`
- **GCP_SA_KEY**: Service account JSON key (get from GCP Console)
- **FIREBASE_SERVICE_ACCOUNT**: Firebase service account JSON (for hosting)

### 2. LINE Platform
- **LINE_CHANNEL_ACCESS_TOKEN**: Your LINE channel access token
- **LINE_CHANNEL_SECRET**: Your LINE channel secret

## How to Add Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret with the exact name above

## Getting the Service Account Key

1. Go to [GCP Console](https://console.cloud.google.com)
2. Select project `salesappfkt`
3. Go to **IAM & Admin** → **Service Accounts**
4. Create or use existing service account with these roles:
   - App Engine Admin
   - App Engine Deployer
   - Cloud Build Editor
   - Service Account User
5. Create key → JSON → Copy entire content
6. Paste as `GCP_SA_KEY` secret

## Getting Firebase Service Account

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Project Settings** → **Service Accounts**
4. Generate new private key
5. Copy entire JSON content
6. Paste as `FIREBASE_SERVICE_ACCOUNT` secret

## Workflow Triggers

The CI/CD pipeline will run automatically when:
- You push to `main` branch
- You create a pull request to `main`
- You manually trigger with version type selection

## Manual Version Bump

Run locally:
```bash
./scripts/bump-version.sh patch  # Increment patch version (3.6.0 → 3.6.1)
./scripts/bump-version.sh minor  # Increment minor version (3.6.0 → 3.7.0)
./scripts/bump-version.sh major  # Increment major version (3.6.0 → 4.0.0)
```