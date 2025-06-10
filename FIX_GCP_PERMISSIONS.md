# 🔧 Fix GCP Service Account Permissions

The deployment is failing because the service account needs additional permissions for App Engine deployment.

## Error
```
403 Could not list bucket [staging.***.appspot.com]: 
github-actions@***.iam.gserviceaccount.com does not have storage.objects.list access
```

## Solution

### 1. Go to GCP Console
https://console.cloud.google.com/iam-admin/iam?project=salesappfkt

### 2. Find Your Service Account
Look for: `github-actions@salesappfkt.iam.gserviceaccount.com`

### 3. Add Required Roles
Click the pencil icon to edit, then add these roles:
- **App Engine Admin** (already have)
- **Storage Admin** ← Add this
- **Service Account User** (already have)

Or use this command:
```bash
gcloud projects add-iam-policy-binding salesappfkt \
  --member="serviceAccount:github-actions@salesappfkt.iam.gserviceaccount.com" \
  --role="roles/storage.admin"
```

### 4. Alternative: Create New Service Account
If you prefer, create a new service account with all permissions:

```bash
# Create service account
gcloud iam service-accounts create github-actions-deploy \
  --display-name="GitHub Actions Deploy"

# Grant all required roles
for role in roles/appengine.appAdmin roles/storage.admin roles/cloudbuild.builds.editor roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding salesappfkt \
    --member="serviceAccount:github-actions-deploy@salesappfkt.iam.gserviceaccount.com" \
    --role="$role"
done

# Create and download key
gcloud iam service-accounts keys create ~/github-actions-key.json \
  --iam-account=github-actions-deploy@salesappfkt.iam.gserviceaccount.com

# Update GitHub secret GCP_SA_KEY with the new key content
cat ~/github-actions-key.json
```

## After Fixing Permissions

1. The GitHub Actions workflow will automatically retry on next push
2. Or manually re-run the failed workflow from GitHub Actions page

## Required Permissions Summary
- `roles/appengine.appAdmin` - Deploy to App Engine
- `roles/storage.admin` - Access deployment buckets
- `roles/cloudbuild.builds.editor` - Build images
- `roles/iam.serviceAccountUser` - Act as service account