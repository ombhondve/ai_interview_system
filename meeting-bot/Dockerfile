# Use Playwright official Python image with Chromium pre-installed
FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

WORKDIR /app

# Set environment defaults
ENV PYTHONUNBUFFERED=1 \
    MEETING_BOT_HEADLESS=true \
    MEETING_BOT_PROFILE_DIR=/app/bot-profile \
    MEETING_BOT_PORT=8001 \
    MEETING_BOT_HOST=0.0.0.0

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Ensure Playwright browser dependencies are installed
RUN playwright install chromium

# Copy application source
COPY app/ ./app/

# Expose bot control API port
EXPOSE 8001

# Run API server by default
CMD ["python", "-m", "app.main", "--server"]
