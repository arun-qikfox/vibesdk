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

module "artifact_registry" {
  source                     = "./modules/artifact_registry"
  project_id                 = local.project_id
  region                     = local.region
  repositories               = var.artifact_registry_repositories
  ci_service_account_email   = module.iam.ci_service_account_email
}

module "cloud_build" {
  source                    = "./modules/cloud_build"
  project_id                = local.project_id
  ci_service_account_email  = module.iam.ci_service_account_email
  create_workerd_trigger    = var.create_workerd_trigger
  github_owner              = var.github_owner
  github_repo               = var.github_repo
  github_branch             = var.github_branch
}

module "secrets" {
  source   = "./modules/secrets"
  project_id = local.project_id
  secrets    = var.secret_placeholders
}

module "runtime" {
  source                = "./modules/runtime"
  project_id            = local.project_id
  region                = local.region
  service_name          = var.runtime_service_name
  image                 = var.runtime_image
  service_account_email = module.iam.runtime_service_account_email
  vpc_connector         = module.networking.serverless_connector
  vpc_egress            = var.runtime_vpc_egress
  ingress               = var.runtime_ingress
  min_instances         = var.runtime_min_instances
  max_instances         = var.runtime_max_instances
  env                   = var.runtime_env
  labels                = var.runtime_labels
  annotations           = var.runtime_annotations

  secret_env = {
    for env_var, secret_key in var.runtime_secret_bindings :
    env_var => {
      secret  = module.secrets.secret_ids[secret_key]
      version = "latest"
    }
    if contains(keys(module.secrets.secret_ids), secret_key)
  }
}
