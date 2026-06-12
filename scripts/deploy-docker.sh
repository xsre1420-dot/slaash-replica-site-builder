#!/usr/bin/env sh
set -eu

# Production Docker deploy helper
# Usage: ENV_STRICT=true ./scripts/deploy-docker.sh [image-tag]

TAG="${1:-slaash-storefront:latest}"

if [ -z "${VITE_SUPABASE_URL:-}" ] || [ -z "${VITE_SUPABASE_PUBLISHABLE_KEY:-}" ]; then
  echo "Error: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY"
  exit 1
fi

export ENV_STRICT=true
node scripts/check-env.mjs

docker build \
  --build-arg VITE_SUPABASE_URL="${VITE_SUPABASE_URL}" \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY}" \
  --build-arg VITE_SUPABASE_PROJECT_ID="${VITE_SUPABASE_PROJECT_ID:-}" \
  --build-arg VITE_APP_ENV="${VITE_APP_ENV:-production}" \
  -t "${TAG}" \
  .

echo "Built ${TAG}"
echo "Run: docker run -p 8080:80 ${TAG}"
