output "pubsub_topic" {
  value = google_pubsub_topic.sandbox_requests.name
}

output "pubsub_subscription" {
  value = google_pubsub_subscription.sandbox_requests.name
}

output "job_name" {
  value = google_cloud_run_v2_job.sandbox_job.name
}
