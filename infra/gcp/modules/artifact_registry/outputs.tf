output "repositories" {
  description = "Map of repository IDs to full resource names."
  value = {
    for k, repo in google_artifact_registry_repository.repo :
    k => repo.name
  }
}

