// Client-side invoice PDF generation. Replaces the old backend's
// GET /invoices/{id}/pdf (ReportLab, backend/server.py:1858-2064). PDF
// rendering is pure layout over data the client already has — no secret
// key, no server-only capability — so this stays entirely client-side per
// the migration's "don't introduce a backend/Cloud Function unless
// genuinely necessary" instruction. Uses expo-print (native HTML→PDF
// rendering, no server involved) instead of writing a new PDF format.
//
// The HTML below mirrors the original ReportLab layout field-for-field
// (same header styles, same BILL TO / INVOICE meta block, same line-item
// table columns and per-line "Delivered:"/time/GST-free annotations, same
// totals block, notes, and payment-details footer) — it is a direct port,
// not a redesign. It was cross-checked against
// app/(tabs)/invoice/preview/[id].tsx, the RN screen the original
// developers built specifically to preview this same PDF in-app.
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { money, toDMY } from "@/src/api";

const MGMT_LABEL: Record<string, string> = {
  self_managed: "Self-managed",
  plan_managed: "Plan-managed",
  ndia_managed: "NDIA-managed",
};

function esc(s: any): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmtQty(q: any): string {
  const n = Number(q) || 0;
  return Number.isInteger(n) ? String(n) : String(n).replace(/0+$/, "").replace(/\.$/, "");
}

export function buildInvoiceHtml(inv: Record<string, any>, settings: Record<string, any> | null): string {
  const biz = { ...(settings || {}), ...(inv.business || {}) };
  const accent = biz.invoice_theme || "#0A6B7D";
  const style = String(biz.invoice_style || "modern").toLowerCase();
  const mgmt = String(inv.management_type || "self_managed").toLowerCase();
  const isPlan = mgmt === "plan_managed";
  const dark = "#0F2A32";
  const muted = "#5B7683";
  const tint = "#F0F7F9";

  const bizLines = [
    biz.abn ? `ABN: ${esc(biz.abn)}` : "",
    biz.address ? esc(biz.address) : "",
    biz.email ? esc(biz.email) : "",
    biz.phone ? esc(biz.phone) : "",
  ].filter(Boolean);
  const bizName = esc(biz.business_name || "Your Business");
  const logoImg = biz.logo_base64
    ? `<img src="data:image/png;base64,${biz.logo_base64}" style="max-width:180px;max-height:70px;object-fit:contain" />`
    : "";

  let headerHtml = "";
  if (style === "modern") {
    headerHtml = `
      <table class="head-band" style="background:${accent}"><tr>
        <td>${logoImg || `<span class="band-biz">${bizName}</span>`}</td>
        <td class="band-title">TAX INVOICE</td>
      </tr></table>
      <div class="biz-block">
        <div class="biz-name">${bizName}</div>
        ${bizLines.length ? `<div class="biz-meta">${bizLines.join("<br/>")}</div>` : ""}
      </div>`;
  } else if (style === "classic") {
    headerHtml = `
      <table class="head-classic" style="border-bottom-color:${accent}"><tr>
        <td>${logoImg}</td>
        <td class="classic-title" style="color:${accent}">TAX INVOICE</td>
      </tr></table>
      <div class="biz-block">
        <div class="biz-name">${bizName}</div>
        ${bizLines.length ? `<div class="biz-meta">${bizLines.join("<br/>")}</div>` : ""}
      </div>`;
  } else {
    headerHtml = `
      ${logoImg ? `<div style="margin-bottom:6px">${logoImg}</div>` : ""}
      <div class="minimal-title" style="color:${accent}">TAX INVOICE</div>
      <div class="biz-block">
        <div class="biz-name">${bizName}</div>
        ${bizLines.length ? `<div class="biz-meta">${bizLines.join("<br/>")}</div>` : ""}
      </div>
      <div class="minimal-rule" style="background:${accent}"></div>`;
  }

  const billToLines: string[] = [`<b>${esc(inv.client_name || "Participant")}</b>`];
  if (inv.client_company) billToLines.push(esc(inv.client_company));
  if (inv.participant_ndis_number) billToLines.push(`NDIS: ${esc(inv.participant_ndis_number)}`);
  if (inv.client_address) billToLines.push(esc(inv.client_address));
  if (inv.client_email) billToLines.push(esc(inv.client_email));
  if (isPlan) {
    billToLines.push("");
    billToLines.push("<b>Send to plan manager:</b>");
    if (inv.plan_manager_name) billToLines.push(esc(inv.plan_manager_name));
    if (inv.plan_manager_email) billToLines.push(`<span style="color:${accent};font-weight:bold">${esc(inv.plan_manager_email)}</span>`);
  }

  const metaLines: string[] = [
    `<b>${esc(inv.invoice_number)}</b>`,
    `Issued: ${esc(toDMY(inv.issue_date) || "—")}`,
    `Sent: ${esc(toDMY(inv.sent_date) || "—")}`,
    `Due: ${esc(toDMY(inv.due_date) || "—")}`,
    `Status: ${esc(String(inv.status || "unpaid").toUpperCase())}`,
    `Plan type: ${esc(MGMT_LABEL[mgmt] || "Self-managed")}`,
  ];
  if (inv.ttp) metaLines.push("Claim type: TTP (Temporary Transformation Payment)");

  const itemRows = (inv.items || []).map((it: any, i: number) => {
    const lineDate = it.service_date || inv.service_date || "";
    const metaBits: string[] = [];
    if (lineDate) metaBits.push(`Delivered: ${toDMY(lineDate)}`);
    if (it.start_time && it.end_time) metaBits.push(`${it.start_time}–${it.end_time}`);
    else if (it.start_time) metaBits.push(`From ${it.start_time}`);
    if (it.gst_free) metaBits.push("GST-free");
    const descSub = metaBits.length
      ? `<br/><span class="td-sub">${metaBits.map(esc).join(" · ")}</span>` : "";
    return `<tr style="background:${i % 2 === 1 ? tint : "#fff"}">
      <td class="td-desc">${esc(it.description || "—")}${descSub}</td>
      <td>${esc(it.ndis_code || "—")}</td>
      <td class="right">${fmtQty(it.quantity)}</td>
      <td class="right">${money(it.rate)}</td>
      <td class="right">${money(it.amount)}</td>
    </tr>`;
  }).join("");

  const gstVal = Number(inv.gst) || 0;
  const gstLabel = gstVal ? "GST (10%)" : "GST (GST-free supports)";

  const payLines: string[] = [];
  if (biz.bank_name || biz.account_number || biz.account_name) {
    payLines.push("<b>Payment details</b>");
    if (biz.account_name) payLines.push(`Account name: ${esc(biz.account_name)}`);
    if (biz.bank_name) payLines.push(`Bank: ${esc(biz.bank_name)}`);
    if (biz.bsb) payLines.push(`BSB: ${esc(biz.bsb)}`);
    if (biz.account_number) payLines.push(`Account: ${esc(biz.account_number)}`);
  }

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: ${dark}; font-size: 9.5pt; margin: 0; }
  table { width: 100%; border-collapse: collapse; }
  .head-band td { vertical-align: middle; padding: 12px; }
  .head-band td:first-child { color: #fff; }
  .band-biz { color: #fff; font-size: 15px; font-weight: bold; }
  .band-title { color: #fff; font-size: 24px; font-weight: bold; text-align: right; letter-spacing: 1px; }
  .head-classic td { vertical-align: middle; padding-bottom: 8px; border-bottom: 1.4px solid; }
  .classic-title { font-size: 24px; font-weight: bold; text-align: right; letter-spacing: 1px; }
  .minimal-title { font-size: 22px; font-weight: bold; letter-spacing: 1px; }
  .minimal-rule { height: 2px; margin-top: 4px; margin-bottom: 8px; }
  .biz-block { margin-top: 10px; margin-bottom: 6px; }
  .biz-name { font-size: 13px; font-weight: bold; color: ${dark}; margin-bottom: 3px; }
  .biz-meta { font-size: 9px; color: ${muted}; line-height: 1.4; }
  .meta-table td { vertical-align: top; padding-top: 3px; font-size: 9.5pt; line-height: 1.5; }
  .meta-label { font-size: 8px; font-weight: bold; letter-spacing: 1px; color: ${accent}; padding-bottom: 2px; }
  .items { margin-top: 14px; }
  .items th { background: ${accent}; color: #fff; font-size: 9px; font-weight: bold; text-align: left; padding: 7px; }
  .items td { padding: 7px; font-size: 9px; border-bottom: 0.4px solid #D8E6EA; vertical-align: middle; }
  .items .right, .items th.right { text-align: right; }
  .td-sub { font-size: 7px; color: ${muted}; }
  .totals { margin-top: 10px; width: 100%; }
  .totals td { padding: 4px 0; font-size: 10px; text-align: right; }
  .totals .total-row td { font-weight: bold; color: ${accent}; border-top: 1px solid ${accent}; font-size: 11px; padding-top: 6px; }
  .notes-label, .pay-label { font-size: 8px; font-weight: bold; letter-spacing: 1px; color: ${accent}; margin-bottom: 4px; }
  .notes-text { font-size: 9.5pt; line-height: 1.4; }
  .pay-block { margin-top: 16px; font-size: 9px; color: ${muted}; line-height: 1.5; }
</style></head>
<body>
  ${headerHtml}
  <table class="meta-table"><tr>
    <td style="width:57%">
      <div class="meta-label">${isPlan ? "BILL TO — PLAN MANAGER" : "BILL TO"}</div>
      ${billToLines.join("<br/>")}
    </td>
    <td style="width:43%">
      <div class="meta-label">INVOICE</div>
      ${metaLines.join("<br/>")}
    </td>
  </tr></table>

  <table class="items">
    <thead><tr>
      <th style="width:38%">Description</th>
      <th style="width:22%">NDIS Code</th>
      <th class="right" style="width:10%">Qty</th>
      <th class="right" style="width:14%">Rate</th>
      <th class="right" style="width:16%">Amount</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>

  <table class="totals">
    <tr><td style="width:84%">Subtotal</td><td style="width:16%">${money(inv.subtotal)}</td></tr>
    <tr><td>${gstLabel}</td><td>${money(inv.gst)}</td></tr>
    <tr class="total-row"><td>TOTAL DUE</td><td>${money(inv.total)}</td></tr>
  </table>

  ${inv.notes ? `<div style="margin-top:14px">
    <div class="notes-label">NOTES</div>
    <div class="notes-text">${esc(inv.notes).replace(/\n/g, "<br/>")}</div>
  </div>` : ""}

  ${payLines.length ? `<div class="pay-block">${payLines.join("<br/>")}</div>` : ""}
</body></html>`;
}

/**
 * Generates the invoice PDF and hands it to the user: on native, writes a
 * real file and opens the share sheet (mirrors the old shareGetFile flow);
 * on web, expo-print's printToFileAsync isn't available, so this opens the
 * browser's native print dialog (html already paginated for A4 print),
 * where "Save as PDF" produces the file — the standard web-native
 * equivalent, no backend involved either way.
 */
export async function shareInvoicePdf(inv: Record<string, any>, settings: Record<string, any> | null) {
  const html = buildInvoiceHtml(inv, settings);
  if (Platform.OS === "web") {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
  }
  return uri;
}
