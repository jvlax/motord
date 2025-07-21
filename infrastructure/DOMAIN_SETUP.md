# 🌐 Domain Setup Guide

This guide explains how to set up a domain for your Motord word game.

## 📋 Domain Options

### **Option 1: Register New Domain (Recommended)**

#### **Step 1: Register Domain in Scaleway**
1. Go to [Scaleway Console](https://console.scaleway.com/)
2. Navigate to **Domains & DNS**
3. Click **Register a domain**
4. Search for available domains
5. Choose your domain (e.g., `motord-game.com`)
6. Complete registration (~€10-15/year)

#### **Step 2: Update Terraform Configuration**
1. Edit `terraform.tfvars`:
   ```hcl
   domain_name = "your-actual-domain.com"
   ```

2. Run deployment:
   ```bash
   ./deploy.sh
   ```

### **Option 2: Use Existing Domain**

#### **Step 1: Point DNS to Scaleway**
1. Go to your domain registrar (GoDaddy, Namecheap, etc.)
2. Find DNS settings
3. Add nameservers:
   ```
   ns1.scaleway.com
   ns2.scaleway.com
   ```

#### **Step 2: Update Terraform Configuration**
1. Edit `terraform.tfvars`:
   ```hcl
   domain_name = "your-existing-domain.com"
   ```

2. Run deployment:
   ```bash
   ./deploy.sh
   ```

### **Option 3: Use Load Balancer IP (No Domain)**

If you don't want a domain:
1. Leave `domain_name = "your-domain.com"` in `terraform.tfvars`
2. Access your app via the load balancer IP
3. Terraform will skip DNS configuration

## 🔧 DNS Records Created

When you provide a domain, Terraform creates:

| Record | Type | Value | Purpose |
|--------|------|-------|---------|
| `@` | A | Load Balancer IP | Main domain |
| `www` | CNAME | `@` | WWW subdomain |
| `api` | A | Load Balancer IP | API endpoints |
| `ws` | A | Load Balancer IP | WebSocket connections |

## 🌍 Domain Examples

### **Good Domain Ideas:**
- `motord-game.com`
- `wordgame.app`
- `translate-game.com`
- `vocab-battle.com`
- `lingo-challenge.com`

### **Domain Extensions:**
- `.com` - Most popular (~€10-15/year)
- `.app` - Modern, secure (~€15-20/year)
- `.io` - Tech-focused (~€20-30/year)
- `.co` - Short, memorable (~€10-15/year)

## 🔒 SSL Certificate Setup

### **Automatic SSL (Recommended)**
1. Register domain through Scaleway
2. Terraform will automatically configure SSL
3. Your app will be available at `https://your-domain.com`

### **Manual SSL Setup**
If using external domain:
1. Get SSL certificate (Let's Encrypt)
2. Configure nginx with SSL
3. Update load balancer settings

## 🚀 Quick Start

### **For New Domain:**
```bash
# 1. Register domain in Scaleway console
# 2. Update terraform.tfvars
domain_name = "your-new-domain.com"

# 3. Deploy
./deploy.sh
```

### **For Existing Domain:**
```bash
# 1. Point DNS to Scaleway nameservers
# 2. Update terraform.tfvars
domain_name = "your-existing-domain.com"

# 3. Deploy
./deploy.sh
```

### **No Domain (IP Only):**
```bash
# 1. Leave default domain name
domain_name = "your-domain.com"

# 2. Deploy
./deploy.sh

# 3. Access via load balancer IP
```

## ⏱️ DNS Propagation

After deployment:
- **DNS changes** take 5-60 minutes to propagate
- **SSL certificates** may take 10-30 minutes
- **Test your domain** after waiting

## 🛠️ Troubleshooting

### **Domain Not Working:**
1. Check DNS propagation: `dig your-domain.com`
2. Verify nameservers are correct
3. Wait 30-60 minutes for propagation

### **SSL Not Working:**
1. Check if domain is properly registered
2. Verify DNS records are correct
3. Wait for SSL certificate generation

### **Subdomain Issues:**
1. Check if all DNS records were created
2. Verify load balancer health checks
3. Test individual subdomains

## 💡 Tips

1. **Choose a memorable domain** - easier to share
2. **Use .com extension** - most recognized
3. **Keep it short** - easier to type
4. **Consider branding** - matches your game name
5. **Check availability** before deciding

## 📞 Support

If you have domain issues:
1. Check Scaleway domain documentation
2. Verify DNS settings in your registrar
3. Test DNS propagation online
4. Contact Scaleway support if needed 