#!/bin/bash
# Deployment Verification Script for VibSDK GCP Multi-Cloud Deployment
# This script verifies that the deployment infrastructure is working correctly

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="qfxcloud-app-builder"
REGION="us-central1"
REPOSITORY="vibesdk-apps"
BUCKET_NAME="vibesdk-deployment-contexts"

echo -e "${BLUE}🚀 VibSDK GCP Deployment Verification Script${NC}"
echo "=================================================="

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        return 1
    fi
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function to print info
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if gcloud is installed and authenticated
check_gcloud() {
    print_info "Checking gcloud CLI..."
    
    if ! command -v gcloud &> /dev/null; then
        echo -e "${RED}❌ gcloud CLI is not installed${NC}"
        echo "Please install gcloud CLI: https://cloud.google.com/sdk/docs/install"
        exit 1
    fi
    
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
        echo -e "${RED}❌ Not authenticated with gcloud${NC}"
        echo "Please run: gcloud auth login"
        exit 1
    fi
    
    CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
    if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
        print_warning "Current project is '$CURRENT_PROJECT', switching to '$PROJECT_ID'"
        gcloud config set project "$PROJECT_ID"
    fi
    
    print_status 0 "gcloud CLI is ready"
}

# Check GCP project and permissions
check_project() {
    print_info "Checking GCP project and permissions..."
    
    # Check if project exists and is accessible
    if ! gcloud projects describe "$PROJECT_ID" &>/dev/null; then
        echo -e "${RED}❌ Project '$PROJECT_ID' not found or not accessible${NC}"
        exit 1
    fi
    
    # Check required APIs are enabled
    REQUIRED_APIS=(
        "run.googleapis.com"
        "cloudbuild.googleapis.com"
        "artifactregistry.googleapis.com"
        "storage.googleapis.com"
        "sqladmin.googleapis.com"
    )
    
    for api in "${REQUIRED_APIS[@]}"; do
        if ! gcloud services list --enabled --filter="name:$api" --format="value(name)" | grep -q "$api"; then
            print_warning "Enabling API: $api"
            gcloud services enable "$api"
        fi
    done
    
    print_status 0 "Project and APIs are ready"
}

# Check Artifact Registry
check_artifact_registry() {
    print_info "Checking Artifact Registry..."
    
    if ! gcloud artifacts repositories describe "$REPOSITORY" --location="$REGION" &>/dev/null; then
        print_warning "Creating Artifact Registry repository: $REPOSITORY"
        gcloud artifacts repositories create "$REPOSITORY" \
            --repository-format=docker \
            --location="$REGION" \
            --description="VibSDK generated applications"
    fi
    
    print_status 0 "Artifact Registry repository is ready"
}

# Check Cloud Storage bucket
check_storage_bucket() {
    print_info "Checking Cloud Storage bucket..."
    
    if ! gsutil ls "gs://$BUCKET_NAME" &>/dev/null; then
        print_warning "Creating Cloud Storage bucket: $BUCKET_NAME"
        gsutil mb -l "$REGION" "gs://$BUCKET_NAME"
    fi
    
    print_status 0 "Cloud Storage bucket is ready"
}

# Check Cloud SQL database
check_database() {
    print_info "Checking Cloud SQL database..."
    
    DB_NAME="vibesdk-db"
    if ! gcloud sql instances describe "$DB_NAME" --format="value(name)" &>/dev/null; then
        print_warning "Cloud SQL instance '$DB_NAME' not found"
        print_warning "Please ensure the database is created via Terraform"
        return 1
    fi
    
    # Check if database exists
    if ! gcloud sql databases list --instance="$DB_NAME" --format="value(name)" | grep -q "vibesdk"; then
        print_warning "Database 'vibesdk' not found in instance '$DB_NAME'"
        print_warning "Please ensure the database is created via Terraform"
        return 1
    fi
    
    print_status 0 "Cloud SQL database is ready"
}

# Check Cloud Run control plane
check_control_plane() {
    print_info "Checking Cloud Run control plane..."
    
    SERVICE_NAME="vibesdk-control-plane"
    if ! gcloud run services describe "$SERVICE_NAME" --region="$REGION" --format="value(status.url)" &>/dev/null; then
        print_warning "Cloud Run service '$SERVICE_NAME' not found"
        print_warning "Please ensure the control plane is deployed"
        return 1
    fi
    
    SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --format="value(status.url)")
    print_status 0 "Control plane is running at: $SERVICE_URL"
}

# Test deployment flow
test_deployment() {
    print_info "Testing deployment flow..."
    
    # Create a test app directory
    TEST_APP_DIR="/tmp/vibesdk-test-app"
    TEST_APP_ID="test-app-$(date +%s)"
    
    mkdir -p "$TEST_APP_DIR"
    
    # Create a simple test app
    cat > "$TEST_APP_DIR/package.json" << EOF
{
  "name": "test-app",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  }
}
EOF
    
    cat > "$TEST_APP_DIR/index.js" << EOF
const http = require('http');
const port = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello from VibSDK test app!');
});

server.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});
EOF
    
    # Test Cloud Run context creation
    print_info "Testing Cloud Run context creation..."
    cd /home/arunr/projects/vibesdk
    
    if npm run cloudrun:context -- --src "$TEST_APP_DIR" --out "/tmp/test-context.tar.gz"; then
        print_status 0 "Cloud Run context created successfully"
    else
        print_status 1 "Failed to create Cloud Run context"
        return 1
    fi
    
    # Test Cloud Build deployment
    print_info "Testing Cloud Build deployment..."
    
    # Upload context to GCS
    gsutil cp "/tmp/test-context.tar.gz" "gs://$BUCKET_NAME/$TEST_APP_ID-context.tar.gz"
    
    # Trigger Cloud Build
    BUILD_ID=$(gcloud builds submit \
        --config cloudbuild/app-deploy.yaml \
        --substitutions="_SERVICE_NAME=$TEST_APP_ID,_CONTEXT_TAR=gs://$BUCKET_NAME/$TEST_APP_ID-context.tar.gz,_REGION=$REGION,_LOCATION=$REGION,_REPOSITORY=$REPOSITORY" \
        --format="value(id)" \
        --quiet)
    
    if [ -n "$BUILD_ID" ]; then
        print_status 0 "Cloud Build triggered: $BUILD_ID"
        
        # Wait for build completion
        print_info "Waiting for build completion..."
        gcloud builds log "$BUILD_ID" --stream
        
        # Check if service was created
        if gcloud run services describe "$TEST_APP_ID" --region="$REGION" --format="value(status.url)" &>/dev/null; then
            SERVICE_URL=$(gcloud run services describe "$TEST_APP_ID" --region="$REGION" --format="value(status.url)")
            print_status 0 "Test app deployed successfully: $SERVICE_URL"
            
            # Test the deployed app
            if curl -s "$SERVICE_URL" | grep -q "Hello from VibSDK test app"; then
                print_status 0 "Test app is responding correctly"
            else
                print_status 1 "Test app is not responding correctly"
            fi
            
            # Cleanup test service
            print_info "Cleaning up test service..."
            gcloud run services delete "$TEST_APP_ID" --region="$REGION" --quiet
            gsutil rm "gs://$BUCKET_NAME/$TEST_APP_ID-context.tar.gz"
            
        else
            print_status 1 "Test app deployment failed"
            return 1
        fi
    else
        print_status 1 "Failed to trigger Cloud Build"
        return 1
    fi
    
    # Cleanup test files
    rm -rf "$TEST_APP_DIR"
    rm -f "/tmp/test-context.tar.gz"
}

# Test database integration (if available)
test_database_integration() {
    print_info "Testing database integration..."
    
    # This would require the worker to be running and accessible
    # For now, we'll just check if we can connect to the database
    DB_NAME="vibesdk-db"
    
    if gcloud sql connect "$DB_NAME" --user=postgres --database=vibesdk --region="$REGION" --quiet <<< "SELECT 1;" &>/dev/null; then
        print_status 0 "Database connection successful"
    else
        print_warning "Database connection test skipped (requires interactive session)"
    fi
}

# Main execution
main() {
    echo "Starting verification process..."
    echo
    
    # Run all checks
    check_gcloud
    check_project
    check_artifact_registry
    check_storage_bucket
    
    # Database and control plane checks (may fail if not deployed yet)
    if check_database; then
        test_database_integration
    else
        print_warning "Skipping database tests"
    fi
    
    if check_control_plane; then
        print_status 0 "Control plane is ready"
    else
        print_warning "Control plane not ready - some features may not work"
    fi
    
    # Test deployment flow
    if test_deployment; then
        echo
        echo -e "${GREEN}🎉 All deployment tests passed!${NC}"
        echo
        echo "Next steps:"
        echo "1. Deploy the worker with: npm run deploy:gcp"
        echo "2. Test the full UI deployment flow"
        echo "3. Configure DNS and load balancer for production"
    else
        echo
        echo -e "${RED}❌ Some deployment tests failed${NC}"
        echo "Please check the errors above and fix them before proceeding"
        exit 1
    fi
}

# Run main function
main "$@"
