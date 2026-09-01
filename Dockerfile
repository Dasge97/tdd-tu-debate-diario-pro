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

COPY backend/ .

# var/ no esta versionado (lo ignora .gitignore), asi que hay que crearlo antes
# de instalar: Symfony escribe ahi la cache y los logs.
RUN mkdir -p var/cache var/log

# Una sola pasada de composer, con el codigo ya copiado.
# Partirlo en dos capas (instalar dependencias primero y generar el autoloader
# despues) deja fuera del classmap paquetes como psr/http-factory, y entonces
# el servidor de websocket no arranca.
RUN composer install --no-dev --optimize-autoloader --no-interaction

# La web compilada se sirve como ficheros estaticos bajo /app.
COPY --from=web /build/dist ./public/app

RUN chown -R www-data:www-data var/ public/

COPY backend/docker/nginx.conf /etc/nginx/nginx.conf
COPY backend/docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 3000

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
