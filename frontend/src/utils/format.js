/** Formato de fechas y textos, siempre en español. */

const dateTimeFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "long",
  hour: "2-digit",
  minute: "2-digit"
});

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "long",
  year: "numeric"
});

const timeFormatter = new Intl.DateTimeFormat("es-ES", {
  hour: "2-digit",
  minute: "2-digit"
});

const parse = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDateTime = (value) => {
  const date = parse(value);
  return date ? dateTimeFormatter.format(date) : "";
};

export const formatDate = (value) => {
  const date = parse(value);
  return date ? dateFormatter.format(date) : "";
};

export const formatTime = (value) => {
  const date = parse(value);
  return date ? timeFormatter.format(date) : "";
};

/** "hace 5 min", "hace 2 h", "hace 3 d"; a partir de una semana, la fecha. */
export const formatRelative = (value) => {
  const date = parse(value);
  if (!date) return "";

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return "ahora";
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)} h`;
  if (seconds < 604800) return `hace ${Math.floor(seconds / 86400)} d`;

  return dateFormatter.format(date);
};

/** Separa el contexto de un debate en parrafos, descartando lineas vacias. */
export const toParagraphs = (text) =>
  String(text || "")
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

/** "1 voto" / "3 votos": evita el clásico "1 votos". */
export const plural = (count, singular, pluralForm) =>
  `${count} ${Number(count) === 1 ? singular : pluralForm}`;
