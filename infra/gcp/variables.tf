# Shared input variables for the landing zone modules.

variable "project_id" {
  description = "Google Cloud project ID that hosts the VibSDK stack."
  type        = string
}

variable "region" {
  description = "Primary region for Google Cloud resources (e.g., us-central1)."
  type        = string
  default     = "us-central1"
}

variable "service_accounts" {
  description = <<-EOT
  Map of service-account identifiers to email names. This keeps all SA names
  declared in one place and re-used by modules (runtime, CI, dev).
  EOT
  type = object({
    runtime = string
    ci      = string
    dev     = string
  })
  default = {
    runtime = "vibesdk-runtime"
    ci      = "vibesdk-ci"
    dev     = "vibesdk-dev"
  }
}

variable "vpc_cidr" {
  description = "Base CIDR block for the custom VPC created in the landing zone."
  type        = string
  default     = "10.20.0.0/16"
}

