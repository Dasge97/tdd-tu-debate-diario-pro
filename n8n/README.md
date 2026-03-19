# n8n para TDD - Tu Debate Diario

Esta carpeta contiene el workflow base inspirado en el diagrama compartido:

- varias ramas RSS
- limpieza y formateo por fuente
- filtrado y limite por fuente
- merge del lote
- agrupacion final
- envio por HTTP a la API

## Variable usada dentro de n8n

- `NEWS_API_BASE_URL=http://api:3000`

## Endpoint de destino

El workflow envia el lote a:

```text
POST {{NEWS_API_BASE_URL}}/news/import
```

## Payload esperado por la API

```json
{
  "triggerType": "n8n-manual",
  "items": [
    {
      "source": "Fuente RSS",
      "title": "Titular",
      "summary": "Resumen",
      "url": "https://...",
      "published_at": "2026-03-17T08:00:00Z",
      "category": "tecnologia",
      "content": "Texto enriquecido si existe",
      "metadata": {}
    }
  ]
}
```

## Nota

El workflow actual es una base de arranque. Cuando definas las fuentes exactas, completamos los `feedUrl`, las reglas por fuente y la autenticacion si hace falta.
