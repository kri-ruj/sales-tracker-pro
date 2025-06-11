# CLAUDE.md - Sales Tracker Pro Project Context

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 CRITICAL PROJECT CONTEXT (Updated after v1.0.18)

### Current State (v3.7.4+)
- **Auto-versioning**: Each commit automatically bumps version (3.7.4 → 3.7.5 → etc)
- **Ultra-compact UI**: No scrolling, combined header, minimal spacing
- **5x smaller flex messages**: Using "nano" size for LINE notifications
- **Backend-only mode**: No localStorage for activities (except settings)
- **Persistent SQLite**: Changed from `:memory:` to `/tmp/sales-tracker.db`

### Recent Major Changes
1. **Fixed data persistence**: Activities now save to localStorage AND sync with backend
2. **Fixed notifications**: SQLite file-based (not in-memory) so groups stay registered
3. **CI/CD deploys both**: Frontend AND backend services automatically
4. **Compact UI**: Everything fits on mobile without scrolling
5. **Version display**: Shows in bottom-right corner (v3.7.4)

### URLs & Services
- **Frontend (App)**: https://frontend-dot-salesappfkt.as.r.appspot.com/
- **Backend API**: https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/
- **LINE LIFF**: https://liff.line.me/2007552096-wrG1aV9p
- **LIFF ID**: 2007552096-wrG1aV9p
- **GCP Project**: salesappfkt

### Known Issues & Solutions
1. **LINE API Limit**: 298/300 messages used (free tier)
   - Solution: Using 5x smaller flex messages
2. **Group notifications not working**:
   - Must configure webhook URL in LINE Console
   - Type `/register` in group after bot joins
3. **Version caching**: Aggressive PWA caching
   - Solution: Force reload, clear cache, or use force-update.html

### Architecture Decisions
- **No landing page**: App loads directly to activities interface
- **Service architecture**: 
  - `frontend` service (python39 runtime for static files)
  - `sales-tracker-api` service (nodejs20 for backend)
- **Database**: SQLite file at `/tmp/sales-tracker.db` (App Engine)
- **Flex messages**: Compact format using `activity-flex-message-compact.js`

## Project Overview

FINNERGY Sales Tracker - A gamified sales activity tracking application with LINE platform integration. The app consists of:

- **Frontend**: Single-page application with vanilla JS (no framework)
- **Backend**: Express.js API with SQLite database (file-based for persistence)
- **LINE Integration**: LIFF mini-app with webhook bot for notifications
- **AI Service**: Enhanced microservice (exists but not currently deployed)

## Common Development Commands

### Frontend Development
```bash
# Start local development server
npm start                      # Runs http-server on port 8000

### Backend Development
```bash
# Navigate to backend directory
cd backend/

# Development
npm run dev                   # Run with nodemon (auto-restart)
npm start                     # Run production server (server-simple.js)
npm run start:full           # Run full server with all features (server.js)

# Database
npm run db:migrate           # Run database migrations

# Deployment
npm run deploy:gcp           # Deploy to Google App Engine
npm run logs                 # View GCP logs
```

### AI Service Development
```bash
# Navigate to AI service directory
cd ai-service/

# Different server configurations
npm start                     # Enhanced React agent
npm run start:email          # With email service
npm run start:docs           # With API documentation

# Development mode (with auto-restart)
npm run dev                  # Watch enhanced agent
npm run dev:email           # Watch with email
npm run dev:docs            # Watch with docs

# Testing
npm test                     # Run all tests
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests
npm run test:coverage       # With coverage report

# Setup and utilities
npm run setup:email         # Configure email service
npm run docs:validate       # Validate OpenAPI spec
npm run docs:serve          # Serve API documentation
```

## Architecture Overview

### Backend API Structure
The backend uses a modular Express.js architecture with a shared SQLite database for all users:

- **Database Tables** (shared across all users):
  - `users`: LINE user profiles and settings
  - `activities`: Sales activity records with points
  - `group_registrations`: LINE group notification settings

- **Core API Endpoints**:
  - `/api/users` - User registration and updates
  - `/api/activities` - Activity CRUD operations
  - `/api/team/stats` - Team statistics and analytics
  - `/api/leaderboard` - Rankings (daily/weekly/monthly)
  - `/webhook` - LINE webhook handler

- **Key Services**:
  - LINE Messaging API integration for notifications
  - Flex message templates for rich LINE messages
  - Daily leaderboard cron job functionality

### Frontend Architecture
Single-page application with vanilla JavaScript:

- **State Management**: Real-time state synced with shared backend database
- **LINE Integration**: LIFF SDK for authentication and profile
- **UI Components**: Custom CSS with CSS variables for theming

### AI Service Architecture
The AI service provides intelligent features through a plugin-based architecture:

- **Core Components**:
  - Plugin system for extensibility
  - Multiple AI agent implementations (Gemini, Vertex AI)
  - WebSocket support for real-time features
  - Queue system for background processing
       - **Integration Points**:
  - Email services (Gmail, Outlook, SMTP)
  - Calendar integrations (Google, Outlook)
  - CRM systems (HubSpot, Salesforce)
  - Webhook receiver for external events

## Environment Variables

### Backend (.env)
```
PORT=10000
LINE_CHANNEL_ACCESS_TOKEN=<your-token>
LINE_CHANNEL_SECRET=<your-secret>
DATABASE_URL=<optional-for-postgres>
```

### AI Service (.env)
```
PORT=3000
GEMINI_API_KEY=<your-api-key>
GOOGLE_CLIENT_ID=<for-oauth>
GOOGLE_CLIENT_SECRET=<for-oauth>
EMAIL_SERVICE=<gmail|smtp|sendgrid>
SMTP_HOST=<if-using-smtp>
SMTP_PORT=<if-using-smtp>
SMTP_USER=<if-using-smtp>
SMTP_PASS=<if-using-smtp>
```

## Deployment Configurations

The project supports multiple deployment platforms:

- **Frontend**: GitHub Pages, Netlify, Vercel, Firebase Hosting
- **Backend**: Google App Engine, Railway, Vercel
- **Configuration Files**:
  - `app.yaml` - Google App Engine
  - `vercel.json` - Vercel configuration
  - `netlify.toml` - Netlify settings

## LINE Integration Notes

- The app is currently in "Developing" status on LINE platform
- Only registered testers can access the LIFF app
- To add testers: LINE Developers Console → Roles → Add Testers
- For public access: Submit for LINE review (3-5 business days)

## Testing Strategy

- Backend uses Jest with Supertest for API testing
- AI service has comprehensive unit and integration tests
- No frontend tests currently implemented
- Test database is created in-memory for isolation

## Critical Files

- `config.js` - Frontend configuration (LIFF ID, API URLs)
- `backend/server.js` - Main backend server with all features
- `backend/server-simple.js` - Simplified server for basic deployments
- `backend/activity-flex-message-compact.js` - 5x smaller flex messages
- `index.html` - Main frontend application (single file with all UI/logic)
- `.github/workflows/deploy-gcp.yml` - CI/CD pipeline with auto-versioning
- `update-version.sh` - Version update script

## Session Progress Tracker

### What We've Accomplished:
1. ✅ Set up CI/CD with automatic version bumping
2. ✅ Fixed persistent storage (activities survive refresh)
3. ✅ Made UI ultra-compact for mobile (no scrolling)
4. ✅ Created 5x smaller flex messages for LINE
5. ✅ Fixed backend to use file-based SQLite
6. ✅ Added version display in UI
7. ✅ Updated CI/CD to deploy BOTH frontend and backend

### Webhook Setup Required:
1. LINE Developers Console → Messaging API
2. Set webhook URL: `https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/webhook`
3. Enable webhook, disable auto-reply
4. Type `/register` in LINE group

### Debug Endpoints:
- Health check: `/health`
- Check groups: `/api/debug/groups`
- API info: `/` (root)

### Important Notes:
- User wanted NO local/mock data - everything backend-driven
- User hit LINE API limit (298/300) - that's why compact messages
- App should be ultra-compact to fit mobile screens
- Each commit = new version (auto-increment)
- Frontend IS the app (no separate landing page needed)