#!/bin/bash

# Build and Deploy Script for Motord Word Game
# This script builds Docker images and pushes them to Scaleway Container Registry

set -e  # Exit on any error

echo "🚀 Starting build and deploy process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "../docker-compose.yml" ]; then
    print_error "Please run this script from the infrastructure directory"
    exit 1
fi

# Get registry endpoint from Terraform output
print_status "Getting registry endpoint..."
REGISTRY_ENDPOINT=$(terraform output -raw registry_endpoint 2>/dev/null || echo "registry.fr-par.scw.cloud")

print_status "Registry endpoint: $REGISTRY_ENDPOINT"

# Build and push frontend image
print_status "Building frontend image..."
cd ../frontend
docker buildx build --platform linux/amd64 -t motord-wordgame/frontend:latest .

print_status "Tagging frontend image for Scaleway registry..."
docker tag motord-wordgame/frontend:latest $REGISTRY_ENDPOINT/motord-wordgame/frontend:latest

print_status "Pushing frontend image to Scaleway registry..."
docker push $REGISTRY_ENDPOINT/motord-wordgame/frontend:latest

# Build and push backend image
print_status "Building backend image..."
cd ../backend
docker buildx build --platform linux/amd64 -t motord-wordgame/backend:latest .

print_status "Tagging backend image for Scaleway registry..."
docker tag motord-wordgame/backend:latest $REGISTRY_ENDPOINT/motord-wordgame/backend:latest

print_status "Pushing backend image to Scaleway registry..."
docker push $REGISTRY_ENDPOINT/motord-wordgame/backend:latest

print_status "✅ All images built and pushed successfully!"

# Go back to infrastructure directory
cd ../infrastructure

print_status "Ready to deploy infrastructure with: terraform apply" 