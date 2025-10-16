output "workerd_trigger_id" {
  description = "ID of the Cloud Build trigger for workerd (null if disabled)."
  value       = length(google_cloudbuild_trigger.workerd) > 0 ? google_cloudbuild_trigger.workerd[0].id : null
}
