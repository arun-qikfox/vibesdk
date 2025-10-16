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

