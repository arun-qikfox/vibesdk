variable "project_id" {
  description = "Google Cloud project ID hosting the preview ingress resources."
  type        = string
}

variable "region" {
  description = "Region of the Cloud Run services backing the preview ingress."
  type        = string
}

variable "cloud_run_service" {
  description = "Name of the Cloud Run service that proxies preview traffic."
  type        = string
}

variable "preview_domain" {
  description = "Fully qualified domain (e.g., apps.example.com) serving preview apps."
  type        = string
}

variable "dns_zone_name" {
  description = "Name of the Cloud DNS managed zone that hosts preview records."
  type        = string
  default     = "preview-apps"
}
