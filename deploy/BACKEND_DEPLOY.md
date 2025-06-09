# 🚀 Deploy Backend in 2 Minutes

## Option 1: Render (Recommended - Free Tier)

1. **Go to**: https://render.com
2. **Sign up/login** with GitHub
3. **Click "New +"** → **Web Service**
4. **Connect** your GitHub repo: `kri-ruj/sales-tracker-pro`
5. **Configure**:
   - **Name**: `sales-tracker-backend`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

6. **Environment Variables**:
   ```
   NODE_ENV=production
   LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
   LINE_CHANNEL_SECRET=your_line_channel_secret
   PORT=10000
   ```

7. **Click "Create Web Service"**

**Result**: Your backend will be live at `https://sales-tracker-backend.onrender.com`

## Option 2: Railway (Alternative)

1. **Go to**: https://railway.app
2. **Login with GitHub**
3. **New Project** → **Deploy from GitHub repo**
4. **Select**: `kri-ruj/sales-tracker-pro`
5. **Root directory**: `backend`
6. **Add environment variables** (same as above)
7. **Deploy**

**Result**: Backend live at `https://your-project.railway.app`

## Quick Deploy Commands

If you prefer CLI:

```bash
# Option A: Using Render
git add . && git commit -m "Deploy backend" && git push

# Option B: Using Railway CLI
npm install -g @railway/cli
cd backend
railway login
railway up
```

## Next Steps

1. **Get your backend URL** from deploy service
2. **Update LINE webhook** to: `https://your-backend-url.com/webhook`
3. **Test notifications** in LINE group

**Your backend includes**:
✅ LINE webhook for group notifications
✅ User activity tracking
✅ Team leaderboard API
✅ Database persistence

Ready to deploy? Choose Option 1 (Render) for the easiest setup! 🟢