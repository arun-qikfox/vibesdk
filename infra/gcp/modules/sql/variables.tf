variable "project_id" {
  description = "Google Cloud project ID that hosts the Cloud SQL instance."
  type        = string
}

variable "region" {
  description = "Region where the Cloud SQL instance will be created."
  type        = string
}

variable "instance_name" {
  description = "Name of the Cloud SQL instance."
  type        = string
  default     = "vibesdk-sql"
}

variable "database_name" {
  description = "Primary database name to create inside the instance."
  type        = string
  default     = "vibesdk"
}

variable "user_name" {
  description = "Application database user."
  type        = string
  default     = "vibesdk_app"
}

variable "private_network" {
  description = "Self link of the VPC network used for private service access."
  type        = string
}

variable "password_secret_id" {
  description = "Secret Manager secret ID where the generated database password will be stored."
  type        = string
  default     = "vibesdk-sql-app-password"
}

variable "connection_secret_id" {
  description = "Secret Manager secret ID that stores the Cloud SQL connection URI."
  type        = string
  default     = "vibesdk-sql-connection-url"
}

variable "tier" {
  description = "Machine tier for the Cloud SQL instance."
  type        = string
  default     = "db-custom-2-3840"
}

variable "disk_size_gb" {
  description = "Allocated storage size for the instance in GB."
  type        = number
  default     = 50
}

variable "availability_type" {
  description = "Availability type for the Cloud SQL instance (ZONAL or REGIONAL)."
  type        = string
  default     = "ZONAL"
}

variable "backup_retention_days" {
  description = "Number of days to retain automated backups."
  type        = number
  default     = 7
}
