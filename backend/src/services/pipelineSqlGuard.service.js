const FORBIDDEN_STATEMENTS = /\b(drop|alter|truncate|delete|update|create|grant|revoke)\b/i;
const ALLOWED_INSERT_TARGET = /\binsert\s+into\s+debates\b/i;

export const splitSqlStatements = (sqlText) => {
  const source = String(sqlText || "");
  const statements = [];
  let current = "";
  let inString = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    current += char;

    if (char === "'") {
      if (inString && nextChar === "'") {
        current += nextChar;
        index += 1;
        continue;
      }

      inString = !inString;
      continue;
    }

    if (char === ";" && !inString) {
      const statement = current.slice(0, -1).trim();
      if (statement) statements.push(statement);
      current = "";
    }
  }

  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements;
};

export const assertSafeDebatesSql = (sqlText, { expectedInserts = null } = {}) => {
  const trimmed = String(sqlText || "").trim();

  if (!trimmed) {
    throw new Error("The SQL file is empty");
  }

  if (!ALLOWED_INSERT_TARGET.test(trimmed)) {
    throw new Error("The SQL file must contain INSERT INTO debates");
  }

  if (FORBIDDEN_STATEMENTS.test(trimmed)) {
    throw new Error("The SQL file contains forbidden statements");
  }

  const statements = splitSqlStatements(trimmed);
  if (statements.length === 0) {
    throw new Error("The SQL file does not contain executable statements");
  }

  for (const statement of statements) {
    if (!ALLOWED_INSERT_TARGET.test(statement)) {
      throw new Error("The SQL file can only contain INSERT INTO debates statements");
    }
  }

  if (expectedInserts != null && statements.length !== Number(expectedInserts)) {
    throw new Error(
      `The SQL file must contain exactly ${expectedInserts} INSERT statements, received ${statements.length}`
    );
  }

  return statements;
};
