# Domain Registration and DNS Management
# Note: Domain registration requires manual setup in Scaleway console

# DNS Zone (domain is registered, phone verification complete)
# Enabled now that domain motord.eu is registered

resource "scaleway_domain_record" "main" {
  count    = var.domain_name != "your-domain.com" ? 1 : 0
  dns_zone = var.domain_name
  name     = "@"
  type     = "A"
  data     = scaleway_lb.main.ip_address
  ttl      = 300
}

# Additional DNS records for subdomains
resource "scaleway_domain_record" "www" {
  count    = var.domain_name != "your-domain.com" ? 1 : 0
  dns_zone = var.domain_name
  name     = "www"
  type     = "CNAME"
  data     = var.domain_name
  ttl      = 300
}

# API subdomain for backend
resource "scaleway_domain_record" "api" {
  count    = var.domain_name != "your-domain.com" ? 1 : 0
  dns_zone = var.domain_name
  name     = "api"
  type     = "A"
  data     = scaleway_lb.main.ip_address
  ttl      = 300
}

# WebSocket subdomain
resource "scaleway_domain_record" "ws" {
  count    = var.domain_name != "your-domain.com" ? 1 : 0
  dns_zone = var.domain_name
  name     = "ws"
  type     = "A"
  data     = scaleway_lb.main.ip_address
  ttl      = 300
} 