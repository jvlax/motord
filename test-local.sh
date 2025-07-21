#!/bin/bash

# Test Local Docker Images
# This script tests the Docker images locally before deployment

set -e

echo "🧪 Testing Docker images locally..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Build frontend image
print_status "Building frontend image..."
cd frontend
docker build -t motord-wordgame/frontend:latest .

# Build backend image
print_status "Building backend image..."
cd ../backend
docker build -t motord-wordgame/backend:latest .

# Test with docker-compose
print_status "Testing with docker-compose..."
cd ..
docker-compose up -d

# Wait for services to start
print_status "Waiting for services to start..."
sleep 10

# Test frontend
print_status "Testing frontend..."
if curl -f http://localhost:80 >/dev/null 2>&1; then
    print_status "✅ Frontend is working!"
else
    print_error "❌ Frontend is not responding"
fi

# Test backend
print_status "Testing backend..."
if curl -f http://localhost:8000 >/dev/null 2>&1; then
    print_status "✅ Backend is working!"
else
    print_error "❌ Backend is not responding"
fi

# Show running containers
print_status "Running containers:"
docker-compose ps

print_status "✅ Local testing completed!"
print_warning "To stop the test environment, run: docker-compose down" 