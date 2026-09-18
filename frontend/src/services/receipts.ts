// Firestore + Storage backed replacement for the /receipts REST endpoints.
// Field names mirror the old Mongo Receipt model exactly (merchant, abn,
// receipt_number, date, subtotal, total, gst, category, payment_method,
// items, line_items, shift_id, archived) so vault.tsx and scan.tsx needed
// minimal changes. The one deliberate rename: image_base64 -> image_url,
// since the actual file now lives in Storage, not inline in the document.
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/src/firebase/firestore";
import { uploadBase64Image, deleteFile } from "@/src/firebase/storage";
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

export async function listReceipts(): Promise<any[]> {
  const uid = requireUid();
  const snap = await getDocs(query(collection(db, "receipts"), where("ownerId", "==", uid)));
  const items = snap.docs.map((d) => docOut(d.id, d.data()));
  // Sorted client-side (newest first) rather than via orderBy, so this
  // query never needs a composite Firestore index — fine at this app's
  // realistic data volume (a sole trader's receipts, not millions of rows).
  items.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  return items;
}

export async function createReceipt(body: Record<string, any>) {
  const uid = requireUid();
  const { image_base64, ...rest } = body;
  const docRef = await addDoc(collection(db, "receipts"), {
    ...rest,
    ownerId: uid,
    image_url: "",
    created_at: Timestamp.now(),
  });
  if (image_base64) {
    const path = `receipts/${uid}/${docRef.id}.jpg`;
    const url = await uploadBase64Image(path, image_base64);
    await updateDoc(docRef, { image_url: url, image_path: path });
  }
  return { id: docRef.id };
}

export async function deleteReceipt(id: string) {
  const uid = requireUid();
  // Best-effort file cleanup — the doc delete is what actually matters for
  // the user, so a missing/already-gone file must not block it. Logged
  // (not silently swallowed) so a real Storage misconfiguration or
  // permissions problem stays visible instead of masking itself as
  // "already deleted".
  try {
    await deleteFile(`receipts/${uid}/${id}.jpg`);
  } catch (e) {
    console.warn("Failed to delete receipt image from Storage:", e);
  }
  await deleteDoc(doc(db, "receipts", id));
}
