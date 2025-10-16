output "secret_ids" {
  description = "Secret Manager secret resource names."
  value = {
    for id, secret in google_secret_manager_secret.secrets :
    id => secret.name
  }
}
