# Web de TuDebateDiario

Aplicación web instalable (PWA) que se sirve en `tudebatediario.com/app`.
Consume la misma API Symfony que la app Flutter de `mobile/`.

## Stack

| Pieza | Tecnología |
|---|---|
| Framework | Vue 3 (composition API) |
| Empaquetado | Vite 6 |
| Estado | Pinia |
| Rutas | Vue Router, modo history con base `/app/` |
| HTTP | Axios, con refresco automático de token |
| Instalable | vite-plugin-pwa (manifest + service worker) |
| Estilos | SCSS propio en `src/styles/app.scss` |

El aspecto viene del repositorio anterior `tdd-tu-debate-diario-pro`: misma paleta
(papel `#f3f1ed`, azul `#1f4ba3`), misma tipografía (IBM Plex Sans con títulos en
Bitter) y los mismos nombres de clase para tarjetas y barra de posiciones. La
diferencia es que aquí el diseño es mobile-first, con barra de navegación inferior
en lugar del panel lateral de escritorio.

## Desarrollo

```bash
npm install
npm run dev
```

Arranca en `http://localhost:5173/app/`. Vite redirige `/api` y `/uploads` a
`http://localhost:3000`, que es donde escucha el backend del `docker-compose` del
repositorio.

Variables de entorno (`.env.example`):

- `VITE_API_BASE_URL`: vacío en producción, porque la web se sirve desde el mismo
  dominio que la API.
- `VITE_WS_URL`: URL del websocket de chat. Si se deja vacía, el cliente usa
  `wss://ws.<dominio actual>`, que en producción es `ws.tudebatediario.com`.

## Producción

No hace falta compilar a mano. El `Dockerfile` de la raíz del repositorio compila
esta carpeta en una etapa de Node y copia el resultado a
`backend/public/app`, donde nginx lo sirve.

```bash
docker compose build backend
```

En `backend/docker/nginx.conf`, el bloque `location /app/` devuelve `index.html`
para cualquier ruta que no sea un fichero real, que es lo que necesita el
enrutado del lado cliente.

## Pantallas

Las mismas que la app Flutter: entrar, registro, inicio con las pestañas Hoy,
Semana y Protagonistas, detalle de debate con votación y comentarios anidados,
proponer debate, buscar, personajes y su ficha, perfil propio y ajeno, editar
perfil, favoritos, amigos, mensajes con websocket, notificaciones y ajustes.

## Detalles a tener en cuenta

- La API exige token en todo `/api/v1` salvo entrar, registro y refresco. No hay
  modo de lectura sin cuenta: la raíz de `/app` redirige a la pantalla de entrada.
- La API devuelve los recuentos de posiciones, pero no cuál eligió el usuario ni
  cómo votó cada comentario. Ambas cosas se recuerdan en `localStorage` para que
  los botones sigan marcados al volver.
