/**
 * Tek seferlik arbitraj pipeline: Gamma API kripto event'leri → Gemini bağımlılık → Layer 1 LP → kuyruk.
 */
import { loadYaml, loadEnv } from "../config.js";
import {
  fetchCryptoEvents,
  groupEventsByAsset,
  getMarketPrices,
  getMarketLiquidityUsd,
  type GammaEvent,
  type GammaMarket,
} from "../polymarket-gamma.js";
import { buildPrompt, callGemini, parseCombinations, validateDependencyAndArbitrage } from "../dependency-detection.js";
import { checkArbitrage } from "../optimization-layer1.js";
import { add } from "../manual-review-queue.js";
import { recordPipelineRun, recordEvent } from "../monitoring.js";
import { appendToAudit } from "../audit-log.js";

function getBinaryMarkets(event: GammaEvent): GammaMarket[] {
  const out: GammaMarket[] = [];
  for (const m of event.markets ?? []) {
    if (!m.outcomePrices || !m.clobTokenIds) continue;
    try {
      const prices = JSON.parse(m.outcomePrices) as string[];
      const tokens = JSON.parse(m.clobTokenIds) as string[];
      if (prices.length >= 2 && tokens.length >= 2) out.push(m);
    } catch {
      // skip
    }
  }
  return out;
}

function outcomesText(m: GammaMarket): string {
  try {
    const o = (m.outcomes ? JSON.parse(m.outcomes) : ["Yes", "No"]) as string[];
    return (o[0] ?? "Yes") + " / " + (o[1] ?? "No");
  } catch {
    return "Yes / No";
  }
}

function buildPricesOutcomes(mA: GammaMarket, mB: GammaMarket): Record<string, number> {
  const pA = getMarketPrices(mA);
  const pB = getMarketPrices(mB);
  return {
    "yes market_a": pA.yes,
    "no market_a": pA.no,
    "yes market_b": pB.yes,
    "no market_b": pB.no,
  };
}

async function main(): Promise<void> {
  recordPipelineRun("started", "Gamma + Gemini + Layer1");

  const env = loadEnv();
  const apiKey = env.GOOGLE_GEMINI_API_KEY ?? env.GEMINI_API_KEY ?? process.env.GOOGLE_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    recordPipelineRun("error", "GOOGLE_GEMINI_API_KEY / GEMINI_API_KEY yok");
    console.error("GOOGLE_GEMINI_API_KEY veya GEMINI_API_KEY gerekli");
    process.exit(1);
  }

  const risk = loadYaml("risk_params") as Record<string, unknown>;
  const depCfg = loadYaml("dependency_detection") as Record<string, unknown>;
  const llm = (depCfg?.llm as Record<string, unknown>) ?? {};
  const model = String(llm.model ?? "gemini-2.0-flash");
  const minMarginUsd = Number(risk?.min_profit_margin_usd ?? 0.05);
  const refSizeUsd = Number(risk?.ref_size_usd ?? 100);
  const minLiqUsd = Number(risk?.min_liquidity_per_leg_usd ?? 100);

  let events: GammaEvent[];
  try {
    events = await fetchCryptoEvents(150);
  } catch (e) {
    recordPipelineRun("error", String(e));
    console.error("Gamma API hatası:", e);
    process.exit(1);
  }

  const { btc, eth, sol } = groupEventsByAsset(events);
  const groups = [
    { name: "btc", list: btc },
    { name: "eth", list: eth },
    { name: "sol", list: sol },
  ];

  let added = 0;
  for (const g of groups) {
    const list = g.list.slice(0, 5);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const eA = list[i];
        const eB = list[j];
        const marketsA = getBinaryMarkets(eA);
        const marketsB = getBinaryMarkets(eB);
        if (!marketsA.length || !marketsB.length) continue;

        const mA = marketsA[0];
        const mB = marketsB[0];
        if (getMarketLiquidityUsd(mA) < minLiqUsd || getMarketLiquidityUsd(mB) < minLiqUsd) continue;

        const prompt = buildPrompt(
          mA.question ?? mA.id,
          outcomesText(mA),
          mB.question ?? mB.id,
          outcomesText(mB)
        );
        let text: string;
        try {
          text = await callGemini(apiKey, model, prompt);
        } catch (err) {
          appendToAudit("pipeline_gemini_error", { pair: `${eA.id}-${eB.id}`, err: String(err) });
          continue;
        }

        let combinations = parseCombinations(text);
        const norm = (s: string) => (/^yes$/i.test(s.trim()) ? "Evet" : /^no$/i.test(s.trim()) ? "Hayır" : s);
        combinations = combinations.map((c) => ({
          market_a_outcome: c.market_a_outcome ? norm(String(c.market_a_outcome)) : undefined,
          market_b_outcome: c.market_b_outcome ? norm(String(c.market_b_outcome)) : undefined,
        }));
        const { valid, dependent } = validateDependencyAndArbitrage(combinations, 2, 2);
        if (!valid || !dependent) continue;

        const pricesOutcomes = buildPricesOutcomes(mA, mB);
        const { hasArbitrage, minCost } = checkArbitrage(pricesOutcomes, combinations);
        if (!hasArbitrage) continue;

        const profitUsd = (1 - minCost) * refSizeUsd;
        if (profitUsd < minMarginUsd) continue;

        let tokenA: string;
        let tokenB: string;
        try {
          const idsA = JSON.parse(mA.clobTokenIds!) as string[];
          const idsB = JSON.parse(mB.clobTokenIds!) as string[];
          tokenA = idsA[0] ?? "";
          tokenB = idsB[0] ?? "";
        } catch {
          continue;
        }

        const id = add({
          market_a: (mA.question ?? mA.id).slice(0, 200),
          market_b: (mB.question ?? mB.id).slice(0, 200),
          market_a_id: tokenA,
          market_b_id: tokenB,
          min_cost: minCost,
          profit_usd: profitUsd,
          asset: g.name,
        });
        recordEvent("pipeline_queue_add", { id, asset: g.name, profit_usd: profitUsd });
        appendToAudit("pipeline_queue_add", { id, market_a: String(mA.question).slice(0, 80), profit_usd: profitUsd });
        added++;
      }
    }
  }

  recordPipelineRun("completed", `Kuyruğa ${added} kayıt eklendi`);
}

main().catch((e) => {
  recordPipelineRun("error", String(e));
  console.error(e);
  process.exit(1);
});
