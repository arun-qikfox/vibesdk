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
