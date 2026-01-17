#!/bin/sh
VITE_API_URL="https://api.castmill.dev" VITE_DOMAIN="app.castmill.dev" VITE_ORIGIN="https://app.castmill.dev" CASTMILL_DASHBOARD_URI=https://app.castmill.dev docker-compose --context geisha up --build -d

# docker-compose --context geisha up --build -d
