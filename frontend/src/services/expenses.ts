// Firestore-backed replacement for the /expenses REST endpoints. Field
// names mirror the old Mongo Expense model exactly (name, description,
// category, cost, due_date, renewal_date, direct_debit, notes) so
// vault.tsx's bill form needed zero changes. No file storage involved —
// bills/direct debits never had an attached image in the original app.
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, where, Timestamp } from "firebase/firestore";
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

export async function listExpenses(): Promise<any[]> {
  const uid = requireUid();
  const snap = await getDocs(query(collection(db, "expenses"), where("ownerId", "==", uid)));
  const items = snap.docs.map((d) => docOut(d.id, d.data()));
  // Client-side sort by due_date ascending (matches the old backend's
  // `.sort("due_date", 1)`) — avoids needing a composite Firestore index.
  items.sort((a, b) => String(a.due_date || "").localeCompare(String(b.due_date || "")));
  return items;
}

export async function createExpense(body: Record<string, any>) {
  const uid = requireUid();
  const ref = await addDoc(collection(db, "expenses"), { ...body, ownerId: uid, created_at: Timestamp.now() });
  return { id: ref.id };
}

export async function updateExpense(id: string, body: Record<string, any>) {
  const patch = { ...body };
  delete patch.id;
  delete patch.ownerId;
  await updateDoc(doc(db, "expenses", id), patch);
}

export async function deleteExpense(id: string) {
  await deleteDoc(doc(db, "expenses", id));
}
