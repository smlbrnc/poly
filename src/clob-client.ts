/** Polymarket CLOB: emir gönderme. EOA için POLYMARKET_USE_EOA=true; proxy için funder + signature_type. */
import type { ClobClient as ClobClientType } from "@polymarket/clob-client";
import type { TickSize } from "@polymarket/clob-client";

const VALID_TICK_SIZES: TickSize[] = ["0.1", "0.01", "0.001", "0.0001"];

function toTickSize(s: string): TickSize {
  if (VALID_TICK_SIZES.includes(s as TickSize)) return s as TickSize;
  return "0.001";
}

export async function getClient(env: Record<string, string>): Promise<ClobClientType | null> {
  const apiKey = env.POLYMARKET_API_KEY;
  const apiSecret = env.POLYMARKET_API_SECRET;
  const passphrase = env.POLYMARKET_PASSPHRASE;
  const privateKey = env.PRIVATE_KEY;
  if (!apiKey || !apiSecret || !passphrase || !privateKey) return null;
  try {
    const { ClobClient } = await import("@polymarket/clob-client");
    const { Wallet } = await import("@ethersproject/wallet");
    const host = env.POLYMARKET_CLOB_API_URL || "https://clob.polymarket.com";
    const chainId = parseInt(env.POLYGON_CHAIN_ID || "137", 10);
    const signer = new Wallet(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`);
    const signerAddress = await signer.getAddress();
    const useEoa = /^(true|1|yes)$/i.test((env.POLYMARKET_USE_EOA ?? "").trim());
    const funderAddress = useEoa ? signerAddress : (env.POLYMARKET_FUNDER_ADDRESS ?? "").trim() || signerAddress;
    const signatureType = useEoa ? 0 : (env.POLYMARKET_SIGNATURE_TYPE?.trim() ? parseInt(env.POLYMARKET_SIGNATURE_TYPE, 10) : 0);
    const creds = { key: apiKey, secret: apiSecret, passphrase };
    const client = new ClobClient(host, chainId, signer, creds, signatureType, funderAddress);
    return client as ClobClientType;
  } catch {
    return null;
  }
}

export async function placeOrderStub(
  env: Record<string, string>,
  tokenId: string,
  price: number,
  sizeUsd: number,
  side: "BUY" | "SELL" = "BUY"
): Promise<{ success: boolean; message: string }> {
  const client = await getClient(env);
  if (!client)
    return {
      success: false,
      message:
        "Polymarket API bilgileri eksik: POLYMARKET_API_KEY, POLYMARKET_API_SECRET, POLYMARKET_PASSPHRASE, PRIVATE_KEY.",
    };
  try {
    const { Side, OrderType } = await import("@polymarket/clob-client");
    const orderSide = side === "BUY" ? Side.BUY : Side.SELL;
    const priceSafe = Math.max(0.001, Math.min(0.999, price));
    const sizeShares = Math.max(1, Math.floor(sizeUsd / priceSafe));
    let tickSize: TickSize = "0.001";
    let negRisk = false;
    try {
      tickSize = toTickSize(await client.getTickSize(tokenId));
      negRisk = await client.getNegRisk(tokenId);
    } catch {
      // varsayılan
    }
    const resp = (await client.createAndPostOrder(
      { tokenID: tokenId, price: priceSafe, size: sizeShares, side: orderSide },
      { tickSize, negRisk },
      OrderType.GTC
    )) as { success?: boolean; errorMsg?: string; orderID?: string; status?: string };
    if (resp && resp.success === false) {
      const errMsg = resp.errorMsg ?? "Order rejected";
      return { success: false, message: errMsg };
    }
    const orderId = resp?.orderID ?? "";
    const status = resp?.status ?? "";
    return {
      success: true,
      message: `Emir gönderildi. orderID=${orderId} status=${status} (${sizeShares} pay, ${priceSafe})`,
    };
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string }; status?: number }; message?: string };
    const apiErr = err.response?.data?.error;
    const msg = apiErr ?? (e instanceof Error ? e.message : String(e));
    return { success: false, message: msg };
  }
}
