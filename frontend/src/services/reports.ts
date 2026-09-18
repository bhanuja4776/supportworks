// Firestore-backed replacement for /reports/summary and /reports/export.
// Summary reduction ported verbatim from server.py:1775-1828 (Australian
// financial year: 1 Jul - 30 Jun, income = paid invoices only). Export
// switches from server-side openpyxl to client-side SheetJS (`xlsx`) —
// same columns, same file, no backend involved.
import * as XLSX from "xlsx";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/src/firebase/firestore";
import { currentFirebaseUser } from "@/src/firebase/auth";

function requireUid(): string {
  const u = currentFirebaseUser();
  if (!u) throw new Error("Not signed in");
  return u.uid;
}

function toPlain(data: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = v instanceof Timestamp ? v.toDate().toISOString() : v;
  }
  return out;
}
function docOut(id: string, data: Record<string, any>): Record<string, any> {
  return { id, ...toPlain(data) };
}
async function ownedDocs(uid: string, collectionName: string): Promise<any[]> {
  const snap = await getDocs(query(collection(db, collectionName), where("ownerId", "==", uid)));
  return snap.docs.map((d) => docOut(d.id, d.data()));
}
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

function currentFy(now: Date): number {
  return now.getUTCMonth() + 1 >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

const MONTH_LABELS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];

export async function summary(fy?: number): Promise<Record<string, any>> {
  const uid = requireUid();
  const [invoices, receipts] = await Promise.all([ownedDocs(uid, "invoices"), ownedDocs(uid, "receipts")]);
  const now = new Date();
  const year = fy ?? currentFy(now);
  const start = `${year}-07-01`;
  const end = `${year + 1}-06-30`;

  const dkey = (d: any, primary: string, fallback: string) => String(d[primary] || d[fallback] || "").slice(0, 10);
  const inFy = (d: any, primary: string, fallback: string) => {
    const k = dkey(d, primary, fallback);
    return !!k && k >= start && k <= end;
  };

  const invFy = invoices.filter((i) => inFy(i, "issue_date", "created_at"));
  const recFy = receipts.filter((r) => inFy(r, "date", "created_at"));
  const paid = invFy.filter((i) => i.status === "paid");

  const income = round2(paid.reduce((s, i) => s + (Number(i.total) || 0), 0));
  const gst_collected = round2(paid.reduce((s, i) => s + (Number(i.gst) || 0), 0));
  const expenses = round2(recFy.reduce((s, r) => s + (Number(r.total) || 0), 0));
  const gst_credits = round2(recFy.reduce((s, r) => s + (Number(r.gst) || 0), 0));

  const seq: [number, number][] = [
    [7, year], [8, year], [9, year], [10, year], [11, year], [12, year],
    [1, year + 1], [2, year + 1], [3, year + 1], [4, year + 1], [5, year + 1], [6, year + 1],
  ];
  const months = seq.map(([mn, yr], idx) => {
    const prefix = `${String(yr).padStart(4, "0")}-${String(mn).padStart(2, "0")}`;
    const minc = paid.reduce((s, i) => s + (String(i.issue_date || i.created_at || "").slice(0, 7) === prefix ? Number(i.total) || 0 : 0), 0);
    const mexp = recFy.reduce((s, r) => s + (String(r.date || r.created_at || "").slice(0, 7) === prefix ? Number(r.total) || 0 : 0), 0);
    return { label: MONTH_LABELS[idx], income: round2(minc), expenses: round2(mexp) };
  });

  return {
    fy: `${year}-${year + 1}`, fy_start: year,
    income, expenses, net: round2(income - expenses),
    gst_collected, gst_credits, gst_payable: round2(gst_collected - gst_credits),
    invoice_count: invFy.length, paid_count: paid.length, receipt_count: recFy.length,
    months,
  };
}

async function shareWorkbook(wb: XLSX.WorkBook, filename: string) {
  const base64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
  const path = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
  return path;
}

export async function exportInvoicesXlsx() {
  const uid = requireUid();
  const invoices = await ownedDocs(uid, "invoices");
  invoices.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  const rows = [
    ["Invoice", "Client", "Issue Date", "Status", "Subtotal", "GST", "Total"],
    ...invoices.map((i) => [i.invoice_number || "", i.client_name || "", i.issue_date || "", i.status || "", i.subtotal || 0, i.gst || 0, i.total || 0]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Invoices");
  return shareWorkbook(wb, "invoices.xlsx");
}

export async function exportReceiptsXlsx() {
  const uid = requireUid();
  const receipts = await ownedDocs(uid, "receipts");
  receipts.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const rows = [
    ["Date", "Merchant", "Category", "Payment", "GST", "Total"],
    ...receipts.map((r) => [r.date || "", r.merchant || "", r.category || "", r.payment_method || "", r.gst || 0, r.total || 0]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Receipts");
  return shareWorkbook(wb, "receipts.xlsx");
}
