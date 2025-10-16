resource "google_artifact_registry_repository" "repo" {
  for_each = toset(var.repositories)

  project       = var.project_id
  location      = var.region
  repository_id = each.value
  format        = "DOCKER"
  description   = "VibSDK container images (${each.value})"
}

resource "google_artifact_registry_repository_iam_member" "ci_writer" {
  for_each = google_artifact_registry_repository.repo

  project    = var.project_id
  location   = var.region
  repository = each.value.repository_id
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${var.ci_service_account_email}"
}

