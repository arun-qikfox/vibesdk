resource "google_compute_network" "vpc" {
  name                    = "vibesdk-vpc"
  auto_create_subnetworks = false
  project                 = var.project_id
}

resource "google_compute_subnetwork" "private" {
  name          = "vibesdk-private-subnet"
  ip_cidr_range = var.private_subnet_cidr
  region        = var.region
  network       = google_compute_network.vpc.id
  project       = var.project_id

  private_ip_google_access = true
}

resource "google_compute_subnetwork" "public" {
  name          = "vibesdk-public-subnet"
  ip_cidr_range = var.public_subnet_cidr
  region        = var.region
  network       = google_compute_network.vpc.id
  project       = var.project_id
}

resource "google_vpc_access_connector" "serverless" {
  name   = "vibesdk-svless-conn"
  region = var.region
  project = var.project_id

  network = google_compute_network.vpc.name

  ip_cidr_range         = "10.20.10.0/28"
  min_throughput        = 200
  max_throughput        = 300
  machine_type          = "f1-micro"
}
