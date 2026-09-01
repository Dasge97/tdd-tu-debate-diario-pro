# Imagen de produccion: compila la web de /app y la sirve junto a la API Symfony.
#
# El contexto de build es la raiz del repositorio, para que la etapa de Node
# pueda leer frontend/ y la de PHP pueda leer backend/.

# ---------- 1. Web de /app ----------
FROM node:22-alpine AS web

WORKDIR /build

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ---------- 2. API + web ----------
FROM php:8.4-fpm-alpine

RUN apk add --no-cache \
    nginx \
    supervisor \
    icu-dev \
    libzip-dev \
    oniguruma-dev \
    && docker-php-ext-install \
    pdo_mysql \
    intl \
    zip \
    bcmath \
    opcache

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Las dependencias van en su propia capa para no reinstalarlas en cada cambio de
# codigo. Sin --no-scripts, los auto-scripts de Symfony intentarian vaciar la
# cache cuando todavia no existen ni bin/console ni config/.
COPY backend/composer.json backend/composer.lock backend/symfony.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --no-interaction

COPY backend/ .

RUN composer dump-autoload --no-dev --optimize --no-interaction \
    && composer run-script --no-dev post-install-cmd || true

# La web compilada se sirve como ficheros estaticos bajo /app.
COPY --from=web /build/dist ./public/app

RUN chown -R www-data:www-data var/ public/

COPY backend/docker/nginx.conf /etc/nginx/nginx.conf
COPY backend/docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 3000

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
