import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const inputPath = process.argv[2];

if (!inputPath) {
  console.error("Usage: node mock-generate-sql.js /shared/jobs/inbox/<jobId>.json");
  process.exit(1);
}

const escapeSql = (value) => String(value || "").replaceAll("'", "''");

const payload = JSON.parse(await fs.readFile(inputPath, "utf8"));
const outputPath = path.join(path.dirname(path.dirname(inputPath)), "outbox", `${payload.job_id}.sql`);
const debates = payload.news_items.slice(0, payload.target_debates).map((item, index) => {
  const title = `Debate ${index + 1}: ${item.title}`.slice(0, 140);
  const question = `¿Que dilema publico abre el caso planteado por ${item.source}?`;
  const cardSummary = `El caso de ${item.source} plantea tensiones entre interes publico, costes compartidos y decisiones con impacto social.`;
  const debateContext =
    `La noticia titulada "${escapeSql(item.title)}" se toma aqui como punto de partida para abrir una conversacion publica mas amplia. ` +
    `El objetivo del debate no es repetir el titular, sino explorar que criterios deberian pesar cuando una decision afecta a distintos actores con intereses cruzados.`;

  return `INSERT INTO debates (
  id,
  generation_job_id,
  news_item_id,
  title,
  question,
  card_summary,
  debate_context,
  category,
  source_name,
  source_url,
  published_at
) VALUES (
  '${crypto.randomUUID()}',
  '${payload.job_id}',
  '${item.news_item_id}',
  '${escapeSql(title)}',
  '${escapeSql(question)}',
  '${escapeSql(cardSummary)}',
  '${escapeSql(debateContext)}',
  '${escapeSql(item.category || "sociedad")}',
  '${escapeSql(item.source)}',
  '${escapeSql(item.url)}',
  ${item.published_at ? `'${escapeSql(item.published_at)}'` : "NULL"}
);`;
});

await fs.writeFile(outputPath, `${debates.join("\n\n")}\n`);
console.log(outputPath);
