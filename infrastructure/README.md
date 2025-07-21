# 🚀 Motord Word Game - Scaleway Deployment

This directory contains the infrastructure as code (IaC) for deploying the Motord Word Game to Scaleway cloud.

## 📋 Prerequisites

- **Scaleway Account** with API keys
- **Terraform** installed (v1.0+)
- **Docker** installed and running
- **Domain name** (optional, for production)

## 🏗️ Infrastructure Overview

The deployment creates:

- **VM Instance** (DEV1-S): 1 vCPU, 2GB RAM, 20GB storage
- **Load Balancer**: Routes traffic to the VM
- **Container Registry**: Stores Docker images
- **Private Network**: Secure communication
- **Security Group**: Firewall rules
- **DNS Records**: Domain configuration (temporarily disabled)

## 📁 Files Structure

```
infrastructure/
├── main.tf              # Main infrastructure configuration
├── variables.tf         # Variable definitions
├── domain.tf           # DNS configuration (temporarily disabled)
├── terraform.tfvars    # Your credentials (create this)
├── terraform.tfvars.example  # Template for credentials
├── deploy.sh           # Complete deployment script
├── build-and-deploy.sh # Docker build and push script
└── README.md           # This file
```

## 🔧 Setup Instructions

### 1. Configure Credentials

Copy the example file and fill in your Scaleway credentials:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your credentials:

```hcl
scaleway_access_key      = "YOUR_ACCESS_KEY"
scaleway_secret_key      = "YOUR_SECRET_KEY"
scaleway_organization_id = "YOUR_ORG_ID"
scaleway_project_id      = "YOUR_PROJECT_ID"
domain_name = "motord.fr"
```

### 2. Test Locally (Optional)

Test the Docker images locally before deployment:

```bash
cd ..
./test-local.sh
```

### 3. Deploy Infrastructure

Run the complete deployment script:

```bash
cd infrastructure
./deploy.sh
```

This script will:
- ✅ Check prerequisites
- ✅ Initialize Terraform
- ✅ Plan the deployment
- ✅ Apply infrastructure
- ✅ Build and push Docker images
- ✅ Show deployment results

## 🔍 Manual Deployment Steps

If you prefer manual deployment:

```bash
# Initialize Terraform
terraform init

# Plan deployment
terraform plan

# Apply infrastructure
terraform apply

# Build and push images
./build-and-deploy.sh
```

## 🌐 Accessing Your Application

After deployment, your application will be available at:

- **Load Balancer IP**: `http://<load-balancer-ip>`
- **Domain**: `http://motord.fr` (after DNS setup)

## 📊 Cost Estimation

Monthly costs (approximate):
- **VM (DEV1-S)**: ~€3.50/month
- **Load Balancer**: ~€2.50/month
- **Container Registry**: ~€1.00/month
- **Total**: ~€7.00/month

## 🔧 Post-Deployment Steps

### 1. Phone Verification (Required)

Before enabling domain features:
- Contact Scaleway support for phone verification
- Or register domain externally

### 2. Enable Domain Features

Once phone verification is complete:

```bash
# Uncomment DNS records in domain.tf
# Then run:
terraform apply
```

### 3. SSL Certificate

Set up SSL for HTTPS:
- Use Scaleway's automatic SSL
- Or configure Let's Encrypt manually

## 🐛 Troubleshooting

### Common Issues

1. **Phone Verification Required**
   - Contact Scaleway support
   - Use external domain registration

2. **Docker Build Failures**
   - Check Docker is running
   - Verify Dockerfile syntax

3. **VM Not Starting**
   - Check security group rules
   - Verify user data script

4. **Load Balancer Health Checks**
   - Ensure nginx is running on VM
   - Check port 80 is accessible

### Useful Commands

```bash
# Check Terraform state
terraform show

# View logs on VM
ssh root@<vm-ip>
docker-compose logs

# Rebuild and push images
./build-and-deploy.sh

# Destroy infrastructure
terraform destroy
```

## 🔒 Security Notes

- **API Keys**: Keep `terraform.tfvars` secure
- **Firewall**: Only necessary ports are open
- **Private Network**: VM is on private network
- **Registry**: Private container registry

## 📞 Support

For issues with:
- **Scaleway Infrastructure**: Contact Scaleway support
- **Application Code**: Check the main README.md
- **Deployment Scripts**: Review this README

## 🎯 Next Steps

1. **Wait for phone verification** to be resolved
2. **Test the application** at the load balancer IP
3. **Enable domain features** once verified
4. **Set up monitoring** and logging
5. **Configure backups** for the VM

---

**Happy Deploying! 🚀** 