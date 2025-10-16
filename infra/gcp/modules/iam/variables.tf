variable "project_id" {
  description = "Google Cloud project ID where service accounts will be created."
  type        = string
}

variable "service_accounts" {
  description = "Map of service account short names (without domain suffix)."
  type = object({
    runtime = string
    ci      = string
    dev     = string
  })
}

