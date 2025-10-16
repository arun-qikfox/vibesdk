variable "project_id" {
  description = "Google Cloud project ID for the networking resources."
  type        = string
}

variable "region" {
  description = "Region used for subnets and serverless connector (e.g., us-central1)."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block allocated to the VPC."
  type        = string
}

variable "private_subnet_cidr" {
  description = "CIDR block for the private subnet."
  type        = string
  default     = "10.20.1.0/24"
}

variable "public_subnet_cidr" {
  description = "CIDR block for the public subnet."
  type        = string
  default     = "10.20.2.0/24"
}

