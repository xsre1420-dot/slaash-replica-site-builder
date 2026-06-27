# syntax=docker/dockerfile:1

# --- Dependencies ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# --- Build (Vite embeds VITE_* at build time) ---
FROM deps AS build
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID=""
ARG VITE_APP_ENV=production

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
ENV VITE_APP_ENV=$VITE_APP_ENV
ENV CI=true

COPY . .
RUN node scripts/check-env.mjs
RUN npm run build

# --- Runtime ---
FROM nginx:1.27-alpine AS runtime
RUN apk add --no-cache wget

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health.json || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
