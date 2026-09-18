// Firestore-backed replacement for the /tasks REST endpoints. Field names
// mirror the old Mongo Task model exactly (title, client_id, notes, date,
// time, end_time, type, completed, activity_template_id, shift_id,
// duration_min, location, distance_km, activity_type).
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

export async function listTasks(date?: string): Promise<any[]> {
  const uid = requireUid();
  const constraints = [where("ownerId", "==", uid)] as any[];
  if (date) constraints.push(where("date", "==", date));
  const snap = await getDocs(query(collection(db, "tasks"), ...constraints));
  const items = snap.docs.map((d) => docOut(d.id, d.data()));
  // Client-side sort by time (matches the old backend's `.sort("time", 1)`) —
  // avoids needing a composite index for date+ownerId queries with orderBy.
  items.sort((a, b) => String(a.time || "99").localeCompare(String(b.time || "99")));
  return items;
}

export async function createTask(body: Record<string, any>) {
  const uid = requireUid();
  const ref = await addDoc(collection(db, "tasks"), {
    client_id: "", notes: "", date: "", time: "", end_time: "", type: "task",
    completed: false, activity_template_id: "", shift_id: "", duration_min: 0,
    location: "", distance_km: 0, activity_type: "",
    ...body,
    ownerId: uid,
    created_at: Timestamp.now(),
  });
  return { id: ref.id };
}

export async function updateTask(id: string, body: Record<string, any>) {
  const patch = { ...body };
  delete patch.id;
  delete patch.ownerId;
  await updateDoc(doc(db, "tasks", id), patch);
}

export async function deleteTask(id: string) {
  await deleteDoc(doc(db, "tasks", id));
}
