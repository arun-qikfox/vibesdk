output "runtime_service_account_email" {
  description = "Email of the runtime service account."
  value       = google_service_account.runtime.email
}

output "ci_service_account_email" {
  description = "Email of the CI service account."
  value       = google_service_account.ci.email
}

output "dev_service_account_email" {
  description = "Email of the developer service account."
  value       = google_service_account.dev.email
}

