# 🚀 Deploy Backend - Working Methods

## Option 1: Vercel (Recommended - Easiest)

### Method A: One-Click Deploy
1. **Click**: [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/kri-ruj/sales-tracker-pro&project-name=sales-tracker-backend&repository-name=sales-tracker-backend&root-directory=backend)
2. **Login** with GitHub
3. **Set Root Directory** to `backend`
4. **Deploy** - Done!

### Method B: Manual Vercel
1. Go to https://vercel.com
2. **Import Git Repository**
3. **Select** your `sales-tracker-pro` repo
4. **Set Root Directory**: `backend`
5. **Deploy**

## Option 2: Railway

1. **Click**: [![Deploy to Railway](https://railway.app/button.svg)](https://railway.app/new)
2. **Connect GitHub repo**: `kri-ruj/sales-tracker-pro`
3. **Set Root Path**: `backend`
4. **Deploy**

## Option 3: Render

1. Go to https://render.com
2. **New Web Service**
3. **Connect repo**: `kri-ruj/sales-tracker-pro`
4. **Settings**:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. **Create Web Service**

## After Deployment ✅

1. **Copy your backend URL** (e.g., `https://your-app.vercel.app`)
2. **Update `index.html`** line 1183:
   ```javascript
   BACKEND_URL: 'https://your-actual-backend-url.vercel.app'
   ```
3. **Commit and push** to GitHub
4. **Setup LINE webhook**: Use your backend URL + `/webhook`

## 🎯 Your Backend Will Provide

- 🤖 **LINE Webhooks** - Auto group notifications
- 📊 **Team API** - Real-time team stats  
- 💾 **Data Sync** - Cross-device persistence
- 👥 **Multi-user** - Team collaboration

## 🔧 Environment Variables (Optional)

Add these in your hosting platform:
- `LINE_CHANNEL_ACCESS_TOKEN` - Your LINE bot token
- `LINE_CHANNEL_SECRET` - Your LINE bot secret
- `NODE_ENV` - `production`

**Note**: The backend works without LINE tokens, you just won't get group notifications.

## ✅ Test Your Deployment

After deployment, test these URLs:
- `https://your-backend-url.com/health` - Should return "OK"
- `https://your-backend-url.com/api/team/stats` - Should return JSON

**Ready to deploy? Choose Option 1 (Vercel) for the easiest setup!** 🚀