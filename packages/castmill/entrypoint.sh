#!/bin/bash
# Exit script on any error
set -e

# Run database migrations
echo "Running database migrations..."
/app/bin/migrate

# Run the server
echo "Starting the server..."
exec /app/bin/castmill start
