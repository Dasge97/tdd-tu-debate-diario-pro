import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const inputPath = process.argv[2];

if (!inputPath) {
  console.error("Usage: node process-job.js /shared/jobs/inbox/<jobId>.json");
  process.exit(1);
}

const DEBATE_ALLOWED_CATEGORIES = [
  "politica",
  "economia",
  "tecnologia",
  "sociedad",
  "ciencia",
  "medio ambiente",
  "cultura",
  "internacional"
];

const CATEGORY_NORMALIZATION_MAP = new Map([
  ["política", "politica"],
  ["politica", "politica"],
  ["economía", "economia"],
  ["economia", "economia"],
  ["tecnología", "tecnologia"],
  ["tecnologia", "tecnologia"],
  ["sociedad", "sociedad"],
  ["ciencia", "ciencia"],
  ["medio ambiente", "medio ambiente"],
  ["medioambiente", "medio ambiente"],
  ["cultura", "cultura"],
  ["internacional", "internacional"]
]);

const FORBIDDEN_EDITORIAL_PATTERNS = [
  "abre un debate",
  "abren un debate",
  "el debate no se agota",
  "la conversacion publica gira",
  "la conversación pública gira",
  "obliga a decidir",
  "obliga a discutir",
  "funciona como una senal",
  "funciona como una señal",
  "este caso funciona",
  "la pregunta central es como",
  "la pregunta central es cómo",
  "afecta a toda la sociedad"
];

const parseBoolean = (value, fallback = false) => {
  if (value == null) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
};

const shouldAutoCompleteJob = () =>
  parseBoolean(
    process.env.OPENCODE_AUTO_COMPLETE_JOB ?? process.env.OPENCODE_AUTO_APPLY_SQL,
    true
  );

const sanitizeText = (value) => String(value || "").replace(/^["'\s]+|["'\s]+$/g, "").trim();

const hasRoboticEditorialTone = (value) => {
  const normalized = sanitizeText(value).toLowerCase();
  return FORBIDDEN_EDITORIAL_PATTERNS.some((pattern) => normalized.includes(pattern));
};

const normalizeQuestion = (value) => {
  const text = sanitizeText(value);

  if (!text) {
    return "";
  }

  if (text.endsWith("?") && !text.startsWith("¿")) {
    return `¿${text}`;
  }

  if (!text.endsWith("?") && text.length >= 24) {
    return `${text}?`;
  }

  return text;
};

const normalizeCategory = (value, fallbackCategory = "sociedad") => {
  const normalized =
    CATEGORY_NORMALIZATION_MAP.get(String(value || "").trim().toLowerCase()) || null;

  if (normalized && DEBATE_ALLOWED_CATEGORIES.includes(normalized)) {
    return normalized;
  }

  if (DEBATE_ALLOWED_CATEGORIES.includes(fallbackCategory)) {
    return fallbackCategory;
  }

  return "sociedad";
};

const parseJsonOutput = (value) => {
  const text = String(value || "").trim();

  if (!text) {
    return null;
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : text;

  try {
    return JSON.parse(candidate);
  } catch {
    const match = candidate.match(/\{[\s\S]*\}/);

    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
};

const isUsableOutput = (parsed) =>
  Boolean(
    parsed &&
      DEBATE_ALLOWED_CATEGORIES.includes(normalizeCategory(parsed.category, "")) &&
      sanitizeText(parsed.debate_title) &&
      sanitizeText(parsed.debate_question) &&
      sanitizeText(parsed.debate_title).length >= 18 &&
      sanitizeText(parsed.card_summary).length >= 75 &&
      sanitizeText(parsed.card_summary).length <= 240 &&
      sanitizeText(parsed.debate_context).length >= 260 &&
      sanitizeText(parsed.debate_context).length <= 1400 &&
      !hasRoboticEditorialTone(parsed.debate_title) &&
      !hasRoboticEditorialTone(parsed.debate_question) &&
      !hasRoboticEditorialTone(parsed.card_summary) &&
      !hasRoboticEditorialTone(parsed.debate_context)
  );

const buildCandidateRecord = (payload, debate) => {
  const sourceItem = payload.news_items.find(
    (item) => item.candidate_id === sanitizeText(debate.candidate_id)
  );

  if (!sourceItem) {
    return {
      ok: false,
      reason: `unknown-candidate-id:${debate.candidate_id || "missing"}`
    };
  }

  if (!isUsableOutput(debate)) {
    return {
      ok: false,
      reason: `invalid-editorial-output:${sourceItem.candidate_id}`
    };
  }

  return {
    ok: true,
    sourceItem,
    normalized: {
      category: normalizeCategory(debate.category, sourceItem.category || "sociedad"),
      debate_title: sanitizeText(debate.debate_title),
      debate_question: normalizeQuestion(debate.debate_question),
      card_summary: sanitizeText(debate.card_summary),
      debate_context: sanitizeText(debate.debate_context)
    }
  };
};

const selectFinalDebates = ({ payload, debates }) => {
  const finalTarget = Number(payload.target_debates || 5);
  const selected = [];
  const seenCategories = new Set();
  const discarded = [];

  for (const debate of debates) {
    const candidate = buildCandidateRecord(payload, debate);

    if (!candidate.ok) {
      discarded.push({
        candidate_id: sanitizeText(debate?.candidate_id),
        reason: candidate.reason
      });
      continue;
    }

    if (seenCategories.has(candidate.normalized.category)) {
      discarded.push({
        candidate_id: candidate.sourceItem.candidate_id,
        reason: `duplicate-category:${candidate.normalized.category}`
      });
      continue;
    }

    selected.push(candidate);
    seenCategories.add(candidate.normalized.category);

    if (selected.length === finalTarget) {
      break;
    }
  }

  if (selected.length !== finalTarget) {
    throw new Error(
      `Could not build ${finalTarget} valid debates with distinct categories. Selected ${selected.length}.`
    );
  }

  return {
    selected,
    discarded
  };
};

const buildBatchPrompt = (payload) => {
  const candidates = payload.news_items
    .map(
      (item) => `
${item.candidate_id}
- category: ${item.category || "sociedad"}
- source: ${item.source}
- title: ${item.title}
- summary: ${item.summary}
- content:
${item.content || ""}
`.trim()
    )
    .join("\n\n");

  return `
Eres un editor que convierte varias noticias en piezas breves para abrir debates tematicos.

Devuelve solo JSON valido, sin markdown y sin texto adicional, con esta estructura exacta:
{
  "debates": [
    {
      "candidate_id": "string",
      "category": "string",
      "debate_title": "string",
      "debate_question": "string",
      "card_summary": "string",
      "debate_context": "string"
    }
  ]
}

Reglas:
- escribe en espanol
- devuelve exactamente ${payload.candidate_debates} debates
- elige los mejores candidate_id posibles a partir de la lista dada
- no repitas candidate_id
- no cambies el candidate_id elegido
- "category" debe ser exactamente una de estas: ${DEBATE_ALLOWED_CATEGORIES.join(", ")}
- tono neutral, claro, natural y apto para una audiencia general
- escribe como alguien que quiere explicar bien de que va el debate, no como un informe institucional
- prioriza claridad humana antes que grandilocuencia o jerga editorial
- "debate_title" debe sonar como un titular breve, natural y no sensacionalista
- "debate_title" no puede empezar por "Debate sobre", "Claves para debatir", "La noticia de" o similares
- "debate_question" debe ser abierta, concreta y dejar claro el desacuerdo o la decision de fondo
- "card_summary" debe ocupar entre 90 y 180 caracteres y explicar en lenguaje llano cual es la idea del debate
- "debate_context" debe tener entre 420 y 900 caracteres, en 2 o 3 parrafos breves, y hacer entendible el dilema en una primera lectura
- no inventes datos que no aparezcan en el contenido
- usa cada noticia solo como punto de partida para identificar el tema de fondo
- no empieces con formulas como "la noticia trata de", "el articulo explica" o "segun esta noticia"
- si el caso es local o concreto, extrapola su relevancia a una escala mas amplia cuando sea razonable
- el debate debe interesar a una audiencia general hispanohablante aunque no conozca el caso concreto
- evita nombres propios o detalles excesivamente locales en el titulo y la pregunta salvo que sean imprescindibles
- no repitas formulas entre debates
- evita frases vacias o solemnes como "abre un debate", "obliga a decidir", "la conversacion gira en torno a", "el debate no se agota en"
- evita sonar academico, burocratico o automatico
- mejor una idea clara que dos ideas abstractas
- el primer parrafo del contexto debe decir con claridad que esta en juego
- el segundo parrafo debe explicar donde esta la tension: que intereses, derechos, costes o prioridades chocan
- si al leer el resumen y la pregunta no se entiende inmediatamente el conflicto, reescribe
- prioriza diversidad tematica real
- intenta que los primeros ${payload.target_debates} debates tengan categorias distintas
- si hay suficientes noticias de categorias diferentes, los primeros ${payload.target_debates} debates deben cubrir ${payload.target_debates} categorias distintas
- ordena los debates de mejor a peor segun calidad editorial y diversidad
- no uses ingles en ningun campo final

Ejemplo de tono deseado:
- titulo: "Quien debe asumir el coste del agua escasa"
- pregunta: "¿A quien deberia darse prioridad cuando no hay agua suficiente para todos los usos?"
- summary: "La sequia obliga a elegir entre consumo domestico, agricultura e industria, y el debate real es quien asume el coste de esa prioridad."

Ejemplo de tono no deseado:
- titulo: "Agua escasa: un debate necesario"
- pregunta: "¿Como deberiamos reflexionar sobre este problema?"
- summary: "Este caso abre un debate amplio sobre la gestion del agua y obliga a decidir prioridades."

NOTICIAS:
${candidates}
`.trim();
};

const runOpencode = async ({ attachedFilePath, model, prompt }) =>
  new Promise((resolve, reject) => {
    const args = ["run"];

    if (model) {
      args.push("--model", model);
    }

    args.push("--file", attachedFilePath, "--", prompt);

    const child = spawn("opencode", args, {
      cwd: "/workspace",
      env: {
        ...process.env,
        OPENCODE_CONFIG: "/workspace/opencode.json"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`opencode exited with code ${code}: ${stderr.trim() || stdout.trim()}`));
        return;
      }

      resolve({
        stdout,
        stderr
      });
    });
  });

const buildCompletedDebates = ({ payload, selectedDebates, model }) =>
  selectedDebates.map(({ sourceItem, normalized }) => ({
    newsItemId: sourceItem.news_item_id,
    title: normalized.debate_title,
    question: normalized.debate_question,
    cardSummary: normalized.card_summary,
    debateContext: normalized.debate_context,
    category: normalized.category,
    sourceName: sourceItem.source,
    sourceUrl: sourceItem.url,
    publishedAt: sourceItem.published_at || null,
    generationSource: "opencode",
    generationModel: model,
    rawGeneration: {
      candidateId: sourceItem.candidate_id,
      promptVersion: payload.prompt_version || null,
      category: normalized.category,
      title: normalized.debate_title,
      question: normalized.debate_question
    }
  }));

const completeJobViaApi = async (jobId, completionPayload) => {
  const apiBaseUrl =
    process.env.BACKEND_API_BASE_URL || process.env.NEWS_API_BASE_URL || "http://backend:3000";
  const response = await fetch(`${apiBaseUrl}/generation/jobs/${jobId}/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(completionPayload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API complete failed with ${response.status}: ${errorText}`);
  }

  return response.json();
};

const reportJobFailure = async ({ jobId, errorMessage }) => {
  if (!jobId) {
    return;
  }

  const apiBaseUrl =
    process.env.BACKEND_API_BASE_URL || process.env.NEWS_API_BASE_URL || "http://backend:3000";

  try {
    await fetch(`${apiBaseUrl}/generation/jobs/${jobId}/fail`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ errorMessage })
    });
  } catch {
    // Best effort only: watcher logs are the fallback source of truth.
  }
};

const main = async () => {
  const payload = JSON.parse(await fs.readFile(inputPath, "utf8"));
  const model = `${process.env.OPENCODE_PROVIDER_ID || "opencode"}/${process.env.OPENCODE_MODEL_ID || "minimax-m2.5-free"}`;
  const outputPath =
    payload.expected_result_path ||
    path.join(path.dirname(path.dirname(inputPath)), "outbox", `${payload.job_id}.result.json`);
  const logPath = path.join(path.dirname(path.dirname(inputPath)), "logs", `${payload.job_id}.log`);
  const prompt = buildBatchPrompt(payload);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.mkdir(path.dirname(logPath), { recursive: true });

  const result = await runOpencode({
    attachedFilePath: inputPath,
    model,
    prompt
  });
  const parsed = parseJsonOutput(result.stdout);
  const debates = Array.isArray(parsed?.debates) ? parsed.debates : [];

  if (debates.length !== Number(payload.candidate_debates || payload.target_debates || 5)) {
    throw new Error(
      `Expected ${payload.candidate_debates || payload.target_debates} candidate debates from model output, received ${debates.length}`
    );
  }

  const { selected, discarded } = selectFinalDebates({ payload, debates });
  const completedDebates = buildCompletedDebates({
    payload,
    selectedDebates: selected,
    model
  });

  const resultPayload = {
    jobId: payload.job_id,
    model,
    debates: completedDebates,
    discardedCandidates: discarded,
    rawModelOutput: result.stdout
  };

  await fs.writeFile(outputPath, `${JSON.stringify(resultPayload, null, 2)}\n`);
  await fs.writeFile(
    logPath,
    `${JSON.stringify(
      {
        jobId: payload.job_id,
        model,
        inputPath,
        outputPath,
        promptVersion: payload.prompt_version || null,
        candidateDebatesRequested: payload.candidate_debates || null,
        targetDebatesFinal: payload.target_debates || null,
        selectedCategories: selected.map((item) => item.normalized.category),
        discardedCandidates: discarded,
        rawModelOutput: result.stdout,
        stderr: result.stderr.trim() || null
      },
      null,
      2
    )}\n`
  );

  if (shouldAutoCompleteJob()) {
    const completed = await completeJobViaApi(payload.job_id, {
      resultFilePath: outputPath,
      debates: completedDebates
    });
    console.log(JSON.stringify(completed));
  } else {
    console.log(outputPath);
  }
};

main().catch(async (error) => {
  let jobId = null;

  try {
    const payload = JSON.parse(await fs.readFile(inputPath, "utf8"));
    jobId = payload?.job_id || null;
  } catch {
    jobId = null;
  }

  await reportJobFailure({
    jobId,
    errorMessage: error.message
  });

  console.error(error);
  process.exit(1);
});
