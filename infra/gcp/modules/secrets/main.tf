resource "google_secret_manager_secret" "secrets" {
  for_each = var.secrets

  project   = var.project_id
  secret_id = each.key

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "secrets" {
  for_each = var.secrets

  # Use the full resource name of the secret:
  secret      = google_secret_manager_secret.secrets[each.key].id
  secret_data = each.value
}
