output "bucket_name" {
  description = "Name of the created storage bucket."
  value       = google_storage_bucket.templates.name
}

output "bucket_self_link" {
  description = "Self link of the storage bucket."
  value       = google_storage_bucket.templates.self_link
}

output "bucket_url" {
  description = "Public URL to access the storage bucket."
  value       = "gs://${google_storage_bucket.templates.name}"
}

output "deployment_contexts_bucket_name" {
  description = "Name of the deployment contexts storage bucket."
  value       = google_storage_bucket.deployment_contexts.name
}

output "deployment_contexts_bucket_url" {
  description = "Public URL to access the deployment contexts storage bucket."
  value       = "gs://${google_storage_bucket.deployment_contexts.name}"
}
