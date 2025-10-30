output "domain" {
  description = "Primary preview domain served through the HTTPS load balancer."
  value       = local.preview_domain
}

output "managed_zone" {
  description = "Cloud DNS managed zone hosting preview records."
  value       = google_dns_managed_zone.preview.name
}

output "name_servers" {
  description = "Name servers to delegate the preview domain to this Cloud DNS zone."
  value       = google_dns_managed_zone.preview.name_servers
}

output "load_balancer_ip" {
  description = "IPv4 address assigned to the preview HTTPS load balancer."
  value       = google_compute_global_address.preview_ipv4.address
}
