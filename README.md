# NexMeet — Free Unlimited Video Conferencing

> A full-stack Zoom alternative with **no time limits, no participant caps, and zero cost** — built on Agora SDK, React, Node.js, and MongoDB.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Quick Start (Local Development)](#quick-start)
4. [Environment Variables](#environment-variables)
5. [Free Service Setup Guides](#free-service-setup)
6. [Deployment — Free Cloud Tiers](#deployment)
7. [Feature Reference](#feature-reference)
8. [API Reference](#api-reference)
9. [Scaling Guide](#scaling-guide)
10. [Keyboard Shortcuts](#keyboard-shortcuts)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                   BROWSER                        │
│   React (Vite) + Agora RTC SDK + Socket.IO      │
└──────────────────────┬──────────────────────────┘
                       │ HTTPS / WSS
          ┌────────────┴─────────────┐
          │      NODE.JS BACKEND     │
          │  Express + Socket.IO     │
          │  Agora Token Generator   │
          │  JWT Auth + REST API     │
          └──────┬──────────┬────────┘
                 │          │
         ┌───────┘    ┌─────┘
         ▼            ▼
  MongoDB Atlas   Agora.io Cloud
  (Free Tier)     (RTC + RTM)
```

### Data Flow

1. User authenticates → JWT issued by backend
2. Frontend connects to Socket.IO room for signaling
3. Backend generates Agora RTC token (24h expiry)
4. Frontend joins Agora channel for media streams
5. All metadata (chat, participants, recordings) → MongoDB
6. Host controls broadcast via Socket.IO to all clients

---

## Tech Stack

| Layer | Technology | Free Tier |
|-------|-----------|-----------|
| Frontend | React 18 + Vite | Static hosting (Vercel/Render) |
| Styling | Tailwind CSS | — |
| Real-time video | Agora RTC SDK | 10,000 min/month free |
| Real-time signaling | Socket.IO | Included with backend |
| Backend | Node.js + Express | Render/Railway free tier |
| Database | MongoDB + Mongoose | MongoDB Atlas 512MB free |
| Authentication | JWT (access + refresh) | — |
| Recording storage | Firebase Storage | 5GB free |
| CDN | Cloudflare | Free plan |
| SSL | Let's Encrypt via Render | Free automatic HTTPS |

---

## Quick Start

### Prerequisites
- Node.js 18+
- Git
- A free Agora.io account
- A free MongoDB Atlas account

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/nexmeet.git
cd nexmeet

# Install backend
cd backend && npm install

# Install frontend
cd ../frontend && npm install
```

### 2. Configure Environment

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env with your values (see Environment Variables section)

# Frontend
cd ../frontend
cp .env.example .env
# Edit .env.local
```

### 3. Run Development Servers

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

Visit `http://localhost:3000`

---

## Environment Variables

### Backend (`backend/.env`)

```env
# ── Server ──────────────────────────────────────
PORT=5000
NODE_ENV=development

# ── MongoDB Atlas ────────────────────────────────
# Get from: https://cloud.mongodb.com → Connect → Drivers
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/nexmeet?retryWrites=true&w=majority

# ── JWT Secrets (generate with: openssl rand -hex 64) ──
JWT_SECRET=your_64_char_random_secret_here
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=another_64_char_random_secret
JWT_REFRESH_EXPIRES_IN=30d

# ── Agora ────────────────────────────────────────
# Get from: https://console.agora.io → Project → App ID & Certificate
AGORA_APP_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AGORA_APP_CERTIFICATE=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ── Frontend URL (CORS) ──────────────────────────
FRONTEND_URL=http://localhost:3000

# ── Rate Limiting ────────────────────────────────
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_AGORA_APP_ID=your_agora_app_id
```

---

## Free Service Setup

### 1. Agora.io (Video/Audio — 10,000 min/month free)

1. Go to [console.agora.io](https://console.agora.io)
2. Create account → New Project
3. Choose **"Secured mode"** (with token authentication)
4. Copy **App ID** and **App Certificate**
5. Paste into backend `.env`

> **Free tier:** 10,000 minutes/month. For a small community, this is plenty.
> First 10,000 minutes are free every month, permanently.

### 2. MongoDB Atlas (512MB free)

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create free account → New Project → Build a Database
3. Choose **M0 (Free)** → AWS → us-east-1 (or closest region)
4. Create database user (username + password)
5. Add IP `0.0.0.0/0` to IP Access List (for cloud deployment)
6. Click **Connect** → **Drivers** → Copy connection string
7. Replace `<password>` in the URI and paste into `.env`

### 3. Firebase Storage (5GB free — for recordings)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create project → Enable Storage → Start in test mode
3. Go to **Project Settings** → **Service Accounts**
4. Generate new private key → Download JSON
5. Set `FIREBASE_STORAGE_BUCKET` to `your-project.appspot.com`
6. Paste the JSON content as `FIREBASE_SERVICE_ACCOUNT_KEY`

### 4. Render.com (Backend hosting — free)

1. Go to [render.com](https://render.com) → New Web Service
2. Connect your GitHub repo
3. Set root directory: `backend`
4. Build command: `npm install`
5. Start command: `npm start`
6. Add all environment variables from `.env`
7. Deploy → Copy the URL (e.g. `https://nexmeet-backend.onrender.com`)

> **Note:** Free tier sleeps after 15min of inactivity. Use UptimeRobot (free) to ping `/health` every 10min to keep it awake.

### 5. Vercel (Frontend hosting — free)

```bash
cd frontend
npm install -g vercel
vercel --prod
```

Set environment variables in Vercel dashboard:
- `VITE_API_URL` = `https://nexmeet-backend.onrender.com/api`
- `VITE_SOCKET_URL` = `https://nexmeet-backend.onrender.com`
- `VITE_AGORA_APP_ID` = your Agora App ID

### 6. Cloudflare (CDN + SSL — free)

1. Add your domain to Cloudflare (free plan)
2. Point DNS to your Vercel/Render deployment
3. Enable "Proxied" (orange cloud) for CDN + DDoS protection
4. SSL/TLS → Set to "Full (strict)"

---

## Deployment

### Option A: Render.com (Recommended — one-click)

Deploy using the included `render.yaml`:

1. Fork this repo on GitHub
2. Go to [render.com](https://render.com) → New → Blueprint
3. Connect your forked repo
4. Render will detect `render.yaml` and create both services
5. Set secret env vars in the dashboard

### Option B: Railway.app

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy backend
railway login
cd backend
railway init
railway up

# Set environment variables
railway variables set MONGODB_URI="..." JWT_SECRET="..."
```

### Option C: Docker Compose (VPS/Self-hosted)

```bash
# Clone repo on your server
git clone https://github.com/yourusername/nexmeet.git
cd nexmeet

# Create .env in root
cp .env.example .env
# Edit .env with all your values

# Deploy
cd docker
docker-compose up -d

# View logs
docker-compose logs -f backend

# Update deployment
git pull && docker-compose up -d --build
```

### Option D: Heroku (Free with Eco Dyno)

```bash
heroku login
heroku create nexmeet-backend
heroku config:set NODE_ENV=production MONGODB_URI="..."
git push heroku main
```

---

## Feature Reference

### Meeting Controls

| Feature | Host | Co-Host | Participant |
|---------|------|---------|-------------|
| Start/end meeting | ✅ | ✅ | ❌ |
| Mute/unmute self | ✅ | ✅ | ✅ |
| Mute others | ✅ | ✅ | ❌ |
| Remove participants | ✅ | ❌ | ❌ |
| Lock meeting | ✅ | ❌ | ❌ |
| Screen share | ✅ | ✅ | ✅* |
| Start recording | ✅ | ✅ | ❌ |
| Create breakout rooms | ✅ | ❌ | ❌ |
| Promote to co-host | ✅ | ❌ | ❌ |
| Chat | ✅ | ✅ | ✅ |
| Private messages | ✅ | ✅ | ✅ |
| Reactions | ✅ | ✅ | ✅ |
| Raise hand | ✅ | ✅ | ✅ |

*If allowed by host settings

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `M` | Toggle microphone |
| `V` | Toggle camera |
| `C` | Toggle chat panel |
| `H` | Raise/lower hand |
| `Space` (hold) | Push-to-talk |
| `Esc` | Close modals |

---

## API Reference

### Authentication

```
POST /api/auth/register    Register new user
POST /api/auth/login       Login
POST /api/auth/refresh     Refresh access token
POST /api/auth/logout      Logout
GET  /api/auth/me          Get current user
PATCH /api/auth/profile    Update profile
```

### Meetings

```
POST   /api/meetings                        Create meeting
GET    /api/meetings                        Get user meetings
GET    /api/meetings/:meetingId             Get meeting details
POST   /api/meetings/:meetingId/start       Start meeting
POST   /api/meetings/:meetingId/join        Join meeting
POST   /api/meetings/:meetingId/leave       Leave meeting
POST   /api/meetings/:meetingId/end         End meeting (host)
POST   /api/meetings/:meetingId/lock        Toggle lock
POST   /api/meetings/:meetingId/mute        Mute participant
DELETE /api/meetings/:meetingId/participants/:userId  Remove participant
POST   /api/meetings/:meetingId/breakout-rooms  Create breakout rooms
POST   /api/meetings/:meetingId/co-host     Promote to co-host
```

### Chat

```
GET    /api/chat/:meetingId             Get chat history
DELETE /api/chat/message/:messageId    Delete message
```

### Agora Tokens

```
GET  /api/agora/app-id      Get Agora App ID
POST /api/agora/rtc-token   Generate RTC token for video/audio
POST /api/agora/rtm-token   Generate RTM token for messaging
```

### Recordings

```
GET  /api/recordings/:meetingId          List recordings
POST /api/recordings/:meetingId/start    Start recording
POST /api/recordings/:recordingId/stop   Stop recording
```

### Socket.IO Events

**Client → Server:**
```
meeting:join        { meetingId }
meeting:leave       { meetingId }
chat:message        { meetingId, content, recipientId?, breakoutRoomId? }
hand:raise          { meetingId, raised }
reaction            { meetingId, emoji }
media:audio         { meetingId, muted }
media:video         { meetingId, off }
media:screenShare   { meetingId, sharing }
breakout:assign     { meetingId, assignments }
host:mute           { meetingId, targetUserId, muted }
host:kick           { meetingId, targetUserId }
recording:started   { meetingId }
recording:stopped   { meetingId }
```

**Server → Client:**
```
participant:joined     { userId, name, avatar }
participant:left       { userId, name }
participant:removed    { userId }
participant:muted      { userId, muted }
participant:roleChanged { userId, role }
meeting:started        { meetingId }
meeting:ended          { meetingId }
meeting:lockChanged    { isLocked }
chat:message           { message object }
hand:raise             { userId, name, raised }
reaction               { userId, name, emoji }
media:audio            { userId, muted }
media:video            { userId, off }
media:screenShare      { userId, name, sharing }
breakout:created       { rooms }
breakout:assigned      { roomId }
host:mute              { muted }
host:kicked            —
recording:started      { startedBy }
recording:stopped      —
```

---

## Scaling Guide

### Free Tier Limits & Workarounds

| Service | Free Limit | Workaround |
|---------|-----------|------------|
| Agora | 10,000 min/month | Use own TURN servers for overflow |
| MongoDB Atlas | 512MB storage | Archive old meetings, compress chat logs |
| Render.com | Sleeps after 15min | UptimeRobot ping every 10min |
| Firebase Storage | 5GB | Delete old recordings automatically |

### When to Upgrade

- **Agora:** At ~8,000 min/month usage — upgrade to pay-as-you-go ($3.99/1000 min)
- **MongoDB:** At ~400MB — upgrade to M2 ($9/month) or use TTL indexes to auto-delete old data
- **Backend:** When you need persistent connections — upgrade to Render Starter ($7/month)

### Auto-scaling Architecture

The backend uses Node.js cluster mode (`src/cluster.js`) to utilize all CPU cores:

```bash
# Run in cluster mode (production)
npm run cluster
```

For horizontal scaling, add a Redis adapter to Socket.IO:
```bash
npm install @socket.io/redis-adapter redis
```

Then uncomment the Redis adapter in `server.js`.

### MongoDB Optimization

Add TTL indexes for auto-cleanup:
```js
// Auto-delete ended meetings after 30 days
meetingSchema.index({ endedAt: 1 }, { expireAfterSeconds: 2592000 });

// Auto-delete chat after 90 days
chatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });
```

---

## Security Checklist

- [x] JWT with short expiry (7d) + refresh tokens (30d)
- [x] Bcrypt password hashing (12 rounds)
- [x] Helmet.js HTTP security headers
- [x] CORS restricted to frontend origin
- [x] Rate limiting (100 req/15min per IP)
- [x] Agora tokens expire in 24h
- [x] Input validation on all routes
- [x] MongoDB injection prevention via Mongoose
- [x] Non-root Docker user
- [ ] Add CAPTCHA on register (recommended for production)
- [ ] Add email verification (recommended)
- [ ] Add 2FA (optional)

---

## License

MIT — Free to use, modify, and deploy commercially.

---

## Credits

Built with:
- [Agora.io](https://agora.io) — Real-time video/audio
- [Socket.IO](https://socket.io) — Real-time signaling
- [MongoDB Atlas](https://mongodb.com/atlas) — Database
- [Render.com](https://render.com) — Hosting
- [React](https://react.dev) — Frontend framework
