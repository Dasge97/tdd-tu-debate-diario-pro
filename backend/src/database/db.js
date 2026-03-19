import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME || "tdd_db",
  user: process.env.DB_USER || "tdd_user",
  password: process.env.DB_PASSWORD || "tdd_password",
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: false
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isTransientConnectionError = (error) =>
  ["PROTOCOL_CONNECTION_LOST", "ECONNRESET", "ETIMEDOUT", "EPIPE"].includes(error?.code);

export const query = async (text, params = [], retries = 2) => {
  try {
    const [rows] = await pool.query(text, params);
    return rows;
  } catch (error) {
    if (retries > 0 && isTransientConnectionError(error)) {
      await sleep(300);
      return query(text, params, retries - 1);
    }
    throw error;
  }
};

export const getConnection = async () => pool.getConnection();
