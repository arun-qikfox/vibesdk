resource "google_pubsub_topic" "sandbox_requests" {
  name    = var.pubsub_topic
  project = var.project_id
}

resource "google_pubsub_subscription" "sandbox_requests" {
  name  = "${var.pubsub_topic}-subscription"
  topic = google_pubsub_topic.sandbox_requests.name

  ack_deadline_seconds       = 60
  message_retention_duration = "86400s"
}

resource "google_cloud_run_v2_job" "sandbox_job" {
  name     = var.job_name
  location = var.region
  project  = var.project_id

  template {
    template {
      containers {
        image = var.job_image

        dynamic "env" {
          for_each = var.job_env
          content {
            name  = env.key
            value = env.value
          }
        }

        resources {
          limits = var.job_resource_limits
        }
      }

      service_account = var.job_service_account
      max_retries     = var.job_max_retries
      timeout         = var.job_timeout
    }
  }
}
