variable "project_id" {
  description = "Google Cloud project ID owning the bucket."
  type        = string
}

variable "location" {
  description = "Location/region of the storage bucket."
  type        = string
  default     = "US"
}

variable "bucket_name" {
  description = "Name of the storage bucket."
  type        = string
}

variable "force_destroy" {
  description = "Whether to force destroy the bucket when Terraform destroys it."
  type        = bool
  default     = false
}

variable "versioning" {
  description = "Enable object versioning."
  type        = bool
  default     = false
}

variable "lifecycle_rules" {
  description = "List of lifecycle rules applied to the bucket."
  type = list(object({
    action = object({
      type          = string
      storage_class = optional(string)
    })
    condition = map(any)
  }))
  default = []
}

variable "labels" {
  description = "Labels applied to the bucket."
  type        = map(string)
  default     = {}
}

variable "runtime_service_accounts" {
  description = "Map of identifiers to service account emails needing object admin access."
  type        = map(string)
  default     = {}
}

variable "context_bucket_name" {
  description = "Optional deployment context bucket name. Leave blank to skip creation."
  type        = string
  default     = ""
}

variable "context_bucket_location" {
  description = "Override location for the deployment context bucket (defaults to primary location)."
  type        = string
  default     = ""
}

variable "context_bucket_force_destroy" {
  description = "Whether to force destroy the deployment context bucket."
  type        = bool
  default     = false
}

variable "context_bucket_labels" {
  description = "Labels applied to the deployment context bucket."
  type        = map(string)
  default     = { purpose = "deployment-contexts" }
}

variable "context_bucket_lifecycle_age_days" {
  description = "Age in days after which deployment context objects are deleted."
  type        = number
  default     = 30
}
