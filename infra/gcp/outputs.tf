# Consolidated outputs from the landing zone.
# These values are referenced by deployment scripts and later Terraform stages.

output "project_id" {
  description = "Google Cloud project ID used by the landing zone."
  value       = var.project_id
}

output "region" {
  description = "Primary Google Cloud region for the deployment."
  value       = var.region
}

output "service_accounts" {
  description = "Resolved service-account map (runtime, ci, dev)."
  value       = var.service_accounts
}

output "service_account_emails" {
  description = "Emails of the managed service accounts (runtime, ci, dev)."
  value = {
    runtime = module.iam.runtime_service_account_email
    ci      = module.iam.ci_service_account_email
    dev     = module.iam.dev_service_account_email
  }
}

output "networking" {
  description = "Networking artifacts (VPC ID, subnets, serverless connector)."
  value = {
    vpc_id               = module.networking.vpc_id
    private_subnet       = module.networking.private_subnet
    public_subnet        = module.networking.public_subnet
    serverless_connector = module.networking.serverless_connector
  }
}

output "sql" {
  description = "Cloud SQL resources (connection string components, secrets)."
  value = {
    instance_connection_name = module.sql.instance_connection_name
    private_ip_address       = module.sql.private_ip_address
    database_name            = module.sql.database_name
    database_user            = module.sql.database_user
    password_secret_name     = module.sql.password_secret_name
  }
}

output "artifact_registry_repositories" {
  description = "Artifact Registry repositories created for VibSDK."
  value       = module.artifact_registry.repositories
}

output "cloud_build_workerd_trigger_id" {
  description = "Cloud Build trigger ID for the workerd image (null if disabled)."
  value       = module.cloud_build.workerd_trigger_id
}
output "secret_manager_ids" {
  description = "Secret Manager resource names for seeded placeholders."
  value       = module.secrets.secret_ids
}

output "templates_bucket" {
  description = "Information about the templates storage bucket."
  value = {
    name      = module.storage.bucket_name
    self_link = module.storage.bucket_self_link
    url       = module.storage.bucket_url
  }
}

output "runtime_service" {
  description = "Details of the Cloud Run control plane service."
  value = {
    name            = module.runtime.service_name
    uri             = module.runtime.service_uri
    latest_revision = module.runtime.latest_revision
  }
}
