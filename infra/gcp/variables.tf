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

variable "artifact_registry_repositories" {
  description = "List of Artifact Registry repositories to create."
  type        = list(string)
  default     = ["vibesdk", "vibesdk-apps"]
}

variable "create_workerd_trigger" {
  description = "Set to true to create the Cloud Build trigger for the workerd runtime image."
  type        = bool
  default     = false
}

variable "github_owner" {
  description = "GitHub owner/organization used for Cloud Build triggers (if enabled)."
  type        = string
  default     = ""
}

variable "github_repo" {
  description = "GitHub repository name used for Cloud Build triggers (if enabled)."
  type        = string
  default     = ""
}

variable "github_branch" {
  description = "Branch regex for Cloud Build triggers (if enabled)."
  type        = string
  default     = "^main$"
}

variable "secret_placeholders" {
  description = "Map of Secret Manager secrets to seed with placeholders (update values manually later)."
  type        = map(string)
  default = {
    GOOGLE_AI_STUDIO_API_KEY = "placeholder"
    JWT_SECRET               = "placeholder"
    WEBHOOK_SECRET           = "placeholder"
    SECRETS_ENCRYPTION_KEY   = "placeholder"
    AI_PROXY_JWT_SECRET      = "placeholder"
  }
}

variable "runtime_image" {
  description = "Container image URI for the Cloud Run control plane."
  type        = string
}

variable "runtime_service_name" {
  description = "Name of the Cloud Run control plane service."
  type        = string
  default     = "vibesdk-control-plane"
}

variable "runtime_min_instances" {
  description = "Minimum Cloud Run instances to keep warm."
  type        = number
  default     = 1
}

variable "runtime_max_instances" {
  description = "Maximum Cloud Run instances allowed."
  type        = number
  default     = 5
}

variable "runtime_vpc_egress" {
  description = "Egress setting for the Serverless VPC connector."
  type        = string
  default     = "ALL_TRAFFIC"
}

variable "runtime_ingress" {
  description = "Ingress control for the Cloud Run service."
  type        = string
  default     = "INGRESS_TRAFFIC_INTERNAL_ONLY"
}

variable "runtime_env" {
  description = "Plain environment variables injected into the Cloud Run container."
  type        = map(string)
  default     = {}
}

variable "runtime_secret_bindings" {
  description = "Map of environment variable names to Secret Manager keys (from module.secrets) used in the runtime."
  type        = map(string)
  default = {
    JWT_SECRET             = "JWT_SECRET"
    SECRETS_ENCRYPTION_KEY = "SECRETS_ENCRYPTION_KEY"
    WEBHOOK_SECRET         = "WEBHOOK_SECRET"
    AI_PROXY_JWT_SECRET    = "AI_PROXY_JWT_SECRET"
    GOOGLE_AI_STUDIO_API_KEY = "GOOGLE_AI_STUDIO_API_KEY"
  }
}

variable "runtime_labels" {
  description = "Labels applied to the Cloud Run service."
  type        = map(string)
  default     = {}
}

variable "runtime_annotations" {
  description = "Annotations applied to the Cloud Run service."
  type        = map(string)
  default     = {}
}
