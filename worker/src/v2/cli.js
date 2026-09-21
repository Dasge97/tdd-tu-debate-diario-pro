#!/usr/bin/env node
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createApi } from './api.js';
import { runEditorial } from './pipeline.js';

/**
 * Ejecución manual del motor V2.
 *
 *   node src/v2/cli.js                  prueba (dry-run): no publica nada
 *   node src/v2/cli.js --no-ingest      prueba sin descargar fuentes (usa lo ya guardado)
 *   node src/v2/cli.js --no-resume      no reanuda una ejecución anterior del mismo día
 *   node src/v2/cli.js --live --yes     publica de verdad (pide confirmación explícita)
 *   node src/v2/cli.js --report=f.json  guarda el informe en un fichero
 */

const args = new Set(process.argv.slice(2).filter((a) => !a.startsWith('--report=')));
const reportPath = process.argv.slice(2).find((a) => a.startsWith('--report='))?.slice('--report='.length);

if (args.has('--live') && !args.has('--yes')) {
  console.error('--live publica debates reales. Añade --yes si es lo que quieres.');
  process.exit(2);
}

const logger = {
  info: (m) => console.log(`[info] ${m}`),
  warn: (m) => console.warn(`[aviso] ${m}`),
  error: (m) => console.error(`[error] ${m}`),
};

const api = createApi({ baseUrl: process.env.BACKEND_API_BASE_URL, workerKey: process.env.WORKER_API_KEY });
const report = await runEditorial({
  api,
  logger,
  mode: args.has('--live') ? 'live' : 'dry_run',
  triggeredBy: 'cli',
  resume: !args.has('--no-resume'),
  skipIngest: args.has('--no-ingest'),
});

const text = JSON.stringify(report, null, 2);
if (reportPath) writeFileSync(reportPath, text);
console.log(text);
process.exit(report.status === 'failed' ? 1 : 0);
