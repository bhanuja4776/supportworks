// Firestore-backed replacement for the /shifts and /shift-templates REST
// endpoints. Field names mirror the old Mongo models exactly.
//
// Draft invoices: in the original app, starting or planning a shift
// auto-creates one DRAFT-status INVOICE per selected client (that's what
// "shift drafts" means in this codebase — there is no separate
// "ShiftDraft" collection). See src/services/invoices.ts's
// createShiftDraftInvoices/listInvoicesForShift, which mirror the
// original's _create_shift_drafts (server.py:2376-2408) exactly.
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, Timestamp, writeBatch,
} from "firebase/firestore";
import { db } from "@/src/firebase/firestore";
import { currentFirebaseUser } from "@/src/firebase/auth";
import { createShiftDraftInvoices, listInvoicesForShift } from "@/src/services/invoices";

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

// ---------- Shift templates ----------

// Mirrors the backend's compute_invoice_totals exactly: template line
// items carry no gst_free flag, and InvoiceItem defaults gst_free=true
// ("most NDIS supports are GST-free"), so a template's preview GST is
// always 0 — not a bug, faithfully matching _template_out's behavior.
function templatePreview(items: any[] = []) {
  let subtotal = 0;
  for (const it of items) subtotal += (Number(it.quantity) || 0) * (Number(it.rate) || 0);
  subtotal = Math.round(subtotal * 100) / 100;
  return { preview_subtotal: subtotal, preview_gst: 0, preview_total: subtotal };
}

async function lookupClientName(clientId: string): Promise<string> {
  if (!clientId) return "";
  try {
    const snap = await getDoc(doc(db, "clients", clientId));
    return snap.exists() ? (snap.data() as any).name || "" : "";
  } catch {
    return "";
  }
}

export async function listShiftTemplates(): Promise<any[]> {
  const uid = requireUid();
  const snap = await getDocs(query(collection(db, "shiftTemplates"), where("ownerId", "==", uid)));
  const items = snap.docs.map((d): Record<string, any> => {
    const out = docOut(d.id, d.data());
    return { ...out, ...templatePreview(out.items) };
  });
  items.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  return items;
}

export async function createShiftTemplate(body: Record<string, any>) {
  const uid = requireUid();
  const client_name = await lookupClientName(body.client_id);
  const ref = await addDoc(collection(db, "shiftTemplates"), {
    ...body, client_name, ownerId: uid, created_at: Timestamp.now(),
  });
  return { id: ref.id, ...templatePreview(body.items) };
}

export async function updateShiftTemplate(id: string, body: Record<string, any>) {
  const client_name = await lookupClientName(body.client_id);
  await updateDoc(doc(db, "shiftTemplates", id), { ...body, client_name });
}

export async function deleteShiftTemplate(id: string) {
  await deleteDoc(doc(db, "shiftTemplates", id));
}

async function loadTemplate(templateId: string): Promise<Record<string, any> | null> {
  if (!templateId) return null;
  try {
    const snap = await getDoc(doc(db, "shiftTemplates", templateId));
    return snap.exists() ? docOut(snap.id, snap.data()) : null;
  } catch {
    return null;
  }
}

// ---------- Routine tasks (created from a template's checklist on shift start/plan) ----------

async function createRoutineTasks(uid: string, template: Record<string, any>, dateIso: string) {
  for (const raw of template.routine_tasks || []) {
    const title = (raw || "").trim();
    if (!title) continue;
    const dupSnap = await getDocs(query(
      collection(db, "tasks"),
      where("ownerId", "==", uid),
      where("title", "==", title),
      where("date", "==", dateIso),
      where("type", "==", "task"),
      where("client_id", "==", template.client_id || ""),
    ));
    if (!dupSnap.empty) continue;
    await addDoc(collection(db, "tasks"), {
      title, client_id: template.client_id || "", date: dateIso,
      time: template.start_time || "", type: "task", completed: false,
      notes: "", end_time: "", activity_template_id: "", shift_id: "",
      duration_min: 0, location: "", distance_km: 0, activity_type: "",
      ownerId: uid, created_at: Timestamp.now(),
    });
  }
}

// ---------- Shifts ----------

export async function activeShift(): Promise<any> {
  const uid = requireUid();
  const snap = await getDocs(query(
    collection(db, "shifts"), where("ownerId", "==", uid), where("status", "==", "active"),
  ));
  if (snap.empty) return { shift: null, invoices: [], receipts: [], template: null, planned_activities: [] };
  const shiftDoc = snap.docs[0];
  const shift = docOut(shiftDoc.id, shiftDoc.data());
  const template = await loadTemplate(shift.template_id);
  const actsSnap = await getDocs(query(
    collection(db, "tasks"), where("ownerId", "==", uid), where("shift_id", "==", shiftDoc.id),
  ));
  const planned_activities = actsSnap.docs
    .map((d) => docOut(d.id, d.data()))
    .sort((a, b) => String(a.time || "99").localeCompare(String(b.time || "99")));
  const invoices = await listInvoicesForShift(uid, shiftDoc.id);
  return {
    shift,
    invoices,
    receipts: [], // shift-linked receipts aren't wired up yet either (shift_id is always "" on receipts for now)
    template: template ? { ...template, ...templatePreview(template.items) } : null,
    planned_activities,
  };
}

export async function startShift(
  clientIds: string[],
  templateId = "",
  overrides: { started_at?: string; start_time?: string; end_time?: string } = {}
) {
  const uid = requireUid();
  const template = await loadTemplate(templateId);
  const finalClientIds = [...clientIds];
  if (template?.client_id && !finalClientIds.includes(template.client_id)) finalClientIds.push(template.client_id);

  const activeSnap = await getDocs(query(
    collection(db, "shifts"), where("ownerId", "==", uid), where("status", "==", "active"),
  ));

  let shiftId: string;
  if (!activeSnap.empty) {
    // Only one active shift per account, ever — matches the original
    // backend exactly: starting again while already on shift just merges
    // the picked template into the existing active shift.
    shiftId = activeSnap.docs[0].id;
    if (template) {
      await updateDoc(doc(db, "shifts", shiftId), {
        template_id: templateId,
        start_time: template.start_time || "",
        end_time: template.end_time || "",
      });
    }
  } else {
    const startedAt = (overrides.started_at || "").trim() || new Date().toISOString();
    const ref = await addDoc(collection(db, "shifts"), {
      status: "active", started_at: startedAt, ended_at: "",
      client_ids: finalClientIds, invoice_ids: [], template_id: templateId || "",
      start_time: (overrides.start_time || "").trim() || template?.start_time || "",
      end_time: (overrides.end_time || "").trim() || template?.end_time || "",
      ownerId: uid, created_at: Timestamp.now(),
    });
    shiftId = ref.id;
  }

  const invoices = await createShiftDraftInvoices(uid, shiftId, finalClientIds, template);
  if (invoices.length) {
    await updateDoc(doc(db, "shifts", shiftId), {
      invoice_ids: [...((activeSnap.empty ? [] : (activeSnap.docs[0].data() as any).invoice_ids) || []), ...invoices.map((i) => i.id)],
    });
  }

  if (template) {
    await createRoutineTasks(uid, template, new Date().toISOString().slice(0, 10));
  }

  const shiftSnap = await getDoc(doc(db, "shifts", shiftId));
  return { shift: docOut(shiftId, shiftSnap.data()!), invoices };
}

export async function endShift(
  id: string,
  overrides: { ended_at?: string; start_time?: string; end_time?: string } = {}
) {
  const update: Record<string, any> = {
    status: "ended",
    ended_at: (overrides.ended_at || "").trim() || new Date().toISOString(),
  };
  if (overrides.start_time && overrides.start_time.trim()) update.start_time = overrides.start_time.trim();
  if (overrides.end_time && overrides.end_time.trim()) update.end_time = overrides.end_time.trim();
  await updateDoc(doc(db, "shifts", id), update);
  return { success: true };
}

export async function planShift(clientIds: string[], scheduledFor: string, templateId = "") {
  const uid = requireUid();
  const template = await loadTemplate(templateId);
  const finalClientIds = [...clientIds];
  if (template?.client_id && !finalClientIds.includes(template.client_id)) finalClientIds.push(template.client_id);

  const ref = await addDoc(collection(db, "shifts"), {
    status: "planned", started_at: "", ended_at: "", scheduled_for: scheduledFor,
    client_ids: finalClientIds, invoice_ids: [], template_id: templateId || "",
    start_time: template?.start_time || "", end_time: template?.end_time || "",
    ownerId: uid, created_at: Timestamp.now(),
  });

  const invoices = await createShiftDraftInvoices(uid, ref.id, finalClientIds, template);
  if (invoices.length) {
    await updateDoc(ref, { invoice_ids: invoices.map((i) => i.id) });
  }

  if (template && scheduledFor) {
    await createRoutineTasks(uid, template, scheduledFor);
  }

  const shiftSnap = await getDoc(ref);
  return { shift: docOut(ref.id, shiftSnap.data()!), invoices };
}

export async function listShifts(includeEnded = false): Promise<any[]> {
  const uid = requireUid();
  const snap = await getDocs(query(collection(db, "shifts"), where("ownerId", "==", uid)));
  let items = snap.docs.map((d) => docOut(d.id, d.data()));
  if (!includeEnded) items = items.filter((s) => s.status === "planned" || s.status === "active");

  // One query for all of this owner's invoices, grouped by shift_id — the
  // Firestore-native equivalent of the original's per-shift find({shift_id,
  // org_id}) loop (server.py:2441-2447), same totals, fewer round-trips.
  const invSnap = await getDocs(query(collection(db, "invoices"), where("ownerId", "==", uid)));
  const invoicesByShift = new Map<string, any[]>();
  invSnap.docs.forEach((d) => {
    const inv = docOut(d.id, d.data());
    const sid = inv.shift_id || "";
    if (!sid) return;
    if (!invoicesByShift.has(sid)) invoicesByShift.set(sid, []);
    invoicesByShift.get(sid)!.push(inv);
  });
  items = items.map((s) => {
    const invs = invoicesByShift.get(s.id) || [];
    const total = Math.round(invs.reduce((sum, i) => sum + (Number(i.total) || 0), 0) * 100) / 100;
    return { ...s, invoice_count: invs.length, total };
  });
  items.sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1;
    if (b.status === "active" && a.status !== "active") return 1;
    const av = String(a.scheduled_for || a.created_at || "");
    const bv = String(b.scheduled_for || b.created_at || "");
    return bv.localeCompare(av);
  });
  return items;
}

export async function activateShift(id: string) {
  await updateDoc(doc(db, "shifts", id), { status: "active", started_at: new Date().toISOString() });
  return { success: true };
}

export async function deleteShift(id: string) {
  const uid = requireUid();
  // Cascade: remove this shift's still-draft invoices (currently always a
  // no-op — see file header note — but left wired so it works once
  // Invoices exist, without needing to revisit this function then).
  const draftsSnap = await getDocs(query(
    collection(db, "invoices"), where("ownerId", "==", uid),
    where("shift_id", "==", id), where("status", "==", "draft"),
  ));
  if (!draftsSnap.empty) {
    const batch = writeBatch(db);
    draftsSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(doc(db, "shifts", id));
  return { success: true };
}
