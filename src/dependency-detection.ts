/**
 * Bağımlılık tespiti: Gemini ile geçerli kombinasyonlar.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";

const PROMPT_TEMPLATE = `Aşağıda iki tahmin piyasası ve koşulları var. Geçerli sonuç kombinasyonlarını (hangi koşullar birlikte TRUE olabilir) JSON array olarak yaz.
Sadece JSON döndür, başka açıklama yazma.

Piyasa A: %s
  Koşullar: %s

Piyasa B: %s
  Koşullar: %s

Örnek çıktı formatı: [{"market_a_outcome": "X", "market_b_outcome": "Y"}, ...]
`;

export function buildPrompt(
  marketA: string,
  conditionsA: string,
  marketB: string,
  conditionsB: string
): string {
  return PROMPT_TEMPLATE.replace("%s", marketA)
    .replace("%s", conditionsA)
    .replace("%s", marketB)
    .replace("%s", conditionsB);
}

export async function callGemini(
  apiKey: string,
  model: string,
  prompt: string,
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const m = genAI.getGenerativeModel({
    model: model.startsWith("models/") ? model : `models/${model}`,
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      maxOutputTokens: options.maxTokens ?? 512,
    },
  });
  const result = await m.generateContent(prompt);
  const response = result.response;
  const text = response.text();
  return (text || "").trim();
}

export function parseCombinations(text: string): Array<{ market_a_outcome?: string; market_b_outcome?: string }> {
  let raw = (text || "").trim();
  const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) raw = jsonMatch[1].trim();
  else {
    const codeMatch = raw.match(/```\s*([\s\S]*?)```/);
    if (codeMatch) raw = codeMatch[1].trim();
  }
  try {
    const out = JSON.parse(raw) as unknown;
    return Array.isArray(out) ? out : [];
  } catch {
    return [];
  }
}

export function isDependent(
  combinations: Array<unknown>,
  nA: number,
  nB: number
): boolean {
  if (!combinations.length) return true;
  return combinations.length < nA * nB;
}

const VALID_OUTCOMES = new Set(["Evet", "Hayır", "Yes", "No", "yes", "no"]);

/** Makale: (1) Exactly one TRUE per outcome per market. Sadece geçerli Evet/Hayır kombinasyonlarını döndür. */
export function validateExactlyOnePerMarket(
  combinations: Array<{ market_a_outcome?: string; market_b_outcome?: string }>
): Array<{ market_a_outcome?: string; market_b_outcome?: string }> {
  return combinations.filter(
    (c) =>
      VALID_OUTCOMES.has(String(c.market_a_outcome ?? "").trim()) &&
      VALID_OUTCOMES.has(String(c.market_b_outcome ?? "").trim())
  );
}

/** Makale: (2) Fewer than n×m = dependency. (3) Arbitraj LP ile. nA=nB=2 binary. */
export function validateDependencyAndArbitrage(
  combinations: Array<{ market_a_outcome?: string; market_b_outcome?: string }>,
  nA: number,
  nB: number
): { valid: boolean; dependent: boolean } {
  const filtered = validateExactlyOnePerMarket(combinations);
  const hasValidStructure = filtered.length > 0;
  const dependent = hasValidStructure && isDependent(filtered, nA, nB);
  return { valid: hasValidStructure, dependent };
}
