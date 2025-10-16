output "vpc_id" {
  description = "ID of the VibSDK VPC."
  value       = google_compute_network.vpc.id
}

output "private_subnet" {
  description = "Name of the private subnet."
  value       = google_compute_subnetwork.private.name
}

output "public_subnet" {
  description = "Name of the public subnet."
  value       = google_compute_subnetwork.public.name
}

output "serverless_connector" {
  description = "Name of the Serverless VPC Access connector."
  value       = google_vpc_access_connector.serverless.name
}

