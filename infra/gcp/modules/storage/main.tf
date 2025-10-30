resource "google_storage_bucket" "templates" {
  name                        = var.bucket_name
  project                     = var.project_id
  location                    = var.location
  uniform_bucket_level_access = true
  force_destroy               = var.force_destroy

  versioning {
    enabled = var.versioning
  }

  dynamic "lifecycle_rule" {
    for_each = var.lifecycle_rules
    content {
      action {
        type          = lifecycle_rule.value.action.type
        storage_class = try(lifecycle_rule.value.action.storage_class, null)
      }
      condition {
        age                   = try(lifecycle_rule.value.condition.age, null)
        with_state            = try(lifecycle_rule.value.condition.with_state, null)
        matches_prefix        = try(lifecycle_rule.value.condition.matches_prefix, null)
        matches_suffix        = try(lifecycle_rule.value.condition.matches_suffix, null)
        num_newer_versions    = try(lifecycle_rule.value.condition.num_newer_versions, null)
        matches_storage_class = try(lifecycle_rule.value.condition.matches_storage_class, null)
      }
    }
  }

  labels = var.labels
}

resource "google_storage_bucket_iam_member" "runtime_access" {
  for_each = var.runtime_service_accounts

  bucket = google_storage_bucket.templates.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${each.value}"
}

resource "google_storage_bucket" "deployment_contexts" {
  count                       = var.context_bucket_name != "" ? 1 : 0
  name                        = var.context_bucket_name
  project                     = var.project_id
  location                    = var.context_bucket_location != "" ? var.context_bucket_location : var.location
  uniform_bucket_level_access = true
  force_destroy               = var.context_bucket_force_destroy
  labels                      = var.context_bucket_labels

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      age = var.context_bucket_lifecycle_age_days
    }
  }
}
