# Render Backend Deployment Checklist

## 1. Verify on Render Dashboard

### Service Configuration
1. Go to https://dashboard.render.com/
2. Check your service named "sales-tracker-backend"
3. Verify these settings:
   - **GitHub Repository**: `kri-ruj/sales-tracker-pro`
   - **Branch**: `main`
   - **Root Directory**: `./backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node server-simple.js`
   - **Auto-Deploy**: Enabled

### Environment Variables
Ensure these are set in Render:
- `NODE_ENV` = `production`
- `PORT` = `10000`
- `DATABASE_TYPE` = `sqlite`
- `LINE_CHANNEL_ACCESS_TOKEN` = (your token)
- `LINE_CHANNEL_SECRET` = (your secret)

## 2. Trigger Manual Deploy (if needed)

If auto-deploy isn't working:
1. Go to your service on Render
2. Click "Manual Deploy" 
3. Select "Deploy latest commit"

## 3. Check Deploy Logs

1. In Render dashboard, go to "Events" tab
2. Look for recent deploy attempts
3. Check "Logs" tab for any errors

## 4. Test Backend Health

Once deployed, test:
```bash
curl https://sales-tracker-backend.onrender.com/health
```

Expected response:
```json
{
  "status": "OK",
  "message": "Sales Tracker Backend is running",
  "version": "2.74",
  "timestamp": "2024-06-10T..."
}
```

## 5. Common Issues & Fixes

### Issue: Service not found
- Ensure render.yaml is at repository root
- Check service name matches in render.yaml

### Issue: Build fails
- Check Node version compatibility (needs >=18.0.0)
- Verify package.json is valid

### Issue: Auto-deploy not working
- Check GitHub webhook in repository settings
- Ensure Render has access to your repository
- Try disconnecting and reconnecting GitHub

## 6. Alternative: Re-create Service

If nothing works:
1. Delete the current service on Render
2. Create new Web Service
3. Connect to GitHub repo `kri-ruj/sales-tracker-pro`
4. Set root directory to `./backend`
5. Use these commands:
   - Build: `npm install`
   - Start: `node server-simple.js`