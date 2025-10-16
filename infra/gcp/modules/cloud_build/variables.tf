variable "project_id" {
  description = "Google Cloud project ID where Cloud Build resources reside."
  type        = string
}

variable "ci_service_account_email" {
  description = "Email of the CI service account that should run Cloud Build triggers."
  type        = string
}

variable "create_workerd_trigger" {
  description = "Whether to create the placeholder Cloud Build trigger for workerd images."
  type        = bool
  default     = false
}

variable "github_owner" {
  description = "GitHub owner/org for Cloud Build trigger (used when create_workerd_trigger = true)."
  type        = string
  default     = ""
}

variable "github_repo" {
  description = "GitHub repo name for Cloud Build trigger (used when create_workerd_trigger = true)."
  type        = string
  default     = ""
}

variable "github_branch" {
  description = "Branch pattern for the Cloud Build trigger (used when create_workerd_trigger = true)."
  type        = string
  default     = "^main$"
}

