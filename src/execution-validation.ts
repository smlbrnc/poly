/**
 * Execution validation (Layer 3): min marj, likidite.
 */
export function checkMinMargin(profitUsd: number, minMarginUsd = 0.05): boolean {
  return Number(profitUsd) >= Number(minMarginUsd);
}

export function checkLiquidity(minVolumePerLegUsd: number, minLiquidity = 100): boolean {
  return Number(minVolumePerLegUsd) >= Number(minLiquidity);
}

export function passesExecutionValidation(
  profitUsd: number,
  minVolumePerLegUsd: number,
  minMarginUsd = 0.05,
  minLiquidityUsd = 100
): { passed: boolean; reason: string } {
  if (!checkMinMargin(profitUsd, minMarginUsd)) return { passed: false, reason: "profit < min_margin" };
  if (!checkLiquidity(minVolumePerLegUsd, minLiquidityUsd)) return { passed: false, reason: "liquidity < min" };
  return { passed: true, reason: "ok" };
}
