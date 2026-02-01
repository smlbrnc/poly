/**
 * Layer 1 (LCMM): Arbitraj var/yok kontrolü.
 * Min maliyet < 1 ise arbitraj var. javascript-lp-solver kullanır.
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const solver = require("javascript-lp-solver");

export function checkArbitrage(
  pricesOutcomes: Record<string, number>,
  validCombinations: Array<{ market_a_outcome?: string; market_b_outcome?: string }>,
  _timeout = 0.1
): { hasArbitrage: boolean; minCost: number } {
  const keys = Object.keys(pricesOutcomes);
  const n = keys.length;
  const prices = keys.map((k) => Number(pricesOutcomes[k]));

  const AList: number[][] = [];
  for (const combo of validCombinations) {
    const row: number[] = [];
    for (const k of keys) {
      const kLower = k.toLowerCase();
      let val = 0;
      if (kLower.includes("yes") && kLower.includes("market_a") && combo.market_a_outcome === "Evet") val = 1;
      else if (kLower.includes("no") && kLower.includes("market_a") && combo.market_a_outcome === "Hayır") val = 1;
      else if (kLower.includes("yes") && kLower.includes("market_b") && combo.market_b_outcome === "Evet") val = 1;
      else if (kLower.includes("no") && kLower.includes("market_b") && combo.market_b_outcome === "Hayır") val = 1;
      row.push(val);
    }
    AList.push(row);
  }
  if (!AList.length) return { hasArbitrage: false, minCost: 1 };

  const constraints: Record<string, { min: number }> = {};
  for (let i = 0; i < AList.length; i++) constraints[`c${i}`] = { min: 1 };

  const variables: Record<string, Record<string, number>> = {};
  for (let j = 0; j < n; j++) {
    const v: Record<string, number> = { cost: prices[j] };
    for (let i = 0; i < AList.length; i++) v[`c${i}`] = AList[i][j];
    variables[`x${j}`] = v;
  }

  const model = {
    optimize: "cost",
    opType: "min",
    constraints,
    variables,
  };
  const results = solver.Solve(model);
  const minCost = results.feasible === true ? Number(results.result ?? 1) : 1;
  return { hasArbitrage: minCost < 0.999, minCost };
}
