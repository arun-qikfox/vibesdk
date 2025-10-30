locals {
  preview_domain    = lower(trimspace(var.preview_domain))
  wildcard_domain   = "*.${local.preview_domain}"
  zone_dns_name     = "${local.preview_domain}."
  resource_prefix   = substr(replace(replace(var.dns_zone_name, ".", "-"), "_", "-"), 0, 52)
  lb_address_name   = "${local.resource_prefix}-lb-ip"
  neg_name          = "${local.resource_prefix}-neg"
  backend_name      = "${local.resource_prefix}-backend"
  url_map_name      = "${local.resource_prefix}-url-map"
  redirect_map_name = "${local.resource_prefix}-redirect-map"
  https_proxy_name  = "${local.resource_prefix}-https-proxy"
  http_proxy_name   = "${local.resource_prefix}-http-proxy"
  https_rule_name   = "${local.resource_prefix}-https-fr"
  http_rule_name    = "${local.resource_prefix}-http-fr"
  certificate_name  = "${local.resource_prefix}-cert"
  dns_auth_name     = "${local.resource_prefix}-dns-auth"
  certificate_domains = distinct([
    local.preview_domain,
    local.wildcard_domain,
  ])
}

resource "google_dns_managed_zone" "preview" {
  project     = var.project_id
  name        = var.dns_zone_name
  dns_name    = local.zone_dns_name
  description = "Managed zone for VibSDK preview application domains."
}

resource "google_compute_global_address" "preview_ipv4" {
  project = var.project_id
  name    = local.lb_address_name
}

resource "google_certificate_manager_certificate" "preview" {
  project  = var.project_id
  location = "global"
  name     = local.certificate_name

  managed {
    domains = local.certificate_domains
    dns_authorizations = [
      google_certificate_manager_dns_authorization.preview.id,
    ]
  }

  depends_on = [
    google_dns_record_set.preview_dns_authorization
  ]
}

resource "google_certificate_manager_dns_authorization" "preview" {
  project  = var.project_id
  location = "global"
  name     = local.dns_auth_name
  domain   = local.preview_domain
}

resource "google_compute_region_network_endpoint_group" "preview" {
  project               = var.project_id
  region                = var.region
  name                  = local.neg_name
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = var.cloud_run_service
  }
}

resource "google_compute_backend_service" "preview" {
  project               = var.project_id
  name                  = local.backend_name
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTP"
  timeout_sec           = 30

  backend {
    group = google_compute_region_network_endpoint_group.preview.id
  }
}

resource "google_compute_url_map" "preview" {
  project         = var.project_id
  name            = local.url_map_name
  default_service = google_compute_backend_service.preview.id
}

resource "google_compute_target_https_proxy" "preview" {
  project = var.project_id
  name    = local.https_proxy_name
  url_map = google_compute_url_map.preview.id
  certificate_manager_certificates = [
    google_certificate_manager_certificate.preview.id,
  ]
}

resource "google_compute_global_forwarding_rule" "preview_https" {
  project               = var.project_id
  name                  = local.https_rule_name
  load_balancing_scheme = "EXTERNAL_MANAGED"
  target                = google_compute_target_https_proxy.preview.id
  port_range            = "443"
  ip_address            = google_compute_global_address.preview_ipv4.address
}

resource "google_compute_url_map" "redirect" {
  project = var.project_id
  name    = local.redirect_map_name

  default_url_redirect {
    https_redirect = true
    strip_query    = false
  }
}

resource "google_compute_target_http_proxy" "redirect" {
  project = var.project_id
  name    = local.http_proxy_name
  url_map = google_compute_url_map.redirect.id
}

resource "google_compute_global_forwarding_rule" "preview_http" {
  project               = var.project_id
  name                  = local.http_rule_name
  load_balancing_scheme = "EXTERNAL_MANAGED"
  target                = google_compute_target_http_proxy.redirect.id
  port_range            = "80"
  ip_address            = google_compute_global_address.preview_ipv4.address
}

resource "google_dns_record_set" "preview_apex_a" {
  project      = var.project_id
  managed_zone = google_dns_managed_zone.preview.name
  name         = local.zone_dns_name
  type         = "A"
  ttl          = 300
  rrdatas      = [google_compute_global_address.preview_ipv4.address]

  depends_on = [
    google_compute_global_forwarding_rule.preview_https,
  ]
}

resource "google_dns_record_set" "preview_wildcard_a" {
  project      = var.project_id
  managed_zone = google_dns_managed_zone.preview.name
  name         = "${local.wildcard_domain}."
  type         = "A"
  ttl          = 300
  rrdatas      = [google_compute_global_address.preview_ipv4.address]

  depends_on = [
    google_compute_global_forwarding_rule.preview_https,
  ]
}

resource "google_dns_record_set" "preview_dns_authorization" {
  project      = var.project_id
  managed_zone = google_dns_managed_zone.preview.name
  name         = google_certificate_manager_dns_authorization.preview.dns_resource_record[0].name
  type         = google_certificate_manager_dns_authorization.preview.dns_resource_record[0].type
  ttl          = 300
  rrdatas = [
    google_certificate_manager_dns_authorization.preview.dns_resource_record[0].data,
  ]
}
