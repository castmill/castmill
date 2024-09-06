#!/bin/bash
# Exit script on any error
set -e

# Run database migrations
/app/bin/migrate

# Run the server
exec /app/bin/castmill start
