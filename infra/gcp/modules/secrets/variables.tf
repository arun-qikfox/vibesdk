variable "project_id" {
  description = "Google Cloud project ID where secrets live."
  type        = string
}

variable "secrets" {
  description = "Map of secret IDs to placeholder string values."
  type        = map(string)
  default     = {}
}
