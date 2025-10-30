# Root module for the VibSDK Google Cloud landing zone.
# This file wires together child modules (networking, IAM, registry, etc.).

locals {
  project_id = var.project_id
  region     = var.region
}

resource "google_project_service" "compute" {
  project            = local.project_id
  service            = "compute.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "storage" {
  project            = local.project_id
  service            = "storage.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "pubsub" {
  project            = local.project_id
  service            = "pubsub.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "dns" {
  project            = local.project_id
  service            = "dns.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "certificate_manager" {
  project            = local.project_id
  service            = "certificatemanager.googleapis.com"
  disable_on_destroy = false
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
  source                            = "./modules/storage"
  project_id                        = local.project_id
  location                          = var.templates_bucket_location
  bucket_name                       = var.templates_bucket_name
  versioning                        = var.templates_bucket_versioning
  labels                            = var.templates_bucket_labels
  context_bucket_name               = var.deployment_context_bucket_name
  context_bucket_location           = var.deployment_context_bucket_location
  context_bucket_force_destroy      = var.deployment_context_bucket_force_destroy
  context_bucket_labels             = var.deployment_context_bucket_labels
  context_bucket_lifecycle_age_days = var.deployment_context_bucket_lifecycle_age_days

  runtime_service_accounts = {
    runtime = module.iam.runtime_service_account_email
  }
}

module "sandbox" {
  source              = "./modules/sandbox"
  project_id          = local.project_id
  region              = local.region
  pubsub_topic        = var.sandbox_pubsub_topic
  job_name            = var.sandbox_job_name
  job_image           = var.sandbox_job_image
  job_env             = var.sandbox_job_env
  job_resource_limits = var.sandbox_job_resource_limits
  job_service_account = var.sandbox_job_service_account
  job_max_retries     = var.sandbox_job_max_retries
  job_timeout         = var.sandbox_job_timeout
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

module "preview_ingress" {
  count             = var.enable_preview_ingress ? 1 : 0
  source            = "./modules/preview_ingress"
  project_id        = local.project_id
  region            = local.region
  cloud_run_service = module.runtime.service_name
  preview_domain    = var.preview_domain
  dns_zone_name     = var.preview_dns_zone_name
  depends_on = [
    google_project_service.dns,
    google_project_service.certificate_manager
  ]
}
