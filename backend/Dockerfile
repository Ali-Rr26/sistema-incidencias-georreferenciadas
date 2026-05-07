FROM php:8.5.5-fpm-alpine

# Instalamos dependencias del sistema requeridas
RUN apk add --no-cache \
    unzip \
    libzip-dev

# Instalamos las extensiones de PHP que Laravel necesita (especialmente pdo_mysql)
RUN docker-php-ext-install pdo_mysql zip

WORKDIR /var/www/backend
