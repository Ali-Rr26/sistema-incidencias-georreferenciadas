#!/bin/bash
set -e

# -------------------------------------------------------
# Wait for PostgresSQL to be ready (TCP poll, 30s timeout)
# -------------------------------------------------------
echo "Waiting for database connection at ${DB_HOST:-db}:${DB_PORT:-5432}..."

TIMEOUT=30
INTERVAL=1
ELAPSED=0

while ! php -r "
    \$sock = @fsockopen('${DB_HOST:-db}', ${DB_PORT:-5432}, \$errno, \$errstr, 1);
    if (\$sock) { fclose(\$sock); exit(0); }
    exit(1);
" 2>/dev/null; do
    if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
        echo "ERROR: Database not reachable after ${TIMEOUT}s. Exiting."
        exit 1
    fi
    echo "  Database not ready yet... (${ELAPSED}s/${TIMEOUT}s)"
    sleep "$INTERVAL"
    ELAPSED=$((ELAPSED + INTERVAL))
done

echo "Database is ready."

# -------------------------------------------------------
# Run migrations (non-blocking: warn on failure)
# -------------------------------------------------------
echo "Running migrations..."
php artisan migrate --force || echo "WARNING: Migrations failed. Continuing startup."

# -------------------------------------------------------
# Start Octane (RoadRunner) — exec replaces shell process
# so signals (SIGTERM) reach Octane directly
# -------------------------------------------------------
echo "Starting Octane (FrankenPHP) on 0.0.0.0:8000..."
exec php artisan octane:start \
    --server=frankenphp \
    --host=0.0.0.0 \
    --port=8000 \
    --workers=4 \
    --max-requests=500
