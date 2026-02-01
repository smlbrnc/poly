/**
 * Polymarket WebSocket: MARKET kanalı, asset_ids abonelik, exponential backoff ile yeniden bağlanma.
 */
import WebSocket from "ws";
import { loadYaml } from "./config.js";

const cfg = loadYaml("data_pipeline") as Record<string, unknown>;
const wsCfg = (cfg.websocket as Record<string, unknown>) ?? {};
const defaultUrl = (wsCfg.url as string) ?? "wss://ws-subscriptions-clob.polymarket.com/ws/market";
const delayMin = (wsCfg.reconnect_delay_min as number) ?? 1;
const delayMax = (wsCfg.reconnect_delay_max as number) ?? 60;
const maxAttempts = (wsCfg.reconnect_max_attempts as number) ?? 5;

export type OnMessage = (data: string | Buffer) => void;

/**
 * MARKET kanalına bağlanır, asset_ids ile abone olur. runSeconds süre çalışır.
 * Reconnect: exponential backoff, en fazla maxAttempts deneme.
 */
export function runWs(
  assetIds: string[],
  onMessage?: OnMessage,
  runSeconds: number = 60,
  url: string = defaultUrl
): Promise<string[]> {
  const received: string[] = [];
  let attempt = 0;
  let stopped = false;

  function delay(attemptIndex: number): number {
    return Math.min(delayMax, delayMin * Math.pow(2, attemptIndex - 1));
  }

  function connect(): Promise<void> {
    return new Promise((resolve) => {
      const ws = new WebSocket(url);
      ws.on("message", (data: string | Buffer) => {
        const s = typeof data === "string" ? data : data.toString();
        received.push(s);
        onMessage?.(data);
      });
      ws.on("error", () => {});
      ws.on("close", () => resolve());
      ws.on("open", () => {
        ws.send(JSON.stringify({ assets_ids: assetIds, type: "market" }));
      });
    });
  }

  const runner = async (): Promise<void> => {
    while (!stopped && attempt < maxAttempts) {
      try {
        await connect();
      } catch {
        // reconnect'te tekrar denenecek
      }
      attempt += 1;
      if (!stopped && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, delay(attempt) * 1000));
      }
    }
  };

  const timeout = new Promise<void>((resolve) => {
    setTimeout(() => {
      stopped = true;
      resolve();
    }, runSeconds * 1000);
  });

  Promise.race([runner(), timeout]).catch(() => {});
  return timeout.then(() => received);
}
