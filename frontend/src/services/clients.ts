// Firestore-backed replacement for the client/note/reminder/activity-template
// REST endpoints in src/api.ts. Field names intentionally mirror the old
// Mongo documents exactly (snake_case: date_of_birth, ndis_number, plan_manager,
// next_of_kin, etc.) so the existing UI (clients.tsx, client/[id].tsx,
// ClientFormSheet.tsx, ActivityTemplatesEditor.tsx) needed zero changes.
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, setDoc,
  query, where, serverTimestamp, Timestamp, writeBatch,
} from "firebase/firestore";
import { db } from "@/src/firebase/firestore";
import { currentFirebaseUser } from "@/src/firebase/auth";

function requireUid(): string {
  const u = currentFirebaseUser();
  if (!u) throw new Error("Not signed in");
  return u.uid;
}

// Firestore Timestamp fields read back as Timestamp objects; the UI expects
// date-parseable strings (toDMY/new Date()) like the old API's ISO strings.
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

async function deleteCollection(colRef: ReturnType<typeof collection>) {
  const snap = await getDocs(colRef);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// ---------- Clients ----------

export async function listClients() {
  const uid = requireUid();
  const snap = await getDocs(query(collection(db, "clients"), where("ownerId", "==", uid)));
  return snap.docs.map((d) => docOut(d.id, d.data()));
}

export async function getClient(id: string) {
  const snap = await getDoc(doc(db, "clients", id));
  if (!snap.exists()) throw new Error("Client not found");
  return docOut(snap.id, snap.data());
}

export async function createClient(body: Record<string, any>) {
  const uid = requireUid();
  const ref = await addDoc(collection(db, "clients"), {
    ...body,
    ownerId: uid,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return { id: ref.id };
}

export async function updateClient(id: string, body: Record<string, any>) {
  await updateDoc(doc(db, "clients", id), { ...body, updated_at: serverTimestamp() });
}

export async function deleteClient(id: string) {
  await deleteCollection(collection(db, "clients", id, "notes"));
  await deleteCollection(collection(db, "clients", id, "activityTemplates"));
  const uid = requireUid();
  const remSnap = await getDocs(query(collection(db, "reminders"), where("ownerId", "==", uid), where("client_id", "==", id)));
  if (!remSnap.empty) {
    const batch = writeBatch(db);
    remSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(doc(db, "clients", id));
}

// Invoices/tasks aren't migrated yet (later milestones) — this returns a
// correct, honest empty/zero state until then, not a guess at real numbers.
// Ported from GET /clients/{id}/overview (server.py:1626-1647), now that
// Invoices (Milestone 5) and this client's real invoice/task relationships
// exist in Firestore — this was left as an explicit zero-value placeholder
// back in the Clients milestone specifically pending that.
export async function clientOverview(id: string) {
  const uid = requireUid();
  const [client, reminders, invSnap, taskSnap] = await Promise.all([
    getClient(id),
    listReminders(id),
    getDocs(query(collection(db, "invoices"), where("ownerId", "==", uid), where("client_id", "==", id))),
    getDocs(query(collection(db, "tasks"), where("ownerId", "==", uid), where("client_id", "==", id))),
  ]);
  const inv = invSnap.docs.map((d) => docOut(d.id, d.data()));
  inv.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  const paid = inv.filter((i) => i.status === "paid");
  const pending = inv.filter((i) => i.status !== "paid");
  const tasks = taskSnap.docs.map((d) => docOut(d.id, d.data()));
  tasks.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    client,
    invoices: inv, invoices_paid: paid, invoices_pending: pending,
    total_billed: round2(inv.reduce((s, i) => s + (Number(i.total) || 0), 0)),
    total_paid: round2(paid.reduce((s, i) => s + (Number(i.total) || 0), 0)),
    total_pending: round2(pending.reduce((s, i) => s + (Number(i.total) || 0), 0)),
    tasks, reminders,
  };
}

// Ported from GET /clients/{id}/budget (server.py:1576-1598) — "spent"
// excludes draft invoices and matches on client_id OR client_name (the
// original's fallback for invoices created before a client link existed).
export async function clientBudget(id: string) {
  const uid = requireUid();
  const client = await getClient(id);
  const budget = Number(client.plan_budget) || 0;
  const snap = await getDocs(query(collection(db, "invoices"), where("ownerId", "==", uid), where("client_id", "==", id)));
  let invs = snap.docs.map((d) => docOut(d.id, d.data())).filter((i) => i.status !== "draft");
  if (client.name) {
    const byName = await getDocs(query(collection(db, "invoices"), where("ownerId", "==", uid), where("client_name", "==", client.name)));
    const seen = new Set(invs.map((i) => i.id));
    for (const d of byName.docs) {
      if (!seen.has(d.id) && d.data().status !== "draft") { invs.push(docOut(d.id, d.data())); seen.add(d.id); }
    }
  }
  const spent = Math.round(invs.reduce((s, i) => s + (Number(i.total) || 0), 0) * 100) / 100;
  const remaining = Math.round((budget - spent) * 100) / 100;
  const percent_used = budget > 0 ? Math.round((spent / budget) * 1000) / 10 : 0;
  return { budget, spent, remaining, percent_used, invoice_count: invs.length };
}

// ---------- Client notes (subcollection) ----------

export async function addClientNote(clientId: string, body: { text: string; date?: string }) {
  const ref = await addDoc(collection(db, "clients", clientId, "notes"), {
    text: body.text, date: body.date || "", created_at: serverTimestamp(),
  });
  return { id: ref.id };
}

export async function listClientNotes(clientId: string) {
  const snap = await getDocs(collection(db, "clients", clientId, "notes"));
  return snap.docs.map((d) => docOut(d.id, d.data()));
}

export async function deleteClientNote(clientId: string, noteId: string) {
  await deleteDoc(doc(db, "clients", clientId, "notes", noteId));
}

// ---------- Reminders (top-level — addressed by id alone, see firestore.rules) ----------

export async function listReminders(clientId?: string) {
  const uid = requireUid();
  const constraints = [where("ownerId", "==", uid)];
  if (clientId) constraints.push(where("client_id", "==", clientId));
  const snap = await getDocs(query(collection(db, "reminders"), ...constraints));
  return snap.docs.map((d) => docOut(d.id, d.data()));
}

export async function createReminder(body: { client_id: string; title: string; remind_at: string }) {
  const uid = requireUid();
  const ref = await addDoc(collection(db, "reminders"), {
    ...body, ownerId: uid, done: false, created_at: serverTimestamp(),
  });
  return { id: ref.id };
}

export async function updateReminder(id: string, body: Record<string, any>) {
  await updateDoc(doc(db, "reminders", id), body);
}

export async function deleteReminder(id: string) {
  await deleteDoc(doc(db, "reminders", id));
}

// ---------- Activity templates (subcollection) ----------

export async function listActivityTemplates(clientId: string): Promise<any[]> {
  const snap = await getDocs(collection(db, "clients", clientId, "activityTemplates"));
  return snap.docs.map((d) => docOut(d.id, d.data()));
}

export async function createActivityTemplate(clientId: string, body: Record<string, any>) {
  const ref = await addDoc(collection(db, "clients", clientId, "activityTemplates"), body);
  return { id: ref.id };
}

export async function updateActivityTemplate(clientId: string, templateId: string, body: Record<string, any>) {
  await setDoc(doc(db, "clients", clientId, "activityTemplates", templateId), body, { merge: true });
}

export async function deleteActivityTemplate(clientId: string, templateId: string) {
  await deleteDoc(doc(db, "clients", clientId, "activityTemplates", templateId));
}
