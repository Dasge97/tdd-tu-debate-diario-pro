import 'dotenv/config';
import { createLogger, transports, format } from 'winston';
import fetch from 'node-fetch';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

export const logger = createLogger({
  level: LOG_LEVEL,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
      return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
    })
  ),
  transports: [
    new transports.Console(),
    new transports.File({
      filename: 'logs/worker.log',
      maxsize: 5 * 1024 * 1024,  // 5 MB
      maxFiles: 5,
      tailable: true,
    }),
  ],
});

/**
 * Evaluates whether the current minute matches a cron expression.
 * Supports standard 5-field cron: minute hour dom month dow
 * Returns true if all fields match the current time.
 */
function checkSchedule(cronExpression, timeZone = null) {
  if (!cronExpression) return false;

  try {
    // Con zona horaria (motor V2) la hora del cron es la de esa zona; sin ella, la del contenedor.
    const now = timeZone
      ? new Date(new Date().toLocaleString('en-US', { timeZone }))
      : new Date();
    const fields = cronExpression.trim().split(/\s+/);
    if (fields.length < 5) return false;

    const [minute, hour, dom, month, dow] = fields;

    function matchField(field, value) {
      if (field === '*') return true;
      // Handle step values like */15
      if (field.startsWith('*/')) {
        const step = parseInt(field.slice(2), 10);
        return value % step === 0;
      }
      // Handle lists like 1,3,5
      if (field.includes(',')) {
        return field.split(',').map(Number).includes(value);
      }
      // Handle ranges like 8-17
      if (field.includes('-')) {
        const [min, max] = field.split('-').map(Number);
        return value >= min && value <= max;
      }
      return parseInt(field, 10) === value;
    }

    return (
      matchField(minute, now.getMinutes()) &&
      matchField(hour, now.getHours()) &&
      matchField(dom, now.getDate()) &&
      matchField(month, now.getMonth() + 1) &&
      matchField(dow, now.getDay())
    );
  } catch (err) {
    logger.warn('Error evaluando cron expression:', err.message);
    return false;
  }
}

async function fetchWorkerConfig() {
  const baseUrl = process.env.BACKEND_API_BASE_URL;
  const apiKey = process.env.WORKER_API_KEY;

  const response = await fetch(`${baseUrl}/api/v1/worker/config`, {
    method: 'GET',
    headers: {
      'X-Worker-Key': apiKey,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Config fetch failed: ${response.status} ${body}`);
  }

  return await response.json();
}

// Una sola ejecución a la vez en este proceso. El backend además bloquea entre procesos.
let busy = false;

async function tick() {
  if (busy) {
    logger.info('Tick: hay una ejecución en marcha, se espera a que termine.');
    return;
  }
  logger.info('Tick: verificando configuración del worker...');

  try {
    const config = await fetchWorkerConfig();

    if (!config.enabled) {
      logger.info('Worker deshabilitado por configuración. Saltando ejecución.');
      return;
    }

    const isV2 = config.engine === 'v2';
    const shouldRun = config.trigger_pending === true || checkSchedule(config.schedule, isV2 ? 'Europe/Madrid' : null);

    if (!shouldRun) {
      logger.info('No hay ejecución programada para este momento.');
      return;
    }

    // ACK antes de arrancar para que el trigger no se dispare de nuevo
    if (config.trigger_pending) {
      await fetch(`${process.env.BACKEND_API_BASE_URL}/api/v1/worker/ack`, {
        method: 'POST',
        headers: { 'X-Worker-Key': process.env.WORKER_API_KEY },
      });
    }

    busy = true;
    if (isV2) {
      logger.info(`Iniciando motor editorial V2 (${config.editorial_mode})...`);
      const { runEditorial } = await import('./v2/pipeline.js');
      const { createApi } = await import('./v2/api.js');
      const api = createApi({ baseUrl: process.env.BACKEND_API_BASE_URL, workerKey: process.env.WORKER_API_KEY });
      const report = await runEditorial({ api, logger, triggeredBy: config.trigger_pending ? 'manual' : 'schedule' });
      logger.info(`Motor V2 terminado: ${report.status}${report.error ? ` — ${report.error}` : ''}`);
    } else {
      logger.info('Iniciando ejecución del worker (motor V1)...');
      const { run } = await import('./runner.js');
      await run(config, logger);
    }
  } catch (err) {
    logger.error('Error en tick: ' + err.message, { stack: err.stack });
  } finally {
    busy = false;
  }
}

// Graceful shutdown
function setupGracefulShutdown(intervalId) {
  const shutdown = (signal) => {
    logger.info(`Señal ${signal} recibida. Cerrando worker...`);
    clearInterval(intervalId);
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

logger.info('Worker tdd-app arrancando...');
logger.info(`Backend: ${process.env.BACKEND_API_BASE_URL}`);
logger.info(`CLI IA: ${process.env.AI_CLI_COMMAND || 'claude'} ${process.env.AI_CLI_ARGS || '-p --no-markdown'}`);

// Ejecutar tick inmediatamente al arrancar
await tick();

// Loop cada 60 segundos
const intervalId = setInterval(tick, 60_000);

setupGracefulShutdown(intervalId);
