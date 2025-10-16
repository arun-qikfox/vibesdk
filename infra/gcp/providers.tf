# Terraform provider configuration for Google Cloud.

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.28"
    }
  }

  # TODO: configure remote state (e.g., GCS bucket) before first `terraform apply`.
  # backend "gcs" {
  #   bucket = "vibesdk-terraform-state"
  #   prefix = "landing-zone"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

