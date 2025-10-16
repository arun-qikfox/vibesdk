locals {
  required_roles = {
    runtime = [
      "roles/run.invoker",
      "roles/secretmanager.secretAccessor",
      "roles/cloudsql.client",
      "roles/pubsub.publisher",
      "roles/storage.objectAdmin",
    ]
    ci = [
      "roles/run.invoker",
      "roles/secretmanager.secretAccessor",
      "roles/cloudsql.client",
      "roles/pubsub.publisher",
      "roles/storage.objectAdmin",
      "roles/artifactregistry.writer",
      "roles/cloudbuild.builds.editor",
    ]
    dev = [
      "roles/run.invoker",
      "roles/secretmanager.secretAccessor",
      "roles/cloudsql.client",
    ]
  }
}

resource "google_service_account" "runtime" {
  account_id   = var.service_accounts.runtime
  display_name = "VibSDK Runtime Service Account"
  project      = var.project_id
}

resource "google_service_account" "ci" {
  account_id   = var.service_accounts.ci
  display_name = "VibSDK CI Service Account"
  project      = var.project_id
}

resource "google_service_account" "dev" {
  account_id   = var.service_accounts.dev
  display_name = "VibSDK Developer Service Account"
  project      = var.project_id
}

resource "google_project_iam_member" "runtime_roles" {
  for_each = toset(local.required_roles.runtime)

  project = var.project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_project_iam_member" "ci_roles" {
  for_each = toset(local.required_roles.ci)

  project = var.project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.ci.email}"
}

resource "google_project_iam_member" "dev_roles" {
  for_each = toset(local.required_roles.dev)

  project = var.project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.dev.email}"
}

