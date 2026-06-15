FROM php:8.4-cli-alpine

# Install system dependencies (bash is required for the entrypoint.sh script)
RUN apk add --no-cache \
    zip \
    unzip \
    bash

# Download official helper to install PHP extensions
ADD --chmod=0755 https://github.com/mlocati/docker-php-extension-installer/releases/latest/download/install-php-extensions /usr/local/bin/

# Install required PHP extensions (dependencies are managed and cleaned up automatically)
RUN install-php-extensions pdo_pgsql zip mbstring bcmath sockets pcntl redis

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/backend

# Copy dependency manifests first for layer caching
COPY composer.json composer.lock ./

# Install dependencies (cached unless composer files change)
RUN composer install --no-dev --optimize-autoloader --no-scripts

# Copy application source
COPY . .

# Run post-autoload scripts (package discovery, etc.)
RUN composer dump-autoload --optimize

# Ensure storage and cache directories are writable
RUN mkdir -p storage/logs storage/framework/cache storage/framework/sessions storage/framework/views bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

# Download RoadRunner binary
RUN php vendor/bin/rr get-binary --no-interaction \
    && echo "version: 3" > .rr.yaml

# Entrypoint
COPY entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["entrypoint.sh"]
