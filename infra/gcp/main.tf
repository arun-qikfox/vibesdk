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

module "sql" {
  source             = "./modules/sql"
  project_id         = local.project_id
  region             = local.region
  instance_name      = var.sql_instance_name
  database_name      = var.sql_database_name
  user_name          = var.sql_user_name
  password_secret_id = var.sql_password_secret_id
  private_network    = module.networking.vpc_id
}

module "iam" {
  source           = "./modules/iam"
  project_id       = local.project_id
  service_accounts = var.service_accounts
}

module "artifact_registry" {
  source                   = "./modules/artifact_registry"
  project_id               = local.project_id
  region                   = local.region
  repositories             = var.artifact_registry_repositories
  ci_service_account_email = module.iam.ci_service_account_email
}

module "cloud_build" {
  source                   = "./modules/cloud_build"
  project_id               = local.project_id
  ci_service_account_email = module.iam.ci_service_account_email
  create_workerd_trigger   = var.create_workerd_trigger
  github_owner             = var.github_owner
  github_repo              = var.github_repo
  github_branch            = var.github_branch
}

module "secrets" {
  source     = "./modules/secrets"
  project_id = local.project_id
  secrets    = var.secret_placeholders
}

module "storage" {
  source      = "./modules/storage"
  project_id  = local.project_id
  location    = var.templates_bucket_location
  bucket_name = var.templates_bucket_name
  versioning  = var.templates_bucket_versioning
  labels      = var.templates_bucket_labels

  runtime_service_accounts = {
    runtime = module.iam.runtime_service_account_email
  }
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
  labels                = var.runtime_labels
  annotations           = var.runtime_annotations
  cloud_sql_instances   = [module.sql.instance_connection_name]
  env = merge(
    var.runtime_env,
    {
      GCS_TEMPLATES_BUCKET = module.storage.bucket_name
    }
  )

  secret_env = merge(
    {
      for env_var, secret_key in var.runtime_secret_bindings :
      env_var => {
        secret  = module.secrets.secret_ids[secret_key]
        version = "latest"
      }
      if contains(keys(module.secrets.secret_ids), secret_key)
    },
    {
      DATABASE_URL = {
        secret  = module.sql.connection_secret_name
        version = "latest"
      }
    }
  )
}
