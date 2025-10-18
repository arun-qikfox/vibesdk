# Terraform provider configuration for Google Cloud.

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.28"
    }
  }

  backend "gcs" {
    bucket = "qfxcloud-tf-state"
    prefix = "landing-zone"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
