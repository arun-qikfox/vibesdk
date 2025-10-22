#!/bin/bash
TOKEN=$(gcloud auth print-access-token)
curl -s -H "Authorization: Bearer $TOKEN" https://vibesdk-control-plane-2886014379.us-central1.run.app/
