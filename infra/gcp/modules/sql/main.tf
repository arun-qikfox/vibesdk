resource "random_password" "db_user" {
  length  = 32
  special = true
}

locals {
  connection_url = "postgres://${var.user_name}:${urlencode(random_password.db_user.result)}@//cloudsql/${google_sql_database_instance.primary.connection_name}/${var.database_name}"
}

# Reserve a range for private service access (Cloud SQL private IPs).
resource "google_compute_global_address" "private_service_connect" {
  name          = "${var.instance_name}-psc"
  project       = var.project_id
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 24
  network       = var.private_network
}

# Establish the private services VPC connection required by Cloud SQL.
resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = var.private_network
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_service_connect.name]
}

resource "google_sql_database_instance" "primary" {
  name             = var.instance_name
  project          = var.project_id
  region           = var.region
  database_version = "POSTGRES_15"

  settings {
    tier              = var.tier
    availability_type = var.availability_type
    disk_size         = var.disk_size_gb
    disk_autoresize   = true

    backup_configuration {
      enabled = true
    }

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = var.private_network
      enable_private_path_for_google_cloud_services = true
    }
  }

  deletion_protection = true

  depends_on = [google_service_networking_connection.private_vpc_connection]
}

resource "google_sql_database" "primary" {
  name     = var.database_name
  project  = var.project_id
  instance = google_sql_database_instance.primary.name
}

resource "google_secret_manager_secret" "db_password" {
  project   = var.project_id
  secret_id = var.password_secret_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_user.result
}

resource "google_secret_manager_secret" "db_connection_url" {
  project   = var.project_id
  secret_id = var.connection_secret_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "db_connection_url" {
  secret      = google_secret_manager_secret.db_connection_url.id
  secret_data = local.connection_url
}

resource "google_sql_user" "app" {
  name     = var.user_name
  project  = var.project_id
  instance = google_sql_database_instance.primary.name
  password = random_password.db_user.result
}
