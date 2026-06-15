FROM php:8.4-cli-bookworm

# System deps (no Swoole compilation needed — using RoadRunner)
RUN apt-get update && apt-get install -y \
    libzip-dev \
    zip \
    unzip \
    libpng-dev \
    libonig-dev \
    libpq-dev \
    && docker-php-ext-install pdo_pgsql zip mbstring bcmath sockets pcntl \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

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
