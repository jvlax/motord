variable "scaleway_access_key" {
  description = "Scaleway access key"
  type        = string
  sensitive   = true
}

variable "scaleway_secret_key" {
  description = "Scaleway secret key"
  type        = string
  sensitive   = true
}

variable "scaleway_organization_id" {
  description = "Scaleway organization ID"
  type        = string
}

variable "scaleway_project_id" {
  description = "Scaleway project ID"
  type        = string
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "motord.eu"
}

variable "region" {
  description = "Scaleway region"
  type        = string
  default     = "fr-par"
}

variable "zone" {
  description = "Scaleway zone"
  type        = string
  default     = "fr-par-1"
}

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "motord-wordgame"
}

variable "instance_type" {
  description = "Type of instance to use"
  type        = string
  default     = "DEV1-S" # Small instance: 1 vCPU, 2GB RAM
} 