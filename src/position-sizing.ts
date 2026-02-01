/**
 * Pozisyon büyüklüğü: OB derinliğinin cap_pct ile sınırlama.
 */
export function sizeFromOrderbookDepth(
  depthPerLegUsd: number | number[],
  capPct = 50,
  maxUsd?: number
): number {
  const depths = Array.isArray(depthPerLegUsd) ? depthPerLegUsd : [Number(depthPerLegUsd)];
  if (!depths.length) return 0;
  const capMult = capPct / 100;
  let size = Math.min(...depths.map((d) => d * capMult));
  if (maxUsd != null && size > maxUsd) size = maxUsd;
  return Math.max(0, size);
}
