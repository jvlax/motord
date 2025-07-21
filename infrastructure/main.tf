terraform {
  required_version = ">= 1.0"
  required_providers {
    scaleway = {
      source  = "scaleway/scaleway"
      version = "~> 2.28"
    }
  }
}

# Configure Scaleway Provider
provider "scaleway" {
  zone   = "fr-par-1"
  region = "fr-par"
}

# Variables








# Container Registry
resource "scaleway_registry_namespace" "main" {
  name        = "${var.project_name}-registry"
  description = "Container registry for ${var.project_name}"
  is_public   = false
}

# Private Network
resource "scaleway_vpc_private_network" "main" {
  name   = "${var.project_name}-network"
  region = "fr-par"
}

# Security Group
resource "scaleway_instance_security_group" "main" {
  name                    = "${var.project_name}-sg"
  description            = "Security group for ${var.project_name}"
  inbound_default_policy = "drop"
  outbound_default_policy = "accept"

  # Temporary SSH access for debugging
  inbound_rule {
    action   = "accept"
    port     = 22
    protocol = "TCP"
  }

  # No other inbound rules needed - Load balancer communicates via private network
}

# Instance 1 (Frontend + Backend)
resource "scaleway_instance_server" "app" {
  name  = "${var.project_name}-app"
  type  = var.instance_type
  image = "ubuntu_focal"
  zone  = "fr-par-1"
  
  # Attach the flexible IP for SSH access
  ip_id = scaleway_instance_ip.public_ip.id

  root_volume {
    size_in_gb = 20
  }

  private_network {
    pn_id = scaleway_vpc_private_network.main.id
  }

  security_group_id = scaleway_instance_security_group.main.id

  user_data = {
    cloud-init = <<-EOF
      #!/bin/bash
      
      # Update system and install Docker
      apt-get update
      apt-get install -y docker.io curl
      systemctl enable docker
      systemctl start docker
      
      # Install Docker Compose v2
      curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
      chmod +x /usr/local/bin/docker-compose
      
      # Wait for Docker to be ready
      sleep 10
      
      # Create app directory
      mkdir -p /opt/motord
      cd /opt/motord
      
      # Create docker-compose.yml
      cat > docker-compose.yml << 'DOCKER_COMPOSE_EOF'
      version: '3.8'
      
      services:
        backend:
          image: ${scaleway_registry_namespace.main.endpoint}/${var.project_name}/backend:latest
          ports:
            - "8000:8000"
          environment:
            - ENVIRONMENT=production
          restart: unless-stopped
          networks:
            - motord-network
      
        frontend:
          image: ${scaleway_registry_namespace.main.endpoint}/${var.project_name}/frontend:latest
          ports:
            - "80:80"
          environment:
            - NODE_ENV=production
          restart: unless-stopped
          networks:
            - motord-network
          volumes:
            - ./nginx.conf:/etc/nginx/nginx.conf:ro
      
      networks:
        motord-network:
          driver: bridge
      DOCKER_COMPOSE_EOF
      
      # Create nginx configuration for frontend container
      cat > nginx.conf << 'NGINX_EOF'
      events {
          worker_connections 1024;
      }
      
      http {
          include       /etc/nginx/mime.types;
          default_type  application/octet-stream;
      
          # Logging
          log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                          '$status $body_bytes_sent "$http_referer" '
                          '"$http_user_agent" "$http_x_forwarded_for"';
      
          access_log /var/log/nginx/access.log main;
          error_log /var/log/nginx/error.log;
      
          # Gzip compression
          gzip on;
          gzip_vary on;
          gzip_min_length 1024;
          gzip_proxied any;
          gzip_comp_level 6;
          gzip_types
              text/plain
              text/css
              text/xml
              text/javascript
              application/json
              application/javascript
              application/xml+rss
              application/atom+xml
              image/svg+xml;
      
          upstream backend {
              server backend:8000;
          }
      
          server {
              listen 80;
              server_name _;
              root /usr/share/nginx/html;
              index index.html;
      
              # Serve static frontend files
              location / {
                  try_files $uri $uri/ /index.html;
              }
      
              # Proxy WebSocket connections to backend
              location /ws {
                  proxy_pass http://backend;
                  proxy_http_version 1.1;
                  proxy_set_header Upgrade $http_upgrade;
                  proxy_set_header Connection "upgrade";
                  proxy_set_header Host $host;
                  proxy_set_header X-Real-IP $remote_addr;
                  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                  proxy_set_header X-Forwarded-Proto $scheme;
              }
      
              # Proxy API calls to backend
              location /lobby {
                  proxy_pass http://backend;
                  proxy_set_header Host $host;
                  proxy_set_header X-Real-IP $remote_addr;
                  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                  proxy_set_header X-Forwarded-Proto $scheme;
              }
      
              location /health {
                  proxy_pass http://backend;
                  proxy_set_header Host $host;
                  proxy_set_header X-Real-IP $remote_addr;
                  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                  proxy_set_header X-Forwarded-Proto $scheme;
              }
      
              # Cache static assets
              location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|webp)$ {
                  expires 1y;
                  add_header Cache-Control "public, immutable";
              }
      
              # Security headers
              add_header X-Frame-Options "SAMEORIGIN" always;
              add_header X-Content-Type-Options "nosniff" always;
              add_header X-XSS-Protection "1; mode=block" always;
              add_header Referrer-Policy "strict-origin-when-cross-origin" always;
          }
      }
      NGINX_EOF
      
      # Login to Scaleway registry
      echo "${var.scaleway_secret_key}" | docker login ${scaleway_registry_namespace.main.endpoint} -u "${var.scaleway_access_key}" --password-stdin
      
      # Pull and start the application
      docker-compose pull
      docker-compose up -d
      
      # Log the startup
      echo "Application started at $(date)" >> /var/log/motord-startup.log
    EOF
  }

  tags = ["app", "production"]
}

# Load Balancer
resource "scaleway_lb" "main" {
  name            = "${var.project_name}-lb"
  type            = "lb-s"
  ip_ids          = [scaleway_lb_ip.main.id]
  
  private_network {
    private_network_id = scaleway_vpc_private_network.main.id
  }
}

# Instance IP (flexible IP for SSH access)
resource "scaleway_instance_ip" "public_ip" {
}

# Load Balancer IP
resource "scaleway_lb_ip" "main" {
}

# Backend for Load Balancer
resource "scaleway_lb_backend" "main" {
  lb_id            = scaleway_lb.main.id
  name             = "${var.project_name}-backend"
  forward_protocol = "http"
  forward_port     = 80
  # Use the instance's private IP address for communication over private network
  # Filter for IPv4 private network addresses (172.x.x.x range)
  server_ips       = [for ip in scaleway_instance_server.app.private_ips : ip.address if can(regex("^172\\.", ip.address))]
  health_check_http {
    uri = "/"
  }
  
  depends_on = [
    scaleway_instance_server.app,
    scaleway_lb.main
  ]
}

# Let's Encrypt SSL Certificate (managed by Scaleway)
resource "scaleway_lb_certificate" "main" {
  lb_id = scaleway_lb.main.id
  name  = "${var.project_name}-ssl-cert"
  
  letsencrypt {
    common_name = var.domain_name
  }
  
  depends_on = [scaleway_lb.main]
}

# HTTPS Frontend for Load Balancer
resource "scaleway_lb_frontend" "https" {
  lb_id           = scaleway_lb.main.id
  backend_id      = scaleway_lb_backend.main.id
  name            = "${var.project_name}-https-frontend"
  inbound_port    = 443
  certificate_ids = [scaleway_lb_certificate.main.id]
  
  depends_on = [scaleway_lb_certificate.main]
}

# HTTP Frontend for redirect to HTTPS
resource "scaleway_lb_frontend" "http" {
  lb_id        = scaleway_lb.main.id
  backend_id   = scaleway_lb_backend.main.id
  name         = "${var.project_name}-http-frontend"
  inbound_port = 80
}

# ACL Rule to redirect HTTP to HTTPS
resource "scaleway_lb_acl" "redirect_to_https" {
  frontend_id = scaleway_lb_frontend.http.id
  name        = "redirect-to-https"
  index       = 0
  
  action {
    type = "redirect"
    redirect {
      type = "location"
      target = "https://${var.domain_name}"
      code = 301
    }
  }
  
  match {
    http_filter = "path_begin"
    http_filter_value = ["/"]
  }
  
  depends_on = [scaleway_lb_frontend.http]
}



# DNS configuration moved to domain.tf

# Outputs
output "load_balancer_ip" {
  description = "IP address of the load balancer"
  value       = scaleway_lb.main.ip_address
}



output "registry_endpoint" {
  description = "Container registry endpoint"
  value       = scaleway_registry_namespace.main.endpoint
}

output "application_url" {
  description = "URL of the application"
  value       = "https://${var.domain_name}"
} 