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

/**
 * Etiqueta del separador de dia dentro del feed: "Hoy", "Ayer" o la fecha.
 * Recibe la fecha en formato aaaa-mm-dd, tal como la manda la API.
 */
export const etiquetaDia = (dia) => {
  if (!dia) return "";

  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);

  const comoTexto = (fecha) =>
    `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(
      fecha.getDate()
    ).padStart(2, "0")}`;

  if (dia === comoTexto(hoy)) return "Hoy";
  if (dia === comoTexto(ayer)) return "Ayer";

  // Se construye a mediodia para que el cambio de huso no mueva el dia.
  const fecha = new Date(`${dia}T12:00:00`);
  if (Number.isNaN(fecha.getTime())) return dia;

  const mismoAno = fecha.getFullYear() === hoy.getFullYear();

  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    ...(mismoAno ? {} : { year: "numeric" })
  }).format(fecha);
};
