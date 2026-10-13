import { GoogleGenAI } from "@google/genai";

export const GEMINI_ROUTE = Object.freeze({
  PRO: "pro",
  FLASH: "flash",
});

const ROUTE_CONFIGURATION = Object.freeze({
  [GEMINI_ROUTE.PRO]: Object.freeze({ apiKeyEnvironment: "GEMINI_API_KEY" }),
  [GEMINI_ROUTE.FLASH]: Object.freeze({ apiKeyEnvironment: "GEMINI_FLASH_API_KEY" }),
});

export class GeminiClientConfigurationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "GeminiClientConfigurationError";
    this.code = code;
  }
}

export function createGeminiClient(
  route,
  { environment = process.env, Client = GoogleGenAI } = {},
) {
  const configuration = ROUTE_CONFIGURATION[route];
  if (!configuration) {
    throw new GeminiClientConfigurationError(
      "gemini_route_required",
      "An explicit Gemini route is required.",
    );
  }

  const apiKey = environment?.[configuration.apiKeyEnvironment];
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new GeminiClientConfigurationError(
      "gemini_route_not_configured",
      "The selected Gemini route is not configured.",
    );
  }

  return new Client({ apiKey });
}
