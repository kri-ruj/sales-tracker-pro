# Google Drive MCP Setup - Step by Step Guide

## 1️⃣ Enable Google Drive API

1. Go to: https://console.cloud.google.com
2. Select your project (or create new one)
3. Click **"APIs & Services"** → **"Enable APIs and Services"**
4. Search for **"Google Drive API"**
5. Click on it and press **"Enable"**

## 2️⃣ Create OAuth 2.0 Credentials

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. If prompted, configure consent screen:
   - User Type: **Internal** (if using org account) or **External**
   - App name: `Sales Tracker Drive Integration`
   - User support email: Your email
   - Developer contact: Your email
   - Click **"Save and Continue"**
   - Scopes: Skip for now
   - Test users: Add your email
   - **"Save and Continue"**

## 3️⃣ Create OAuth Client

1. Back at Create OAuth client ID:
   - Application type: **Web application**
   - Name: `Sales Tracker MCP`
   - Authorized redirect URIs: Add `http://localhost:3000/oauth/callback`
2. Click **"Create"**
3. Download the JSON or copy:
   - Client ID
   - Client Secret

## 4️⃣ First-Time Authorization

The MCP server will handle OAuth flow, but you need to authorize once:

1. When you first use the Drive MCP, it will open a browser
2. Log in with your Google account
3. Allow permissions
4. You'll be redirected to localhost (this is normal)

## 📝 Your Credentials:

```
GOOGLE_DRIVE_CLIENT_ID: [YOUR-CLIENT-ID].apps.googleusercontent.com
GOOGLE_DRIVE_CLIENT_SECRET: GOCSPX-[YOUR-SECRET]
GOOGLE_DRIVE_REDIRECT_URI: http://localhost:3000/oauth/callback
```

## 🧪 Test Setup

The Google Drive MCP will automatically:
- Handle OAuth flow
- Store refresh tokens
- Manage authentication

## 📂 Folder Structure for Sales Tracker

Once connected, create this structure in Drive:
```
Sales Tracker Reports/
├── Daily/
├── Weekly/
├── Monthly/
├── Exports/
└── Backups/
```

## 🔧 Common Issues:

1. **"redirect_uri_mismatch"** - Make sure redirect URI matches exactly
2. **"access_denied"** - Check consent screen is published (for external)
3. **"invalid_client"** - Verify client ID and secret are correct
4. **Port 3000 in use** - The MCP server will handle this automatically