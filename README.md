# Tu Debate Diario

Aplicacion full stack para debatir temas de actualidad, con comunidad, perfiles, comentarios, favoritos, amistades, chat y un pipeline editorial integrado para importar noticias y generar debates.

## Stack

- `frontend/`: Vue 3, Vite, Pinia, Bootstrap y partes de Quasar
- `backend/`: Node.js, Express, MySQL, JWT y WebSocket
- `opencode/`: worker para procesar jobs editoriales
- `n8n/`: workflows de scraping/importacion
- `docker-compose.yml`: entorno unificado para desarrollo local

## Estructura

- `backend/`: API principal y acceso a datos
- `frontend/`: SPA principal
- `opencode/`: worker de generacion
- `n8n/`: configuracion y workflows
- `shared/`: intercambio de jobs entre backend y worker
- `docs/`: documentacion adicional del proyecto

## Requisitos

- Docker y Docker Compose
- Node.js 22 si vas a ejecutar servicios fuera de Docker
- npm

## Variables de entorno

Este repo usa dos ejemplos principales:

- [`.env.example`](/home/tekilatime/PROYECTOS/tdd-tu-debate-diario/.env.example): variables raiz para `docker compose`
- [`frontend/.env.example`](/home/tekilatime/PROYECTOS/tdd-tu-debate-diario/frontend/.env.example): variables del frontend

Opcionalmente tambien tienes:

- [`backend/.env.example`](/home/tekilatime/PROYECTOS/tdd-tu-debate-diario/backend/.env.example): arranque local del backend sin Docker

## Arranque rapido con Docker

1. Copia los ejemplos de entorno:

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

2. Levanta el stack:

```bash
docker compose up --build -d
```

3. Accede a los servicios:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- n8n: `http://localhost:5689`

## Desarrollo por separado

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Endpoints y operativa

Vistas operativas servidas por el backend:

- `http://localhost:3000/index.html`
- `http://localhost:3000/imports.html`
- `http://localhost:3000/jobs.html`

Endpoints operativos principales:

- `POST /news/import`
- `GET /news/imports`
- `GET /news/imports/latest`
- `GET /news/pending`
- `POST /generation/jobs`
- `GET /generation/jobs`
- `GET /generation/jobs/:jobId`
- `POST /generation/jobs/:jobId/complete`
- `GET /debates/latest`

## Git y publicacion

El proyecto ya queda preparado para subirse a Git:

- `.env`, `node_modules`, logs, uploads y artefactos generados ignorados
- ejemplos de entorno incluidos
- `Dockerfile` con `.dockerignore` por servicio
- `.gitattributes` con finales de linea normalizados

Si quieres inicializar el repo localmente:

```bash
git init
git add .
git commit -m "Initial commit"
```

## Recomendaciones antes de publicar

- Cambia todos los secretos de `.env`
- No subas ningun `.env` real
- Revisa credenciales de `n8n`, JWT y claves de proveedores
- Si vas a publicar el repo, considera añadir una licencia
