variable "project_id" {
  description = "Google Cloud project ID for the Artifact Registry repositories."
  type        = string
}

variable "region" {
  description = "Region where repositories should live (e.g., us-central1)."
  type        = string
}

variable "repositories" {
  description = "List of repository IDs to create."
  type        = list(string)
  default     = ["vibesdk", "vibesdk-apps"]
}

variable "ci_service_account_email" {
  description = "Email of the CI service account that should push images."
  type        = string
}

