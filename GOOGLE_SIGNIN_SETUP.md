# Google Sign-In Setup Guide

## Prerequisites

1. Google Cloud Console account
2. A project in Google Cloud Console

## Setup Steps

### 1. Enable Google Sign-In in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
5. If prompted, configure the OAuth consent screen first:
   - User Type: External
   - App name: Sales Tracker Pro
   - Support email: Your email
   - Authorized domains: Your domain (e.g., salesappfkt.as.r.appspot.com)
6. Create OAuth 2.0 Client ID:
   - Application type: **Web application**
   - Name: Sales Tracker Web Client
   - Authorized JavaScript origins:
     - `http://localhost:8000` (for development)
     - `https://frontend-dot-salesappfkt.as.r.appspot.com` (production)
     - `https://salesappfkt.as.r.appspot.com` (if using custom domain)
   - Authorized redirect URIs: (not needed for implicit flow)

### 2. Configure the Application

1. Copy your **Client ID** from Google Cloud Console
2. Update `config.js`:
   ```javascript
   googleClientId: 'YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com'
   ```

3. Set environment variable for backend (optional):
   ```bash
   export GOOGLE_CLIENT_ID=YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com
   ```

### 3. How It Works

1. User clicks "Sign in with Google" button
2. Google Sign-In popup appears
3. User authenticates with Google
4. Frontend receives ID token
5. Frontend sends ID token to backend `/api/auth/google`
6. Backend verifies token with Google
7. Backend creates/updates user in Firestore
8. Backend returns JWT token (if using JWT server) or user info
9. Frontend stores auth token and reloads

### 4. Testing

1. Start the backend:
   ```bash
   cd backend
   npm start  # or npm run dev
   ```

2. Start the frontend:
   ```bash
   python3 -m http.server 8000
   ```

3. Open http://localhost:8000
4. Click "Sign in with Google"
5. Authenticate with your Google account
6. Check console for successful authentication

### 5. Production Deployment

1. Update `config.js` with production Google Client ID
2. Add production URLs to Google Console authorized origins
3. Set `GOOGLE_CLIENT_ID` environment variable in App Engine
4. Deploy both frontend and backend

### 6. Security Notes

- Never expose your Client Secret (we don't use it in frontend)
- Always verify ID tokens on the backend
- Use HTTPS in production
- Implement proper CORS policies

### 7. Troubleshooting

**"Google Sign-In is not configured" error:**
- Update the `googleClientId` in config.js

**"Invalid Google token" error:**
- Check that Client ID matches in frontend and backend
- Ensure the token hasn't expired
- Verify authorized origins in Google Console

**Popup blocked:**
- Ensure sign-in is triggered by user action (button click)
- Check browser popup settings

**CORS errors:**
- Add your domain to authorized JavaScript origins
- Check backend CORS configuration