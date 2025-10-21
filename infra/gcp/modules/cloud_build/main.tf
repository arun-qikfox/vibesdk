locals {
  create_trigger = var.create_workerd_trigger && var.github_owner != "" && var.github_repo != ""
}

# Grant Cloud Build service account permissions for Cloud Run deployment
resource "google_project_iam_member" "cloudbuild_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${var.ci_service_account_email}"
}

# Grant Cloud Build permissions to manage Artifact Registry
resource "google_project_iam_member" "cloudbuild_artifactregistry_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${var.ci_service_account_email}"
}

# Grant Cloud Build permissions to access GCS buckets
resource "google_project_iam_member" "cloudbuild_storage_admin" {
  project = var.project_id
  role    = "roles/storage.admin"
  member  = "serviceAccount:${var.ci_service_account_email}"
}

# Optional placeholder trigger for building/publishing the workerd-based runtime image.
resource "google_cloudbuild_trigger" "workerd" {
  count   = local.create_trigger ? 1 : 0
  project = var.project_id
  name    = "vibesdk-workerd"

  filename = "cloudbuild/workerd.yaml"

  github {
    owner = var.github_owner
    name  = var.github_repo

    push {
      branch = var.github_branch
    }
  }

  description = "Builds and publishes VibSDK workerd runtime image"
}
