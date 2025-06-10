# GitHub Secrets Setup Guide

## Current Status ✅

All required secrets are already configured in your repository `kri-ruj/sales-tracker-pro`:

| Secret Name | Status | Last Updated |
|------------|--------|--------------|
| GCP_PROJECT_ID | ✅ Configured | 2025-06-09 |
| GCP_SA_KEY | ✅ Configured | 2025-06-09 |
| FIREBASE_SERVICE_ACCOUNT | ✅ Configured | 2025-06-09 |
| LINE_CHANNEL_ACCESS_TOKEN | ✅ Configured | 2025-06-09 |
| LINE_CHANNEL_SECRET | ✅ Configured | 2025-06-09 |
| DB_ROOT_PASSWORD | ✅ Configured | 2025-06-09 |
| FIREBASE_CI_TOKEN | ✅ Configured | 2025-06-09 |

## Verifying Secrets

To verify the current secrets:

```bash
gh secret list --repo kri-ruj/sales-tracker-pro
```

## Updating Secrets

If you need to update any secret:

```bash
# Update a specific secret
gh secret set SECRET_NAME --repo kri-ruj/sales-tracker-pro

# Example: Update LINE_CHANNEL_ACCESS_TOKEN
gh secret set LINE_CHANNEL_ACCESS_TOKEN --repo kri-ruj/sales-tracker-pro
```

## Secret Values Reference

### 1. GCP_PROJECT_ID
- **Current Value**: `salesappfkt`
- **Where to find**: Google Cloud Console → Project selector

### 2. GCP_SA_KEY
- **What it is**: Service Account JSON key for Google Cloud
- **How to obtain**:
  1. Go to [Google Cloud Console](https://console.cloud.google.com)
  2. Navigate to IAM & Admin → Service Accounts
  3. Find or create a service account with these roles:
     - App Engine Admin
     - App Engine Deployer
     - Cloud Build Service Account
     - Service Account User
  4. Click on the service account → Keys → Add Key → Create new key → JSON
  5. Download the JSON file
  6. Set the secret: `gh secret set GCP_SA_KEY < service-account-key.json --repo kri-ruj/sales-tracker-pro`

### 3. FIREBASE_SERVICE_ACCOUNT
- **What it is**: Firebase service account for deployment
- **How to obtain**:
  1. Go to [Firebase Console](https://console.firebase.google.com)
  2. Select your project (`salesappfkt`)
  3. Go to Project Settings → Service Accounts
  4. Click "Generate new private key"
  5. Download the JSON file
  6. Set the secret: `gh secret set FIREBASE_SERVICE_ACCOUNT < firebase-service-account.json --repo kri-ruj/sales-tracker-pro`

### 4. LINE_CHANNEL_ACCESS_TOKEN
- **Current Value**: Available in `.env` file
- **Where to find**: [LINE Developers Console](https://developers.line.biz)
  1. Select your channel
  2. Go to Messaging API tab
  3. Find "Channel access token (long-lived)"
  4. Click "Issue" if not already generated

### 5. LINE_CHANNEL_SECRET
- **Current Value**: Available in `.env` file
- **Where to find**: [LINE Developers Console](https://developers.line.biz)
  1. Select your channel
  2. Go to Basic settings tab
  3. Find "Channel secret"

## Security Best Practices

1. **Never commit secrets to the repository**
2. **Rotate secrets regularly** (every 90 days recommended)
3. **Use least privilege principle** for service accounts
4. **Monitor secret access** in GitHub audit logs

## Testing GitHub Actions

After setting up secrets, test your workflows:

```bash
# Trigger a workflow manually
gh workflow run deploy-gcp.yml --repo kri-ruj/sales-tracker-pro

# View workflow runs
gh run list --repo kri-ruj/sales-tracker-pro

# View specific run details
gh run view <run-id> --repo kri-ruj/sales-tracker-pro
```

## Troubleshooting

### If a deployment fails due to authentication:
1. Check secret expiration dates
2. Verify service account permissions
3. Ensure secrets are properly formatted (no extra spaces/newlines)

### Common issues:
- **GCP_SA_KEY**: Must be valid JSON without formatting
- **LINE tokens**: Must be exact copies without trailing spaces
- **Firebase**: Requires proper project permissions

## Additional Resources

- [GitHub Encrypted Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Google Cloud Service Accounts](https://cloud.google.com/iam/docs/service-accounts)
- [Firebase Admin SDK Setup](https://firebase.google.com/docs/admin/setup)
- [LINE Messaging API Documentation](https://developers.line.biz/en/docs/messaging-api/)