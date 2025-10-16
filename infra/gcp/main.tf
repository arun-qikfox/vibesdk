# Root module for the VibSDK Google Cloud landing zone.
# This file wires together child modules (networking, IAM, registry, etc.).

locals {
  project_id = var.project_id
  region     = var.region
}

module "networking" {
  source     = "./modules/networking"
  project_id = local.project_id
  region     = local.region
  vpc_cidr   = var.vpc_cidr
}

module "iam" {
  source            = "./modules/iam"
  project_id        = local.project_id
  service_accounts  = var.service_accounts
}
