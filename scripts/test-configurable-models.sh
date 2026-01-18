#!/bin/bash

# Integration test script for Configurable Models feature
# This script tests the API endpoints manually against a running server

BASE_URL="${TEST_BASE_URL:-http://localhost:3002}"
PASS=0
FAIL=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_pass() {
  echo -e "${GREEN}[PASS]${NC} $1"
  ((PASS++))
}

log_fail() {
  echo -e "${RED}[FAIL]${NC} $1"
  ((FAIL++))
}

log_info() {
  echo -e "${YELLOW}[INFO]${NC} $1"
}

# Check if server is running
check_server() {
  log_info "Checking if server is running at $BASE_URL..."
  if curl -s "$BASE_URL/api/settings/providers" > /dev/null 2>&1; then
    log_pass "Server is running"
    return 0
  else
    log_fail "Server is not running at $BASE_URL"
    echo "Please start the server with 'npm run dev' and try again."
    exit 1
  fi
}

# Test: GET /api/settings/providers
test_get_providers() {
  log_info "Testing GET /api/settings/providers..."

  RESPONSE=$(curl -s "$BASE_URL/api/settings/providers")

  if echo "$RESPONSE" | grep -q '"openai"'; then
    log_pass "Providers endpoint returns data with OpenAI provider"
  else
    log_fail "Providers endpoint missing expected data"
    echo "Response: $RESPONSE"
  fi

  if echo "$RESPONSE" | grep -q '"models_count"'; then
    log_pass "Providers include models_count"
  else
    log_fail "Providers missing models_count"
  fi
}

# Test: POST /api/settings/providers
test_create_provider() {
  log_info "Testing POST /api/settings/providers..."

  SLUG="test-provider-$(date +%s)"
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/settings/providers" \
    -H "Content-Type: application/json" \
    -d "{\"provider\": {\"name\": \"Test Provider\", \"slug\": \"$SLUG\"}}")

  if echo "$RESPONSE" | grep -q '"id"'; then
    log_pass "Created new provider successfully"
    PROVIDER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "Created provider ID: $PROVIDER_ID"

    # Cleanup
    curl -s -X DELETE "$BASE_URL/api/settings/providers/$PROVIDER_ID" > /dev/null
  else
    log_fail "Failed to create provider"
    echo "Response: $RESPONSE"
  fi
}

# Test: Duplicate slug rejection
test_duplicate_slug() {
  log_info "Testing duplicate slug rejection..."

  SLUG="test-dup-$(date +%s)"

  # Create first provider
  RESPONSE1=$(curl -s -X POST "$BASE_URL/api/settings/providers" \
    -H "Content-Type: application/json" \
    -d "{\"provider\": {\"name\": \"First\", \"slug\": \"$SLUG\"}}")
  PROVIDER_ID=$(echo "$RESPONSE1" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

  # Try to create duplicate
  RESPONSE2=$(curl -s -X POST "$BASE_URL/api/settings/providers" \
    -H "Content-Type: application/json" \
    -d "{\"provider\": {\"name\": \"Second\", \"slug\": \"$SLUG\"}}")

  if echo "$RESPONSE2" | grep -q '"error"'; then
    log_pass "Duplicate slug correctly rejected"
  else
    log_fail "Duplicate slug was accepted"
    echo "Response: $RESPONSE2"
  fi

  # Cleanup
  curl -s -X DELETE "$BASE_URL/api/settings/providers/$PROVIDER_ID" > /dev/null
}

# Test: GET /api/settings/models
test_get_models() {
  log_info "Testing GET /api/settings/models..."

  RESPONSE=$(curl -s "$BASE_URL/api/settings/models")

  if echo "$RESPONSE" | grep -q '"gpt-4.1"'; then
    log_pass "Models endpoint returns seed data"
  else
    log_fail "Models endpoint missing expected seed data"
    echo "Response: $RESPONSE"
  fi
}

# Test: Filter models by endpoint_type
test_filter_models() {
  log_info "Testing models filtering by endpoint_type..."

  RESPONSE=$(curl -s "$BASE_URL/api/settings/models?endpoint_type=Chat")

  if echo "$RESPONSE" | grep -q '"endpoint_types"'; then
    log_pass "Models can be filtered by endpoint_type"
  else
    log_fail "Filtering by endpoint_type failed"
    echo "Response: $RESPONSE"
  fi
}

# Test: GET /api/models (public endpoint)
test_public_models() {
  log_info "Testing GET /api/models (public endpoint)..."

  # Without endpoint_type - should fail
  RESPONSE=$(curl -s "$BASE_URL/api/models")
  if echo "$RESPONSE" | grep -q '"error"'; then
    log_pass "Public endpoint requires endpoint_type parameter"
  else
    log_fail "Public endpoint should require endpoint_type"
  fi

  # With endpoint_type
  RESPONSE=$(curl -s "$BASE_URL/api/models?endpoint_type=Chat")
  if echo "$RESPONSE" | grep -q '"model_id"'; then
    log_pass "Public endpoint returns models for Chat"
  else
    log_fail "Public endpoint failed to return models"
    echo "Response: $RESPONSE"
  fi
}

# Test: Public endpoint only shows enabled models
test_public_models_filtering() {
  log_info "Testing public endpoint only shows enabled models..."

  # Create a disabled provider
  SLUG="disabled-test-$(date +%s)"
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/settings/providers" \
    -H "Content-Type: application/json" \
    -d "{\"provider\": {\"name\": \"Disabled Test\", \"slug\": \"$SLUG\", \"enabled\": false}}")
  PROVIDER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

  # Create a model for disabled provider
  MODEL_RESPONSE=$(curl -s -X POST "$BASE_URL/api/settings/models" \
    -H "Content-Type: application/json" \
    -d "{\"model\": {\"provider_id\": \"$PROVIDER_ID\", \"name\": \"Hidden Model\", \"model_id\": \"hidden-model-$SLUG\", \"endpoint_types\": [\"Chat\"]}}")

  # Check public endpoint
  PUBLIC_RESPONSE=$(curl -s "$BASE_URL/api/models?endpoint_type=Chat")

  if ! echo "$PUBLIC_RESPONSE" | grep -q "hidden-model-$SLUG"; then
    log_pass "Disabled provider's models are hidden from public API"
  else
    log_fail "Disabled provider's models visible in public API"
  fi

  # Cleanup
  curl -s -X DELETE "$BASE_URL/api/settings/providers/$PROVIDER_ID" > /dev/null
}

# Test: Create and delete model
test_model_lifecycle() {
  log_info "Testing model lifecycle (create, read, update, delete)..."

  # First get an existing provider
  PROVIDERS=$(curl -s "$BASE_URL/api/settings/providers")
  PROVIDER_ID=$(echo "$PROVIDERS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

  MODEL_ID="test-model-$(date +%s)"

  # Create model
  CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/settings/models" \
    -H "Content-Type: application/json" \
    -d "{\"model\": {\"provider_id\": \"$PROVIDER_ID\", \"name\": \"Test Model\", \"model_id\": \"$MODEL_ID\", \"endpoint_types\": [\"Chat\"]}}")

  if echo "$CREATE_RESPONSE" | grep -q '"id"'; then
    log_pass "Created model successfully"
    ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

    # Update model
    UPDATE_RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/settings/models/$ID" \
      -H "Content-Type: application/json" \
      -d "{\"model\": {\"name\": \"Updated Model\"}}")

    if echo "$UPDATE_RESPONSE" | grep -q '"Updated Model"'; then
      log_pass "Updated model successfully"
    else
      log_fail "Failed to update model"
    fi

    # Delete model
    DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/settings/models/$ID")
    if echo "$DELETE_RESPONSE" | grep -q '"success":true'; then
      log_pass "Deleted model successfully"
    else
      log_fail "Failed to delete model"
    fi
  else
    log_fail "Failed to create model"
    echo "Response: $CREATE_RESPONSE"
  fi
}

# Test: Invalid endpoint types rejection
test_invalid_endpoint_types() {
  log_info "Testing invalid endpoint types rejection..."

  PROVIDERS=$(curl -s "$BASE_URL/api/settings/providers")
  PROVIDER_ID=$(echo "$PROVIDERS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

  RESPONSE=$(curl -s -X POST "$BASE_URL/api/settings/models" \
    -H "Content-Type: application/json" \
    -d "{\"model\": {\"provider_id\": \"$PROVIDER_ID\", \"name\": \"Test\", \"model_id\": \"test\", \"endpoint_types\": [\"InvalidType\"]}}")

  if echo "$RESPONSE" | grep -q '"error"'; then
    log_pass "Invalid endpoint types correctly rejected"
  else
    log_fail "Invalid endpoint types were accepted"
    echo "Response: $RESPONSE"
  fi
}

# Run all tests
main() {
  echo ""
  echo "=========================================="
  echo "  Configurable Models Integration Tests  "
  echo "=========================================="
  echo ""

  check_server
  echo ""

  echo "--- Provider API Tests ---"
  test_get_providers
  test_create_provider
  test_duplicate_slug
  echo ""

  echo "--- Model API Tests ---"
  test_get_models
  test_filter_models
  test_model_lifecycle
  test_invalid_endpoint_types
  echo ""

  echo "--- Public Models API Tests ---"
  test_public_models
  test_public_models_filtering
  echo ""

  echo "=========================================="
  echo "  Test Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}"
  echo "=========================================="

  if [ $FAIL -gt 0 ]; then
    exit 1
  fi
}

main
