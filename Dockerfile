# Use Python 3.13 slim image as base
FROM python:3.13-slim

# Set working directory to root
WORKDIR /

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy all application directories and files
COPY main.py .
COPY server/ server/
COPY utils/ utils/

# Copy static files with no cache
COPY static/ static/

# Set default environment variables
ENV HOST=0.0.0.0 \
    PORT=7000 \
    VERIFY_SSL=true \
    MAX_QUEUE_SIZE=100

# Expose port 7000
EXPOSE 7000

# Command to run the application
CMD ["python", "main.py"]