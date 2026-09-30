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
├── backend/                 # Node.js/Express API server
│   ├── src/
│   │   ├── modules/        # Feature modules
│   │   ├── config/         # Configuration files
│   │   ├── middleware/     # Express middleware
│   │   └── jobs/           # Background jobs
│   └── package.json
├── frontend/               # Next.js/React frontend
│   ├── app/               # Next.js app router pages
│   ├── components/        # React components
│   ├── services/          # API service layer
│   └── package.json
└── docs/                  # Documentation
```

## Key Features Implemented

### Phase 1: Core Infrastructure
- User authentication and authorization
- Candidate management system
- Basic interview scheduling

### Phase 2: AI Verification
- Document verification with AI
- Identity verification
- Fraud detection

### Phase 3: Enhanced Interview Booking
- Advanced slot management with recurrence
- Calendar integration (Google Calendar)
- Preparation workflow
- Booking confirmations and notifications

### Phase 4: Interview Execution
- AI interviewer integration
- Live proctoring
- Real-time transcription
- Performance evaluation

## Environment Variables

See `.env.example` files in both `backend/` and `frontend/` directories for required environment variables.

## API Documentation

### Key Endpoints

- `GET /api/health` - Health check
- `POST /api/auth/login` - User authentication
- `GET /api/interviews/slots` - Available interview slots
- `POST /api/interviews/:candidateId/book/:slotId` - Book interview
- `GET /api/candidates` - List candidates

## Development

### Running Tests
```bash
cd backend
npm test

cd frontend
npm test
```

### Code Style
- ESLint configuration in both backend and frontend
- Prettier for code formatting
- Husky for pre-commit hooks

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is proprietary software.

## Support

For issues and questions:
1. Check the [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment issues
2. Review existing documentation
3. Contact the development team

---

**Last Updated**: September 30, 2026  
**Version**: 3.0 (Enhanced Booking Release)