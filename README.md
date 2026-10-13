# AI Interview System

A comprehensive AI-powered interview platform with automated scheduling, proctoring, and candidate evaluation.

## Features

- **AI-Powered Interviews**: Automated interview sessions with AI interviewers
- **Smart Scheduling**: Advanced slot management with calendar integration
- **Candidate Verification**: Document verification and identity checks
- **Live Proctoring**: Real-time monitoring during interviews
- **Performance Analytics**: Detailed candidate evaluation and scoring
- **Multi-language Support**: Interviews in multiple languages
- **WhatsApp Integration**: Candidate intake via WhatsApp

## Quick Start

### Prerequisites
- Node.js 18+ and npm 9+
- MongoDB (local or MongoDB Atlas)
- Git

### Local Development

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd ai_interview_system
   ```

2. **Backend Setup:**
   ```bash
   cd backend
   npm install
   cp .env.example .env  # Configure environment variables
   npm run dev
   ```

3. **Frontend Setup:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - API Health: http://localhost:5000/api/health

## Deployment

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md)

### Quick Deployment to Vercel

1. **Backend Deployment:**
   ```bash
   cd backend
   vercel  # Follow prompts
   ```

2. **Frontend Deployment:**
   ```bash
   cd frontend
   vercel  # Follow prompts
   ```

3. **Configure environment variables** in Vercel dashboard
4. **Connect MongoDB Atlas** database

## Project Structure

```
ai_interview_system/
├── backend/                 # Node.js Express API server
│   ├── src/
│   │   ├── config/         # Environment, database, OAuth, and Cloudinary configuration
│   │   ├── middleware/     # Auth, session, cookies, and verification middleware
│   │   ├── modules/        # Domain modules (auth, interview, candidate, projects, ai, botControl)
│   │   ├── services/       # Cross-cutting background maintenance and retention services
│   │   └── utils/          # Logger and shared helpers
│   └── package.json
├── frontend/                # Next.js 14 App Router client
│   ├── app/                # Route pages (admin, student, interview, verification)
│   ├── components/         # Reusable UI components & layouts
│   ├── services/           # Typed API service clients
│   └── package.json
├── meeting-bot/             # Python Playwright + Kokoro TTS + Deepgram STT worker
│   ├── app/                # Worker agent, Meet browser driver, VAD audio engine
│   ├── tests/              # Pytest test suite (124 tests)
│   └── requirements.txt
└── docs/                   # Architectural guides and deployment notes
```

## Testing & Verification

### Backend Tests
```bash
cd backend
npm test                # Run all 35 Jest test suites
```

### Frontend Build & Lint
```bash
cd frontend
npm run lint            # ESLint check
npm run build           # Next.js production build verification
```

### Meeting Bot Tests
```bash
cd meeting-bot
.\.venv\Scripts\python.exe -m pytest tests   # Run complete 124-test suite
```

---

**Last Updated**: October 13, 2026  
**Architecture Status**: Fully Audited & Refactored (100% Tests Passing)