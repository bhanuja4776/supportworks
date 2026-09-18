// Firestore-backed replacement for the /bank/* REST endpoints. CSV parsing
// and amount/date normalisation ported from server.py:2639-2712
// (_norm_bank_date, _to_float, _parse_bank_csv); invoice-matching ported
// from _suggest_match (server.py:2715-2730). No external service involved
// — CSV text already arrives fully client-side (pasted or file-read), so
// this was always a pure data-transform feature, not one that needed a
// backend at all.
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, writeBatch, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/src/firebase/firestore";
import { currentFirebaseUser } from "@/src/firebase/auth";

function requireUid(): string {
  const u = currentFirebaseUser();
  if (!u) throw new Error("Not signed in");
  return u.uid;
}
function toPlain(data: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) out[k] = v instanceof Timestamp ? v.toDate().toISOString() : v;
  return out;
}
function docOut(id: string, data: Record<string, any>): Record<string, any> {
  return { id, ...toPlain(data) };
}

// ---------- CSV parsing ----------

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => (c || "").trim()));
}

function toFloat(v: string): number {
  let s = (v || "").trim().replace(/\$/g, "").replace(/,/g, "");
  const neg = s.startsWith("(") && s.endsWith(")");
  s = s.replace(/^\(|\)$/g, "");
  const f = parseFloat(s || "0");
  if (isNaN(f)) return 0;
  return neg ? -f : f;
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function normBankDate(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "";
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) {
    const [, a, b, y] = m;
    const bi = parseInt(b, 10), ai = parseInt(a, 10);
    if (bi <= 12) return `${y}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`; // d/m/Y
    if (ai <= 12) return `${y}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`; // m/d/Y fallback
  }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})(?!\d)/);
  if (m) {
    const yy = parseInt(m[3], 10);
    const yyyy = yy < 70 ? 2000 + yy : 1900 + yy;
    return `${yyyy}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (m) {
    const mon = MONTHS[m[2].toLowerCase().slice(0, 3)];
    if (mon) return `${m[3]}-${mon}-${m[1].padStart(2, "0")}`;
  }
  return s.slice(0, 10);
}

function findCol(header: string[], keys: string[]): number | null {
  for (let i = 0; i < header.length; i++) {
    if (keys.some((k) => header[i].includes(k))) return i;
  }
  return null;
}

type ParsedTxn = { date: string; description: string; amount: number };

function parseBankCsv(text: string): ParsedTxn[] {
  const data = parseCsvRows(text);
  if (data.length === 0) return [];
  const header = data[0].map((h) => (h || "").trim().toLowerCase());
  const hasHeader = header.some((h) =>
    ["date", "amount", "description", "narrative", "debit", "credit", "details", "memo"].some((k) => h.includes(k)));

  let di: number | null, ai: number | null, creditI: number | null, debitI: number | null, descI: number | null, start: number;
  if (hasHeader) {
    di = findCol(header, ["date"]) ?? 0;
    ai = findCol(header, ["amount"]);
    creditI = findCol(header, ["credit"]);
    debitI = findCol(header, ["debit"]);
    descI = findCol(header, ["description", "narrative", "details", "transaction", "memo", "reference"]);
    start = 1;
  } else {
    di = 0; ai = null; creditI = null; debitI = null; descI = 1; start = 0;
  }

  const out: ParsedTxn[] = [];
  for (const r of data.slice(start)) {
    if (r.length < 2) continue;
    const date = di !== null && di < r.length ? r[di].trim() : "";
    let desc = descI !== null && descI < r.length ? r[descI].trim() : "";
    let amt = 0;
    if (ai !== null && ai < r.length && r[ai].trim()) {
      amt = toFloat(r[ai]);
    } else if (creditI !== null || debitI !== null) {
      const cr = creditI !== null && creditI < r.length ? toFloat(r[creditI]) : 0;
      const de = debitI !== null && debitI < r.length ? toFloat(r[debitI]) : 0;
      amt = cr - de;
    } else {
      for (let i = r.length - 1; i >= 0; i--) {
        const f = toFloat(r[i]);
        if (f) { amt = f; break; }
      }
    }
    if (!desc && r.length > 1) desc = r[1].trim();
    out.push({ date: normBankDate(date), description: desc, amount: Math.round(amt * 100) / 100 });
  }
  return out;
}

// ---------- Matching ----------

async function suggestMatch(uid: string, txn: ParsedTxn): Promise<{ id: string; invoice_number: string } | null> {
  if (txn.amount <= 0) return null;
  const snap = await getDocs(query(collection(db, "invoices"), where("ownerId", "==", uid)));
  const outstanding = snap.docs
    .map((d) => docOut(d.id, d.data()))
    .filter((i) => i.status === "unpaid" || i.status === "draft");
  const desc = (txn.description || "").toLowerCase();
  let best: { score: number; inv: any } | null = null;
  for (const inv of outstanding) {
    const total = Math.round((Number(inv.total) || 0) * 100) / 100;
    if (Math.abs(total - txn.amount) > 0.01) continue;
    const num = (inv.invoice_number || "").toLowerCase();
    const score = num && desc.includes(num) ? 2 : 1;
    if (!best || score > best.score) best = { score, inv };
  }
  return best ? { id: best.inv.id, invoice_number: best.inv.invoice_number || "" } : null;
}

// ---------- CRUD ----------

export async function bankImport(csvText: string): Promise<{ imported: number; transactions: any[] }> {
  const uid = requireUid();
  const parsed = parseBankCsv(csvText);
  const inserted: any[] = [];
  for (const p of parsed) {
    const match = await suggestMatch(uid, p);
    const doc_ = {
      date: p.date, description: p.description, amount: p.amount,
      selected: true, status: "unmatched",
      suggested_invoice_id: match?.id || "", suggested_invoice_number: match?.invoice_number || "",
      matched_invoice_id: "",
      ownerId: uid, created_at: Timestamp.now(),
    };
    const ref = await addDoc(collection(db, "bankTransactions"), doc_);
    inserted.push(docOut(ref.id, doc_));
  }
  return { imported: inserted.length, transactions: inserted };
}

export async function bankTransactions(): Promise<any[]> {
  const uid = requireUid();
  const snap = await getDocs(query(collection(db, "bankTransactions"), where("ownerId", "==", uid)));
  const items = snap.docs.map((d) => docOut(d.id, d.data())).filter((t) => t.status !== "ignored");
  items.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  return items;
}

export async function bankUpdateTxn(id: string, body: Record<string, any>): Promise<{ success: true }> {
  const update: Record<string, any> = {};
  if (body.selected !== undefined) update.selected = body.selected;
  if (body.status !== undefined) update.status = body.status;
  await updateDoc(doc(db, "bankTransactions", id), update);
  return { success: true };
}

export async function bankReconcile(id: string, invoiceId?: string): Promise<{ success: true; invoice_id: string }> {
  const txnSnap = await getDoc(doc(db, "bankTransactions", id));
  if (!txnSnap.exists()) throw new Error("Transaction not found");
  const txn = txnSnap.data() as Record<string, any>;
  const invId = invoiceId || txn.suggested_invoice_id || "";
  if (!invId) throw new Error("No invoice to reconcile against");
  const invRef = doc(db, "invoices", invId);
  const invSnap = await getDoc(invRef);
  if (!invSnap.exists()) throw new Error("Invoice not found");
  await updateDoc(invRef, { status: "paid" });
  await updateDoc(doc(db, "bankTransactions", id), { status: "matched", matched_invoice_id: invId });
  return { success: true, invoice_id: invId };
}

export async function bankClear(): Promise<{ success: true }> {
  const uid = requireUid();
  const snap = await getDocs(query(collection(db, "bankTransactions"), where("ownerId", "==", uid)));
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return { success: true };
}
