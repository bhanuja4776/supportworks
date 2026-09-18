// Firestore-backed replacement for the /invoices REST endpoints. Field
// names and defaults mirror backend/server.py's InvoiceItem/Invoice/
// InvoiceCreate models and create_invoice/edit_invoice/_create_shift_drafts
// handlers exactly (see server.py:101-170, 1053-1200, 2376-2408).
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, Timestamp, writeBatch, runTransaction,
} from "firebase/firestore";
import { db } from "@/src/firebase/firestore";
import { currentFirebaseUser } from "@/src/firebase/auth";
import { getSettings, businessSnapshot } from "@/src/services/settings";

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

const today = () => new Date().toISOString().slice(0, 10);

// ---------- Totals (mirrors compute_invoice_totals exactly) ----------

const GST_RATE = 0.10;

export type InvoiceItemIn = {
  description?: string; ndis_code?: string; quantity?: number | string; rate?: number | string;
  service_date?: string; start_time?: string; end_time?: string; gst_free?: boolean;
};

function computeInvoiceTotals(items: InvoiceItemIn[]) {
  let subtotal = 0;
  let gst = 0;
  const outItems = items.map((it) => {
    const quantity = Number(it.quantity ?? 1) || 0;
    const rate = Number(it.rate ?? 0) || 0;
    const gst_free = it.gst_free ?? true; // most NDIS supports are GST-free
    const amount = Math.round(quantity * rate * 100) / 100;
    subtotal += amount;
    if (!gst_free) gst += amount * GST_RATE;
    return {
      description: it.description || "", ndis_code: it.ndis_code || "",
      quantity, rate, amount,
      service_date: it.service_date || "", start_time: it.start_time || "", end_time: it.end_time || "",
      gst_free,
    };
  });
  subtotal = Math.round(subtotal * 100) / 100;
  gst = Math.round(gst * 100) / 100;
  const total = Math.round((subtotal + gst) * 100) / 100;
  return { items: outItems, subtotal, gst, total };
}

// ---------- Invoice numbering ----------
//
// The original Mongo implementation (_next_invoice_number, server.py:1031)
// scans every invoice in the org to find the max "INV-{n}", then reads/
// writes a counters doc — a defensive workaround BECAUSE the read-then-write
// wasn't wrapped in a transaction, so it was never actually safe against two
// truly concurrent requests. Firestore's runTransaction makes the
// read-increment-write atomic and auto-retries on contention, so the
// full-collection scan is no longer needed to stay safe — this is a
// deliberate, documented improvement in SAFETY, not a change in the visible
// numbering behaviour: same "INV-{n}" format, same start at 1001, same
// single always-incrementing-by-1 sequence per owner, numbers are still
// never reused (draft/cancelled/deleted invoices still consume a number,
// exactly like the original — the counter never rolls back on delete).
async function mintNextNumber(counterRef: ReturnType<typeof doc>): Promise<number> {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? Number(snap.data().lastInvoiceNumber) || 1000 : 1000;
    const next = current + 1;
    tx.set(counterRef, { lastInvoiceNumber: next }, { merge: true });
    return next;
  });
}

async function nextInvoiceNumber(uid: string): Promise<string> {
  const counterRef = doc(db, "counters", uid);
  // Firestore's runTransaction only auto-retries on version conflicts
  // ("aborted"). The counters rule's monotonic check (see firestore.rules)
  // means a losing racer's write is evaluated against fresh (not its own
  // stale-read) data and comes back "permission-denied", not "aborted" —
  // so that specific failure mode needs its own retry loop here, or two
  // genuinely simultaneous mints would throw instead of safely
  // serializing. Retrying re-reads the now-current value, so the retry
  // always succeeds once contention clears.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const seq = await mintNextNumber(counterRef);
      return `INV-${seq}`;
    } catch (e: any) {
      lastErr = e;
      if (e?.code !== "permission-denied") throw e;
      // Small jittered backoff so a large batch of racers doesn't retry in
      // lockstep and keep re-colliding on the same counter document.
      await new Promise((r) => setTimeout(r, Math.random() * 30));
    }
  }
  throw lastErr;
}

async function checkDuplicateNumber(uid: string, invoiceNumber: string, excludeId?: string) {
  const snap = await getDocs(query(
    collection(db, "invoices"), where("ownerId", "==", uid), where("invoice_number", "==", invoiceNumber),
  ));
  const conflict = snap.docs.find((d) => d.id !== excludeId);
  if (conflict) throw new Error(`Invoice number '${invoiceNumber}' is already used`);
}

// ---------- Client ownership guard ----------
//
// The original backend trusts client_id/client_name/etc. as given in the
// payload without re-checking the client belongs to the org. Firestore
// rules can't express "this ownerId-stamped field must reference a doc
// this same user owns", so that check has to happen here — a deliberate,
// explicitly-requested security addition (not present in the Mongo
// version), not a business-logic change: valid same-owner requests behave
// identically to before.
async function assertOwnsClient(uid: string, clientId: string) {
  if (!clientId) return;
  const snap = await getDoc(doc(db, "clients", clientId));
  if (!snap.exists() || (snap.data() as any).ownerId !== uid) {
    throw new Error("Client not found");
  }
}

// ---------- CRUD ----------

export async function listInvoices(): Promise<any[]> {
  const uid = requireUid();
  const snap = await getDocs(query(collection(db, "invoices"), where("ownerId", "==", uid)));
  const items = snap.docs.map((d) => docOut(d.id, d.data()));
  items.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  return items;
}

export async function getInvoice(id: string): Promise<any> {
  const snap = await getDoc(doc(db, "invoices", id));
  if (!snap.exists()) throw new Error("Invoice not found");
  return docOut(snap.id, snap.data());
}

export async function createInvoice(body: Record<string, any>): Promise<any> {
  const uid = requireUid();
  await assertOwnsClient(uid, body.client_id || "");

  const { items, subtotal, gst, total } = computeInvoiceTotals(body.items || []);
  const settings = await getSettings();

  const manualNum = (body.invoice_number || "").trim();
  let invoice_number: string;
  if (manualNum) {
    await checkDuplicateNumber(uid, manualNum);
    invoice_number = manualNum;
  } else {
    invoice_number = await nextInvoiceNumber(uid);
  }

  const issue_date = body.issue_date || today();
  const doc_: Record<string, any> = {
    invoice_number,
    client_id: body.client_id || "", client_name: body.client_name || "",
    client_company: body.client_company || "", client_address: body.client_address || "",
    client_email: body.client_email || "", participant_ndis_number: body.participant_ndis_number || "",
    items, notes: body.notes || "",
    subtotal, gst, total,
    issue_date, service_date: body.service_date || issue_date, due_date: body.due_date || "",
    sent_date: "",
    status: body.status || "unpaid",
    shift_id: body.shift_id || "",
    recurring: !!body.recurring, recurrence: body.recurrence || "",
    ttp: !!body.ttp,
    management_type: body.management_type || "self_managed",
    plan_manager_name: body.plan_manager_name || "", plan_manager_email: body.plan_manager_email || "",
    business: businessSnapshot(settings),
    ownerId: uid, created_at: Timestamp.now(),
  };
  const ref = await addDoc(collection(db, "invoices"), doc_);
  return docOut(ref.id, doc_);
}

export async function setInvoiceStatus(id: string, status: string): Promise<any> {
  await updateDoc(doc(db, "invoices", id), { status });
  return getInvoice(id);
}

export async function deleteInvoice(id: string): Promise<void> {
  await deleteDoc(doc(db, "invoices", id));
}

export async function editInvoice(id: string, body: Record<string, any>): Promise<any> {
  const uid = requireUid();
  const ref = doc(db, "invoices", id);
  const existingSnap = await getDoc(ref);
  if (!existingSnap.exists()) throw new Error("Invoice not found");
  const existing = existingSnap.data() as Record<string, any>;

  if (body.client_id) await assertOwnsClient(uid, body.client_id);

  const { items, subtotal, gst, total } = computeInvoiceTotals(body.items || []);

  // Empty string means "no change" — matches edit_invoice's rename guard exactly.
  let invoice_number = existing.invoice_number;
  const requestedNum = (body.invoice_number || "").trim();
  if (requestedNum && requestedNum !== existing.invoice_number) {
    await checkDuplicateNumber(uid, requestedNum, id);
    invoice_number = requestedNum;
  }

  const update: Record<string, any> = {
    invoice_number,
    client_id: body.client_id ?? existing.client_id, client_name: body.client_name ?? existing.client_name,
    client_company: body.client_company ?? existing.client_company, client_address: body.client_address ?? existing.client_address,
    client_email: body.client_email ?? existing.client_email, participant_ndis_number: body.participant_ndis_number ?? existing.participant_ndis_number,
    items, notes: body.notes ?? existing.notes ?? "",
    subtotal, gst, total,
    issue_date: body.issue_date || existing.issue_date || "",
    // Preserved from the existing doc when the edit form didn't send a new
    // value — matches edit_invoice's explicit preservation of shift_id,
    // recurrence, recurring, and service_date (server.py:2893-2927).
    service_date: body.service_date || existing.service_date || "",
    due_date: body.due_date ?? existing.due_date ?? "",
    status: body.status ?? existing.status,
    shift_id: body.shift_id ?? existing.shift_id ?? "",
    recurring: body.recurring ?? existing.recurring ?? false,
    recurrence: body.recurrence ?? existing.recurrence ?? "",
    ttp: body.ttp ?? existing.ttp ?? false,
    management_type: body.management_type || existing.management_type || "self_managed",
    plan_manager_name: body.plan_manager_name ?? existing.plan_manager_name ?? "",
    plan_manager_email: body.plan_manager_email ?? existing.plan_manager_email ?? "",
  };
  await updateDoc(ref, update);
  return getInvoice(id);
}

export async function duplicateInvoice(id: string): Promise<any> {
  const uid = requireUid();
  const snap = await getDoc(doc(db, "invoices", id));
  if (!snap.exists()) throw new Error("Invoice not found");
  const data = snap.data() as Record<string, any>;
  const invoice_number = await nextInvoiceNumber(uid);
  const t = today();
  const doc_ = {
    ...data,
    invoice_number, status: "unpaid",
    issue_date: t, service_date: t, sent_date: "",
    created_at: Timestamp.now(), ownerId: uid,
  };
  const ref = await addDoc(collection(db, "invoices"), doc_);
  return docOut(ref.id, doc_);
}

export async function markInvoiceSent(id: string): Promise<any> {
  const ref = doc(db, "invoices", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Invoice not found");
  const existing = snap.data() as Record<string, any>;
  const update: Record<string, any> = { sent_date: today() };
  if (existing.status === "draft") update.status = "unpaid";
  await updateDoc(ref, update);
  return getInvoice(id);
}

export async function addInvoiceItem(id: string, item: InvoiceItemIn): Promise<any> {
  const ref = doc(db, "invoices", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Invoice not found");
  const existing = snap.data() as Record<string, any>;
  const { items, subtotal, gst, total } = computeInvoiceTotals([...(existing.items || []), item]);
  await updateDoc(ref, { items, subtotal, gst, total });
  return getInvoice(id);
}

export async function applyBusinessToInvoices(invoiceIds: string[]): Promise<{ success: true }> {
  const settings = await getSettings();
  const snapshot = businessSnapshot(settings);
  const batch = writeBatch(db);
  invoiceIds.forEach((id) => batch.update(doc(db, "invoices", id), { business: snapshot }));
  await batch.commit();
  return { success: true };
}

// ---------- Shift integration ----------
//
// Mirrors _create_shift_drafts (server.py:2376-2408) exactly: one draft
// invoice per selected client, called identically from both startShift and
// planShift. Template line items only populate the ONE participant the
// template names (template.client_id) — every other selected client gets
// an empty-items draft, same as the original. Draft invoices deliberately
// get business: {} (no snapshot) — the original never calls
// _business_snapshot for shift drafts, only for manually-created invoices.
export async function createShiftDraftInvoices(
  uid: string, shiftId: string, clientIds: string[], template: Record<string, any> | null,
): Promise<any[]> {
  const created: any[] = [];
  for (const cid of clientIds) {
    const clientSnap = await getDoc(doc(db, "clients", cid));
    if (!clientSnap.exists() || (clientSnap.data() as any).ownerId !== uid) continue;
    const client = clientSnap.data() as Record<string, any>;

    let items: InvoiceItemIn[] = [];
    if (template && template.client_id === cid) {
      items = (template.items || []).map((it: any) => ({
        description: it.description || "", ndis_code: it.ndis_code || "",
        quantity: Number(it.quantity) || 1, rate: Number(it.rate) || 0,
      }));
    }
    const totals = items.length ? computeInvoiceTotals(items) : { items: [], subtotal: 0, gst: 0, total: 0 };
    const invoice_number = await nextInvoiceNumber(uid);

    const doc_ = {
      invoice_number,
      client_id: cid, client_name: client.name || "", client_company: client.company || "",
      client_address: client.address || "", client_email: client.email || "",
      participant_ndis_number: client.ndis_number || "",
      items: totals.items, notes: "",
      subtotal: totals.subtotal, gst: totals.gst, total: totals.total,
      status: "draft", shift_id: shiftId,
      issue_date: today(), service_date: "", due_date: "", sent_date: "",
      recurring: false, recurrence: "", ttp: false,
      management_type: "self_managed", plan_manager_name: "", plan_manager_email: "",
      business: {},
      ownerId: uid, created_at: Timestamp.now(),
    };
    const ref = await addDoc(collection(db, "invoices"), doc_);
    created.push(docOut(ref.id, doc_));
  }
  return created;
}

// Mirrors GET /clients/{id}/recent-codes (server.py:1650-1663): the NDIS
// codes used on this client's 3 most recent invoices, deduped, for the
// invoice/shift-template line-item quick-pick.
export async function recentCodesForClient(clientId: string): Promise<any[]> {
  const uid = requireUid();
  const snap = await getDocs(query(
    collection(db, "invoices"), where("ownerId", "==", uid), where("client_id", "==", clientId),
  ));
  const items = snap.docs.map((d) => docOut(d.id, d.data()));
  items.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  const seen = new Map<string, any>();
  for (const inv of items.slice(0, 3)) {
    for (const it of inv.items || []) {
      if (it.ndis_code && !seen.has(it.ndis_code)) {
        seen.set(it.ndis_code, { code: it.ndis_code, description: it.description || "", rate: it.rate || 0 });
      }
    }
  }
  return Array.from(seen.values());
}

// Used by shifts.ts's activeShift()/listShifts() to attach real invoice
// relationships — matches the original's shift_id-scoped queries exactly
// (no status filter: draft/unpaid/paid invoices all count).
export async function listInvoicesForShift(uid: string, shiftId: string): Promise<any[]> {
  const snap = await getDocs(query(
    collection(db, "invoices"), where("ownerId", "==", uid), where("shift_id", "==", shiftId),
  ));
  return snap.docs.map((d) => docOut(d.id, d.data()));
}
