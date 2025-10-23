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
  source                = "./modules/sql"
  project_id            = local.project_id
  region                = local.region
  instance_name         = var.sql_instance_name
  database_name         = var.sql_database_name
  user_name             = var.sql_user_name
  password_secret_id    = var.sql_password_secret_id
  connection_secret_id  = var.sql_connection_secret_id
  private_network       = module.networking.vpc_id
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

  ci_service_account_email = module.iam.ci_service_account_email
}

module "sandbox" {
  source                 = "./modules/sandbox"
  project_id             = local.project_id
  region                 = local.region
  pubsub_topic           = var.sandbox_pubsub_topic
  job_name               = var.sandbox_job_name
  job_image              = var.sandbox_job_image
  job_env                = var.sandbox_job_env
  job_resource_limits    = var.sandbox_job_resource_limits
  job_service_account    = var.sandbox_job_service_account
  job_max_retries        = var.sandbox_job_max_retries
  job_timeout            = var.sandbox_job_timeout
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

# --- Add: resolve project number and Cloud Build SA email
data "google_project" "this" {
  project_id = local.project_id
}

locals {
  cloudbuild_sa = "${data.google_project.this.number}@cloudbuild.gserviceaccount.com"
}

# --- Add: required service APIs
resource "google_project_service" "run" {
  project = local.project_id
  service = "run.googleapis.com"
}

resource "google_project_service" "cloudbuild" {
  project = local.project_id
  service = "cloudbuild.googleapis.com"
}

resource "google_project_service" "artifactregistry" {
  project = local.project_id
  service = "artifactregistry.googleapis.com"
}

resource "google_project_service" "sqladmin" {
  project = local.project_id
  service = "sqladmin.googleapis.com"
}

resource "google_project_service" "secretmanager" {
  project = local.project_id
  service = "secretmanager.googleapis.com"
}

resource "google_project_service" "servicenetworking" {
  project = local.project_id
  service = "servicenetworking.googleapis.com"
}

resource "google_project_service" "compute" {
  project = local.project_id
  service = "compute.googleapis.com"
}

resource "google_project_service" "vpcaccess" {
  project = local.project_id
  service = "vpcaccess.googleapis.com"
}

resource "google_project_service" "pubsub" {
  project = local.project_id
  service = "pubsub.googleapis.com"
}

resource "google_project_service" "storage" {
  project = local.project_id
  service = "storage.googleapis.com"
}

resource "google_project_service" "iam" {
  project = local.project_id
  service = "iam.googleapis.com"
}

# --- Add: Cloud Build can manage Cloud Run services
resource "google_project_iam_member" "cb_run_developer" {
  project = local.project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${local.cloudbuild_sa}"

  depends_on = [
    google_project_service.run,
    google_project_service.cloudbuild,
    google_project_service.sqladmin,
    google_project_service.secretmanager,
    google_project_service.servicenetworking,
    google_project_service.compute,
    google_project_service.vpcaccess,
    google_project_service.pubsub,
    google_project_service.storage,
    google_project_service.iam
  ]
}

# --- Add: Cloud Build may deploy a service that runs as your runtime SA
resource "google_service_account_iam_member" "cb_act_as_runtime_sa" {
  service_account_id = "projects/${local.project_id}/serviceAccounts/${module.iam.runtime_service_account_email}"
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${local.cloudbuild_sa}"
}

# --- Add: Cloud Build SA can PUSH to each repo you define via var.artifact_registry_repositories
resource "google_artifact_registry_repository_iam_member" "cb_repo_writer" {
  for_each   = toset(var.artifact_registry_repositories)
  project    = local.project_id
  location   = local.region
  repository = each.key
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${local.cloudbuild_sa}"

  depends_on = [google_project_service.artifactregistry]
}

# --- Add: runtime SA can PULL from those repos
resource "google_artifact_registry_repository_iam_member" "runtime_repo_reader" {
  for_each   = toset(var.artifact_registry_repositories)
  project    = local.project_id
  location   = local.region
  repository = each.key
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${module.iam.runtime_service_account_email}"

  depends_on = [google_project_service.artifactregistry]
}

# --- Add: avoid 403 on Cloud Build's source bucket gs://<project>_cloudbuild
resource "google_storage_bucket_iam_member" "cb_source_viewer" {
  bucket = "${local.project_id}_cloudbuild"
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${local.cloudbuild_sa}"
}

resource "google_storage_bucket_iam_member" "cb_source_creator" {
  bucket = "${local.project_id}_cloudbuild"
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${local.cloudbuild_sa}"
}

# --- Note: Public access is restricted by organization policy
# To enable public access, you may need to:
# 1. Contact your organization administrator to modify the policy
# 2. Or use authenticated access with service account
# 3. Or deploy to a different project without organization policies
