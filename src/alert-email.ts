/**
 * Alert e-posta gönderimi — Resend API.
 */
import { Resend } from "resend";
import { loadEnv } from "./config.js";

export async function sendAlertEmail(
  messages: string[],
  env?: Record<string, string>
): Promise<{ success: boolean; detail: unknown }> {
  if (!messages.length) return { success: false, detail: "Boş uyarı listesi" };
  const e = env ?? loadEnv();
  const apiKey = (e.RESEND_API_KEY ?? "").trim();
  const fromEmail = (e.RESEND_FROM ?? "").trim();
  const toEmail = (e.RESEND_TO ?? "").trim();
  if (!apiKey) return { success: false, detail: "RESEND_API_KEY tanımlı değil" };
  if (!fromEmail) return { success: false, detail: "RESEND_FROM tanımlı değil" };
  if (!toEmail) return { success: false, detail: "RESEND_TO tanımlı değil" };
  const toList = toEmail.split(",").map((x) => x.trim()).filter(Boolean);
  if (!toList.length) return { success: false, detail: "RESEND_TO geçerli adres içermiyor" };
  const subject = `[Kripto İzleme] ${messages.length} uyarı`;
  const body = messages.map((m) => `• ${m}`).join("<br>") || "Uyarı tetiklendi.";
  const html = `<p><strong>Uyarılar:</strong></p><p>${body}</p>`;
  try {
    const resend = new Resend(apiKey);
    const out = await resend.emails.send({ from: fromEmail, to: toList, subject, html });
    return { success: true, detail: out };
  } catch (err) {
    return { success: false, detail: String(err) };
  }
}
