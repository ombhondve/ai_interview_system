# AI Interview System - Deployment Guide

This guide provides instructions for deploying the AI Interview System to Vercel.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Backend Deployment](#backend-deployment)
4. [Frontend Deployment](#frontend-deployment)
5. [Environment Variables](#environment-variables)
6. [Database Setup](#database-setup)
7. [Third-Party Services](#third-party-services)
8. [Testing Deployment](#testing-deployment)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

- **Node.js** 18+ and **npm** 9+
- **Git** for version control
- **MongoDB Atlas** account (or self-hosted MongoDB)
- **Vercel** account (free tier available)
- **GitHub/GitLab/Bitbucket** account (for Vercel integration)

## Architecture Overview

The system consists of two main components:

1. **Backend API Server** (Node.js/Express)
   - Location: `/backend`
   - Port: 5000 (default)
   - API endpoints: `/api/*`

2. **Frontend Web Application** (Next.js/React)
   - Location: `/frontend`
   - Port: 3000 (development)
   - Proxy configuration: `/api/*` → Backend API

## Backend Deployment

### Option A: Deploy to Vercel (Recommended)

1. **Prepare the backend:**
   ```bash
   cd backend
   npm install
   ```

2. **Fix module import issues:**
   - Ensure all `.js` files use ES module syntax (`import/export`)
   - Check for CommonJS modules (`require/module.exports`) and convert them
   - Key files to check:
     - `src/modules/scheduling/slot.model.js` ✓ (already converted)
     - `src/modules/scheduling/slotTemplate.model.js` (needs conversion)
     - Any other `.js` files in the backend

3. **Create Vercel project:**
   ```bash
   # Install Vercel CLI
   npm i -g vercel

   # Login to Vercel
   vercel login

   # Deploy backend
   cd backend
   vercel
   ```

4. **Configure Vercel for backend:**
   - Runtime: Node.js
   - Build Command: `npm install`
   - Output Directory: (leave empty - not a static site)
   - Development Command: `npm run dev`
   - Install Command: `npm install`

### Option B: Deploy to Other Hosting

For other hosting providers (Railway, Render, Heroku, etc.):

1. Ensure `package.json` has correct scripts:
   ```json
   "scripts": {
     "start": "node src/server.js",
     "dev": "nodemon src/server.js"
   }
   ```

2. Set `NODE_ENV=production`
3. Configure environment variables (see below)
4. Use process manager (PM2) for production:
   ```bash
   npm install -g pm2
   pm2 start src/server.js --name "ai-interview-backend"
   ```

## Frontend Deployment

### Deploy to Vercel

1. **Prepare the frontend:**
   ```bash
   cd frontend
   npm install
   npm run build  # Test build locally
   ```

2. **Configure Vercel:**
   - The `vercel.json` file is already configured
   - Framework: Next.js (auto-detected)
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Development Command: `npm run dev`

3. **Deploy:**
   ```bash
   cd frontend
   vercel
   ```

4. **Connect to Git repository** (recommended):
   - Push code to GitHub/GitLab/Bitbucket
   - Import project in Vercel dashboard
   - Enable automatic deployments

## Environment Variables

### Backend Variables

Create `.env.production` or set in Vercel dashboard:

```env
# MongoDB Connection
STORAGE_MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority

# Application Settings
PORT=5000
NODE_ENV=production
JWT_SECRET=your-secure-jwt-secret-key-here-minimum-32-characters

# Frontend URL for CORS (set to your Vercel frontend URL)
FRONTEND_URL=https://your-frontend-app.vercel.app

# AI Services
GROQ_API_KEY=your-groq-api-key-here
GROQ_MODEL=openai/gpt-oss-120b
JALPI_API_KEY=your-jalpi-api-key-here

# Email Service (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password
SMTP_FROM=your-email@gmail.com

# SMS Service (Twilio)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Cloudinary for File Storage
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# WhatsApp Integration
WHATSAPP_VERIFY_TOKEN=your-whatsapp-verify-token

# Redis Cache (Optional - for production scaling)
REDIS_URL=redis://localhost:6379

# Security
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100   # 100 requests per window per IP
```

### Frontend Variables

Set in Vercel dashboard for frontend:

```env
# Backend API URL (your deployed backend URL)
NEXT_PUBLIC_API_URL=https://your-backend-api.vercel.app
BACKEND_URL=https://your-backend-api.vercel.app

# JWT Secret (must match backend)
JWT_SECRET=your-secure-jwt-secret-key-here-minimum-32-characters

# Optional: Analytics, Monitoring
NEXT_PUBLIC_GA_TRACKING_ID=UA-XXXXX-Y
```

## Database Setup

### MongoDB Atlas (Recommended)

1. **Create a cluster:**
   - Sign up at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Create a free tier cluster
   - Choose region closest to your users

2. **Configure database access:**
   - Create database user with read/write permissions
   - Whitelist IP addresses (0.0.0.0/0 for Vercel)
   - Get connection string

3. **Create database and collections:**
   - Database name: `ai_interview_system`
   - Collections will be created automatically by Mongoose

### Local MongoDB (Development)

```bash
# Install MongoDB
# Follow instructions for your OS: https://www.mongodb.com/docs/manual/installation/

# Start MongoDB service
mongod --dbpath /path/to/data

# Or use Docker
docker run -d -p 27017:27017 --name mongodb mongo
```

## Third-Party Services

### 1. Groq AI API
- Sign up at [Groq Cloud](https://console.groq.com)
- Generate API key
- Set `GROQ_API_KEY` in environment

### 2. Cloudinary (File Storage)
- Sign up at [Cloudinary](https://cloudinary.com)
- Get cloud name, API key, and API secret
- Set environment variables

### 3. Twilio (SMS)
- Sign up at [Twilio](https://www.twilio.com)
- Get Account SID, Auth Token, and phone number
- Set environment variables

### 4. Email Service (SMTP)
- Use Gmail with App Password
- Or use services like SendGrid, Mailgun, etc.

### 5. Google Calendar Integration
- Create project in [Google Cloud Console](https://console.cloud.google.com)
- Enable Calendar API
- Create OAuth 2.0 credentials
- Set environment variables

## Testing Deployment

### 1. Health Check Endpoints

**Backend:**
```
GET /api/health
Response: { "success": true, "message": "RecruitAI backend is running" }
```

**Frontend:**
- Load the application URL
- Check console for errors

### 2. API Connectivity Test

Use the included test script:
```bash
cd backend
node health-check.js
```

### 3. Enhanced Booking Workflow Test

Test the complete workflow:
1. Access frontend application
2. Navigate to booking section
3. Select available slot
4. Complete booking process
5. Check preparation workflow
6. Verify calendar integration

### 4. Monitor Logs

**Vercel Logs:**
```bash
# View deployment logs
vercel logs

# View real-time logs
vercel logs --follow
```

## Troubleshooting

### Common Issues

#### 1. CORS Errors
- Ensure `FRONTEND_URL` is set correctly
- Check CORS configuration in `src/app.js`
- Verify Vercel URLs match allowed origins

#### 2. Database Connection Issues
- Check MongoDB connection string
- Verify network access (IP whitelist)
- Test connection with MongoDB Compass

#### 3. Module Import Errors
```bash
# Common error: "The requested module does not provide an export named 'default'"
# Solution: Convert CommonJS modules to ES modules

# Before (CommonJS):
const mongoose = require("mongoose");
module.exports = Model;

# After (ES Module):
import mongoose from "mongoose";
export default Model;
```

#### 4. Build Failures
- Check Node.js version compatibility
- Verify all dependencies are installed
- Check for syntax errors

#### 5. Environment Variables Not Loading
- Verify variable names match code
- Check for typos
- Restart application after changing variables

### Debugging Steps

1. **Check Vercel deployment logs**
2. **Test API endpoints with curl or Postman**
3. **Verify database connectivity**
4. **Check frontend console for errors**
5. **Review application logs**

### Support

- **Backend Issues**: Check `backend/README.md`
- **Frontend Issues**: Check `frontend/README.md`
- **Deployment Issues**: Vercel documentation
- **Database Issues**: MongoDB Atlas documentation

## Maintenance

### Regular Tasks

1. **Monitor application performance**
2. **Review error logs weekly**
3. **Update dependencies monthly**
4. **Backup database regularly**
5. **Review security settings quarterly**

### Scaling Considerations

- **Database**: Upgrade MongoDB Atlas tier
- **Backend**: Add more Vercel instances
- **Cache**: Implement Redis for frequently accessed data
- **CDN**: Use Vercel Edge Network for static assets

## Security Notes

1. **Never commit `.env` files to Git**
2. **Use strong JWT secrets**
3. **Enable HTTPS (automatically on Vercel)**
4. **Implement rate limiting**
5. **Regular security audits**
6. **Keep dependencies updated**

---

**Last Updated**: September 30, 2026  
**Version**: 1.0  
**Contact**: Deployment Team