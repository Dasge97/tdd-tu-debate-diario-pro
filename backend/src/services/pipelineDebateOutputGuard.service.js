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

const FORBIDDEN_TITLE_PREFIXES = [
  "debate sobre",
  "claves para debatir",
  "la noticia de",
  "el caso de"
];

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

const sanitizeText = (value) => String(value || "").trim();
const hasRoboticEditorialTone = (value) => {
  const text = sanitizeText(value).toLowerCase();
  return FORBIDDEN_EDITORIAL_PATTERNS.some((pattern) => text.includes(pattern));
};

const looksQuestionLike = (value) => {
  const text = sanitizeText(value);
  if (!text || text.length < 24) return false;
  if (text.endsWith("?")) return true;

  return [
    "como ",
    "cómo ",
    "que ",
    "qué ",
    "quien ",
    "quién ",
    "hasta donde ",
    "hasta dónde ",
    "deberia ",
    "debería "
  ].some((prefix) => text.toLowerCase().startsWith(prefix));
};

const extractValuesBlocks = (sqlText) => {
  const matches = [...String(sqlText || "").matchAll(/values\s*\(([\s\S]*?)\)\s*;/gi)];
  return matches.map((match) => match[1]);
};

const extractQuotedValues = (block) => {
  const values = [];
  const regex = /'((?:''|[^'])*)'/g;
  let match;

  while ((match = regex.exec(block)) !== null) {
    values.push(match[1].replaceAll("''", "'"));
  }

  return values;
};

export const assertEditorialDebatesSql = (
  sqlText,
  { expectedRows = 5, requireDistinctCategories = true } = {}
) => {
  const valueBlocks = extractValuesBlocks(sqlText);
  const categories = new Set();

  if (valueBlocks.length !== Number(expectedRows)) {
    throw new Error(`Expected ${expectedRows} debate rows in SQL, received ${valueBlocks.length}`);
  }

  for (const block of valueBlocks) {
    const quoted = extractQuotedValues(block);

    if (quoted.length < 15) {
      throw new Error("A debate row does not contain the expected quoted values");
    }

    const title = sanitizeText(quoted[0]);
    const question = sanitizeText(quoted[1]);
    const cardSummary = sanitizeText(quoted[2]);
    const debateContext = sanitizeText(quoted[3]);
    const category = sanitizeText(quoted[4]).toLowerCase();

    if (!title) throw new Error("A debate row is missing title");
    if (FORBIDDEN_TITLE_PREFIXES.some((prefix) => title.toLowerCase().startsWith(prefix))) {
      throw new Error(`Forbidden title prefix detected in debate title: ${title}`);
    }
    if (title.length < 18) throw new Error(`Debate title is too short to be useful: ${title}`);
    if (hasRoboticEditorialTone(title)) {
      throw new Error(`Debate title sounds templated or robotic: ${title}`);
    }
    if (!looksQuestionLike(question)) {
      throw new Error(`Debate question is too weak or malformed: ${question}`);
    }
    if (hasRoboticEditorialTone(question)) {
      throw new Error(`Debate question sounds templated or robotic: ${question}`);
    }
    if (cardSummary.length < 75 || cardSummary.length > 240) {
      throw new Error(`card_summary must be between 75 and 240 characters, received ${cardSummary.length}`);
    }
    if (hasRoboticEditorialTone(cardSummary)) {
      throw new Error("card_summary sounds templated or robotic");
    }
    if (debateContext.length < 260 || debateContext.length > 1400) {
      throw new Error(`debate_context must be between 260 and 1400 characters, received ${debateContext.length}`);
    }
    if (hasRoboticEditorialTone(debateContext)) {
      throw new Error("debate_context sounds templated or robotic");
    }
    if (!DEBATE_ALLOWED_CATEGORIES.includes(category)) {
      throw new Error(`Invalid debate category detected: ${category}`);
    }

    categories.add(category);
  }

  if (requireDistinctCategories && categories.size !== Number(expectedRows)) {
    throw new Error(
      `Final debates must contain ${expectedRows} different categories, received ${categories.size}`
    );
  }
};

const normalizeCategory = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return DEBATE_ALLOWED_CATEGORIES.includes(normalized) ? normalized : null;
};

export const assertEditorialDebatesPayload = (
  debates,
  { expectedRows = 5, requireDistinctCategories = true } = {}
) => {
  if (!Array.isArray(debates)) {
    throw new Error("Debates payload must be an array");
  }

  if (debates.length !== Number(expectedRows)) {
    throw new Error(`Expected ${expectedRows} debates in payload, received ${debates.length}`);
  }

  const categories = new Set();
  const newsItemIds = new Set();

  for (const debate of debates) {
    const title = sanitizeText(debate?.title);
    const question = sanitizeText(debate?.question);
    const cardSummary = sanitizeText(debate?.cardSummary);
    const debateContext = sanitizeText(debate?.debateContext);
    const category = normalizeCategory(debate?.category);
    const newsItemId = sanitizeText(debate?.newsItemId);

    if (!newsItemId) {
      throw new Error("Every generated debate must include newsItemId");
    }

    if (newsItemIds.has(newsItemId)) {
      throw new Error(`Duplicated newsItemId detected in generated debates: ${newsItemId}`);
    }

    newsItemIds.add(newsItemId);

    if (!title) throw new Error("A generated debate is missing title");
    if (FORBIDDEN_TITLE_PREFIXES.some((prefix) => title.toLowerCase().startsWith(prefix))) {
      throw new Error(`Forbidden title prefix detected in debate title: ${title}`);
    }
    if (title.length < 18) throw new Error(`Debate title is too short to be useful: ${title}`);
    if (hasRoboticEditorialTone(title)) {
      throw new Error(`Debate title sounds templated or robotic: ${title}`);
    }

    if (!looksQuestionLike(question)) {
      throw new Error(`Debate question is too weak or malformed: ${question}`);
    }
    if (hasRoboticEditorialTone(question)) {
      throw new Error(`Debate question sounds templated or robotic: ${question}`);
    }

    if (cardSummary.length < 75 || cardSummary.length > 240) {
      throw new Error(
        `cardSummary must be between 75 and 240 characters, received ${cardSummary.length}`
      );
    }
    if (hasRoboticEditorialTone(cardSummary)) {
      throw new Error("cardSummary sounds templated or robotic");
    }

    if (debateContext.length < 260 || debateContext.length > 1400) {
      throw new Error(
        `debateContext must be between 260 and 1400 characters, received ${debateContext.length}`
      );
    }
    if (hasRoboticEditorialTone(debateContext)) {
      throw new Error("debateContext sounds templated or robotic");
    }

    if (!category) {
      throw new Error(`Invalid debate category detected: ${debate?.category || "missing"}`);
    }

    categories.add(category);
  }

  if (requireDistinctCategories && categories.size !== Number(expectedRows)) {
    throw new Error(
      `Final debates must contain ${expectedRows} different categories, received ${categories.size}`
    );
  }
};
