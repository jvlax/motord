#!/bin/bash

# Complete Deployment Script for Motord Word Game
# This script handles the entire deployment process

set -e  # Exit on any error

echo "🚀 Starting complete deployment process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_step "Checking prerequisites..."
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    
    # Check if Terraform is installed
    if ! command -v terraform >/dev/null 2>&1; then
        print_error "Terraform is not installed. Please install Terraform and try again."
        exit 1
    fi
    
    # Check if terraform.tfvars exists
    if [ ! -f "terraform.tfvars" ]; then
        print_error "terraform.tfvars not found. Please create it with your Scaleway credentials."
        exit 1
    fi
    
    print_status "Prerequisites check passed!"
}

# Initialize Terraform
init_terraform() {
    print_step "Initializing Terraform..."
    terraform init
    print_status "Terraform initialized successfully!"
}

# Plan Terraform deployment
plan_deployment() {
    print_step "Planning Terraform deployment..."
    terraform plan
    print_status "Terraform plan completed!"
}

# Apply Terraform deployment
apply_infrastructure() {
    print_step "Applying Terraform infrastructure..."
    terraform apply -auto-approve
    print_status "Infrastructure deployed successfully!"
}

# Build and push Docker images
build_and_push_images() {
    print_step "Building and pushing Docker images..."
    ./build-and-deploy.sh
    print_status "Docker images built and pushed successfully!"
}

# Show deployment results
show_results() {
    print_step "Deployment Results:"
    
    # Get outputs
    LB_IP=$(terraform output -raw load_balancer_ip 2>/dev/null || echo "N/A")
    REGISTRY_ENDPOINT=$(terraform output -raw registry_endpoint 2>/dev/null || echo "N/A")
    APP_URL=$(terraform output -raw application_url 2>/dev/null || echo "N/A")
    
    echo ""
    echo "📊 Deployment Summary:"
    echo "  • Load Balancer IP: $LB_IP"
    echo "  • Registry Endpoint: $REGISTRY_ENDPOINT"
    echo "  • Application URL: $APP_URL"
    echo ""
    
    if [ "$LB_IP" != "N/A" ]; then
        print_status "🌐 Your application should be available at: http://$LB_IP"
        print_warning "Note: Domain DNS records are temporarily disabled due to phone verification requirement"
    fi
    
    echo ""
    print_status "✅ Deployment completed successfully!"
    echo ""
    print_warning "Next steps:"
    echo "  1. Wait for phone verification to be resolved"
    echo "  2. Uncomment DNS records in domain.tf"
    echo "  3. Run 'terraform apply' to add domain configuration"
    echo "  4. Test your application"
}

# Main deployment process
main() {
    echo "🎯 Motord Word Game - Complete Deployment"
    echo "=========================================="
    echo ""
    
    check_prerequisites
    init_terraform
    plan_deployment
    
    echo ""
    read -p "Do you want to proceed with the deployment? (y/N): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        apply_infrastructure
        build_and_push_images
        show_results
    else
        print_warning "Deployment cancelled by user"
        exit 0
    fi
}

# Run main function
main "$@" 