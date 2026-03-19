import fs from "node:fs/promises";

const providerId = process.env.OPENCODE_PROVIDER_ID || "opencode";
const providerName = process.env.OPENCODE_PROVIDER_NAME || "OpenCode";
const providerNpm = process.env.OPENCODE_PROVIDER_NPM || "__builtin__";
const baseUrl = process.env.OPENCODE_BASE_URL || "";
const apiKeyRef = process.env.MINIMAX_API_KEY
  ? "{env:MINIMAX_API_KEY}"
  : process.env.OPENCODE_API_KEY
    ? "{env:OPENCODE_API_KEY}"
    : "";
const modelId = process.env.OPENCODE_MODEL_ID || "minimax-m2.5-free";
const configPath = "/workspace/opencode.json";

const isBuiltinProvider = providerNpm === "__builtin__";

const config = {
  $schema: "https://opencode.ai/config.json",
  share: "disabled",
  permission: {
    "*": "deny"
  },
  model: `${providerId}/${modelId}`,
  small_model: `${providerId}/${modelId}`
};

if (!isBuiltinProvider) {
  config.provider = {
    [providerId]: {
      npm: providerNpm,
      name: providerName,
      options: {
        ...(baseUrl ? { baseURL: baseUrl } : {}),
        ...(apiKeyRef ? { apiKey: apiKeyRef } : {})
      },
      models: {
        [modelId]: {
          name: modelId
        }
      }
    }
  };
}

await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Generated opencode config at ${configPath}`);
