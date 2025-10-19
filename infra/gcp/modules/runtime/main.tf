locals {
  plain_env = [
    for key, value in var.env : {
      name  = key
      value = value
    }
  ]

  secret_env = [
    for key, cfg in var.secret_env : {
      name    = key
      secret  = cfg.secret
      version = lookup(cfg, "version", "latest")
    }
  ]

  vpc_connector_resource = (
    var.vpc_connector != "" && !strcontains(var.vpc_connector, "/")
    ? "projects/${var.project_id}/locations/${var.region}/connectors/${var.vpc_connector}"
    : var.vpc_connector
  )
}

resource "google_cloud_run_v2_service" "this" {
  name     = var.service_name
  project  = var.project_id
  location = var.region
  ingress  = var.ingress

  labels = var.labels

  template {
    service_account = var.service_account_email
    labels          = var.labels
    annotations     = var.annotations

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    containers {
      image = var.image

      dynamic "env" {
        for_each = local.plain_env
        content {
          name  = env.value.name
          value = env.value.value
        }
      }

      dynamic "env" {
        for_each = local.secret_env
        content {
          name = env.value.name
          value_source {
            secret_key_ref {
              secret  = env.value.secret
              version = env.value.version
            }
          }
        }
      }

      dynamic "volume_mounts" {
        for_each = length(var.cloud_sql_instances) > 0 ? [1] : []
        content {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }
      }
    }

    dynamic "vpc_access" {
      for_each = local.vpc_connector_resource != "" ? [local.vpc_connector_resource] : []
      content {
        connector = vpc_access.value
        egress    = var.vpc_egress
      }
    }

    dynamic "volumes" {
      for_each = length(var.cloud_sql_instances) > 0 ? [1] : []
      content {
        name = "cloudsql"
        cloud_sql_instance {
          instances = var.cloud_sql_instances
        }
      }
    }
  }

  traffic {
    percent  = 100
    type     = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    revision = null
    tag      = null
  }

  lifecycle {
    ignore_changes = [
      labels,
      annotations,
    ]
  }
}
