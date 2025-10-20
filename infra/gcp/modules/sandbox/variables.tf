variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "pubsub_topic" {
  type = string
}

variable "job_name" {
  type = string
}

variable "job_image" {
  type = string
}

variable "job_env" {
  type    = map(string)
  default = {}
}

variable "job_resource_limits" {
  type    = map(string)
  default = {}
}

variable "job_service_account" {
  type = string
}

variable "job_max_retries" {
  type    = number
  default = 1
}

variable "job_timeout" {
  type    = string
  default = "3600s"
}

variable "pubsub_service_account" {
  type    = string
  default = null
}
