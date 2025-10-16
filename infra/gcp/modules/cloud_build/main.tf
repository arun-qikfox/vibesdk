locals {
  create_trigger = var.create_workerd_trigger && var.github_owner != "" && var.github_repo != ""
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
