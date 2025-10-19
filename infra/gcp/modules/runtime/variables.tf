variable "project_id" {
  description = "Google Cloud project ID for the Cloud Run service."
  type        = string
}

variable "region" {
  description = "Region where the Cloud Run service will be deployed."
  type        = string
}

variable "service_name" {
  description = "Name of the Cloud Run service."
  type        = string
}

variable "image" {
  description = "Container image to deploy to Cloud Run."
  type        = string
}

variable "service_account_email" {
  description = "Service account email used by the Cloud Run service."
  type        = string
}

variable "vpc_connector" {
  description = "Optional Serverless VPC Connector name for egress."
  type        = string
  default     = ""
}

variable "vpc_egress" {
  description = "VPC egress setting for the connector."
  type        = string
  default     = "ALL_TRAFFIC"
}

variable "ingress" {
  description = "Ingress control for the service."
  type        = string
  default     = "INGRESS_TRAFFIC_INTERNAL_ONLY"
}

variable "min_instances" {
  description = "Minimum number of Cloud Run instances."
  type        = number
  default     = 1
}

variable "max_instances" {
  description = "Maximum number of Cloud Run instances."
  type        = number
  default     = 5
}

variable "env" {
  description = "Plain environment variables for the container."
  type        = map(string)
  default     = {}
}

variable "secret_env" {
  description = "Environment variables sourced from Secret Manager."
  type = map(object({
    secret  = string
    version = optional(string, "latest")
  }))
  default = {}
}

variable "labels" {
  description = "Labels to apply to the Cloud Run service."
  type        = map(string)
  default     = {}
}

variable "cloud_sql_instances" {
  description = "List of Cloud SQL instance connection names to mount into the service."
  type        = list(string)
  default     = []
}

variable "annotations" {
  description = "Annotations to apply to the Cloud Run service."
  type        = map(string)
  default     = {}
}
