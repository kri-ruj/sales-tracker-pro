# Fix Render Backend Services

You have two backend services on Render, which is causing confusion. Here's how to fix it:

## Current Situation
- **Service 1**: `sales-tracker-backend` (configured in frontend)
- **Service 2**: `sales-tracker-backend-yho4` (duplicate?)

Both show as "Deployed" but neither is responding to health checks.

## Option 1: Fix the Main Service (Recommended)

1. **Click on `sales-tracker-backend` in Render Dashboard**
2. **Check the Logs tab** for any errors
3. **Common issues to look for**:
   - "Cannot find module" errors
   - Port binding issues
   - Missing environment variables

4. **Go to Settings → Build & Deploy**:
   - Verify Root Directory: `backend`
   - Verify Build Command: `npm install`
   - Verify Start Command: `node server-simple.js`

5. **Check Environment Variables**:
   - `NODE_ENV` = `production`
   - `PORT` = `10000`

6. **Trigger Manual Deploy**:
   - Click "Manual Deploy" → "Deploy latest commit"

## Option 2: Use the Alternative Service

If `sales-tracker-backend-yho4` is working:

1. Update your frontend code:
```javascript
// In index.html, line ~858
BACKEND_URL: window.location.hostname === 'localhost' 
    ? 'http://localhost:10000' 
    : 'https://sales-tracker-backend-yho4.onrender.com',
```

2. Delete the unused service to avoid confusion

## Option 3: Start Fresh (If Both Are Broken)

1. **Delete both services**
2. **Create new Web Service**:
   - Name: `sales-tracker-backend`
   - GitHub repo: `kri-ruj/sales-tracker-pro`
   - Branch: `main`
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `node server-simple.js`
   - Environment: Free
   - Region: Oregon

3. **Add Environment Variables**:
   ```
   NODE_ENV=production
   PORT=10000
   DATABASE_TYPE=sqlite
   ```

## Testing Your Backend

1. **Open test-backend.html in your browser**:
   ```bash
   open test-backend.html
   ```

2. **Wait for services to respond** (Render free tier can take 30-60 seconds to wake up)

3. **Choose the working service** and update your frontend accordingly

## Quick Debug Commands

Check service logs in Render dashboard or use:

```bash
# Test service 1
curl -v https://sales-tracker-backend.onrender.com/health

# Test service 2  
curl -v https://sales-tracker-backend-yho4.onrender.com/health

# Check if backend code was deployed
curl https://sales-tracker-backend.onrender.com/
```

## Important Notes

- Render free tier services sleep after 15 minutes of inactivity
- First request after sleep takes 30-60 seconds
- Make sure only ONE service is active to avoid confusion
- The render.yaml file automatically creates services, so be careful with multiple pushes