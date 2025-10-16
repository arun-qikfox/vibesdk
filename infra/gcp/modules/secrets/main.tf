resource "google_secret_manager_secret" "secrets" {
  for_each = var.secrets

  project   = var.project_id
  secret_id = each.key

  replication {
    automatic {}
  }
}

resource "google_secret_manager_secret_version" "secrets" {
  for_each = var.secrets

  secret      = google_secret_manager_secret.secrets[each.key].name
  secret_data = each.value
}
