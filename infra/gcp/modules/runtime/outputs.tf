output "service_id" {
  description = "ID of the Cloud Run service."
  value       = google_cloud_run_v2_service.this.id
}

output "service_name" {
  description = "Name of the Cloud Run service."
  value       = google_cloud_run_v2_service.this.name
}

output "service_uri" {
  description = "URI of the deployed Cloud Run service."
  value       = google_cloud_run_v2_service.this.uri
}

output "latest_revision" {
  description = "Latest ready revision of the Cloud Run service."
  value       = google_cloud_run_v2_service.this.latest_ready_revision
}
