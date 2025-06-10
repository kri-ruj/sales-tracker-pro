# 🚀 Development Guidelines

## Quick Start
1. Clone repo
2. `npm install` in root and backend/
3. Copy `.env.example` to `.env` and fill values
4. `npm run dev` to start backend
5. `npm start` to start frontend

## Key Workflows
- Feature dev: Create branch from `main`
- Testing: Run `npm test` before PR
- Deployment: Use `npm run deploy:gcp`
- Database: Migrations via `npm run db:migrate`

## Code Standards
- Use TypeScript for new code
- Follow existing file structure
- Document public APIs
- Write tests for critical paths

## Code Organization

### Frontend Structure


# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FINNERGY Sales Tracker - A gamified sales activity tracking application with LINE platform integration. The app consists of:

- **Frontend**: Single-page application with real-time data sync
- **Backend**: Express.js API with shared SQLite database
- **AI Service**: Enhanced microservice with plugin architecture
- **LINE Integration**: LIFF mini-app with webhook notifications

## Key URLs and Endpoints

- **Production Backend**: https://sales-tracker-app-dot-salesappfkt.as.r.appspot.com/
- **LINE LIFF App**: https://liff.line.me/2007552096-wrG1aV9p
- **LIFF ID**: 2007552096-wrG1aV9p

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
- `backend/server.js` - Main backend server
- `backend/server-simple.js` - Simplified server for basic deployments
- `ai-service/react-agent-enhanced.js` - Primary AI service
- `index.html` - Main frontend application