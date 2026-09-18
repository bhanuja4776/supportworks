// Client-side replacement for POST /reports/pdf (server.py:2086-2107) — a
// free-text progress-report PDF with no database read beyond the business
// name, ported to expo-print the same way invoice PDFs were (see
// src/pdf/invoicePdf.ts). DOCX generation (the old /reports/docx) has no
// client-side equivalent without adding a DOCX-writing dependency and stays
// explicitly deferred — the "Word" export button is hidden until that's
// picked up as its own piece of work.
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { getSettings } from "@/src/services/settings";

function esc(s: any): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function shareProgressReportPdf(opts: { title: string; client_name: string; date: string; body: string }) {
  const settings = await getSettings().catch(() => ({} as Record<string, any>));
  const html = `<!doctype html>
<html><head><meta charset="utf-8" /><style>
  @page { size: A4; margin: 20mm 18mm; }
  body { font-family: Helvetica, Arial, sans-serif; color: #1a1a1a; font-size: 10.5pt; }
  h1 { color: #0A6B7D; font-size: 22px; margin: 0 0 2px; }
  .biz { color: #5B7683; font-size: 9pt; margin-bottom: 16px; }
  p { line-height: 1.4; }
</style></head>
<body>
  <h1>${esc(opts.title)}</h1>
  <div class="biz">${esc(settings.business_name || "")}</div>
  <p><b>Participant:</b> ${esc(opts.client_name || "—")}</p>
  <p><b>Date:</b> ${esc(opts.date || "")}</p>
  <p>${esc(opts.body || "").replace(/\n/g, "<br/>")}</p>
</body></html>`;

  if (Platform.OS === "web") {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
  }
  return uri;
}
