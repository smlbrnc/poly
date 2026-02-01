/**
 * Polymarket CLOB L2 API key türetir (Node tarafında — Python ile uyumlu değil, bu client ile emir atacaksak buradan türetin).
 * .env'de PRIVATE_KEY (0x + 64 hex) olmalı. Ana dizin polymarket/.env okunur.
 * Çıktıyı .env'e yapıştırın: POLYMARKET_API_KEY=... POLYMARKET_API_SECRET=... POLYMARKET_PASSPHRASE=...
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const parentEnvPath = join(ROOT, "..", ".env");
const localEnvPath = join(ROOT, ".env");

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const envPath of [parentEnvPath, localEnvPath]) {
    if (!existsSync(envPath)) continue;
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const [k, ...vParts] = t.split("=");
      const v = vParts.join("=").trim().replace(/^["']|["']$/g, "");
      out[k!.trim()] = v;
    }
  }
  return out;
}

async function main() {
  const env = loadEnv();
  const privateKey = (env.PRIVATE_KEY ?? "").trim();
  if (!privateKey) {
    console.error("HATA: PRIVATE_KEY tanımlı değil. .env'e ekleyin (Polygon cüzdanı private key).");
    process.exit(1);
  }
  const key = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  if (key.length !== 66) {
    console.error("HATA: PRIVATE_KEY 0x + 64 hex olmalı.");
    process.exit(1);
  }

  const { ClobClient } = await import("@polymarket/clob-client");
  const { Wallet } = await import("@ethersproject/wallet");
  const host = env.POLYMARKET_CLOB_API_URL || "https://clob.polymarket.com";
  const chainId = parseInt(env.POLYGON_CHAIN_ID || "137", 10);
  const signer = new Wallet(key);
  const client = new ClobClient(host, chainId, signer, undefined, undefined, undefined);
  const creds = await client.createOrDeriveApiKey();
  if (!creds?.key) {
    console.error("HATA: API key türetilemedi.");
    process.exit(1);
  }
  console.log("Polymarket CLOB'a bağlanıldı (L1). Node ile türetilen L2 credential'lar:\n");
  console.log("--- .env dosyasına aşağıdaki satırları ekleyin veya güncelleyin ---\n");
  console.log(`POLYMARKET_API_KEY=${creds.key}`);
  console.log(`POLYMARKET_API_SECRET=${creds.secret}`);
  console.log(`POLYMARKET_PASSPHRASE=${creds.passphrase}`);
  console.log("\n--- Node (dashboard/onayla) ile emir atarken bu key'i kullanın. POLYMARKET_USE_EOA=true bırakın. ---");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
