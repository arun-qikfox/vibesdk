output "instance_connection_name" {
  description = "Instance connection name (PROJECT:REGION:INSTANCE) used by Cloud Run."
  value       = google_sql_database_instance.primary.connection_name
}

output "private_ip_address" {
  description = "Private IP address assigned to the Cloud SQL instance."
  value       = google_sql_database_instance.primary.private_ip_address
}

output "database_name" {
  description = "Primary database created for the application."
  value       = google_sql_database.primary.name
}

output "database_user" {
  description = "Database user created for application connections."
  value       = google_sql_user.app.name
}

output "password_secret_name" {
  description = "Secret Manager resource name containing the generated database password."
  value       = google_secret_manager_secret.db_password.name
}

output "connection_secret_name" {
  description = "Secret Manager resource name containing the Cloud SQL connection URI."
  value       = google_secret_manager_secret.db_connection_url.name
}
