// Firestore + Storage backed replacement for the /credentials REST
// endpoints. Field names mirror the old Mongo Credential model exactly
// (title, type, issuer, number, issue_date, expiry_date, file_type,
// file_name, notes) — the one deliberate rename is image_base64 ->
// image_url, same pattern as receipts.ts, since a cert/insurance PDF or
// photo can exceed Firestore's 1MB document limit stored inline.
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

export async function listCredentials(): Promise<any[]> {
  const uid = requireUid();
  const snap = await getDocs(query(collection(db, "credentials"), where("ownerId", "==", uid)));
  const items = snap.docs.map((d) => docOut(d.id, d.data()));
  items.sort((a, b) => String(a.expiry_date || "9999").localeCompare(String(b.expiry_date || "9999")));
  return items;
}

export async function createCredential(body: Record<string, any>) {
  const uid = requireUid();
  const { image_base64, ...rest } = body;
  const docRef = await addDoc(collection(db, "credentials"), {
    title: rest.title || "", type: rest.type || "Certificate", issuer: rest.issuer || "",
    number: rest.number || "", issue_date: rest.issue_date || "", expiry_date: rest.expiry_date || "",
    file_type: rest.file_type || "image", file_name: rest.file_name || "", notes: rest.notes || "",
    image_url: "", image_path: "",
    ownerId: uid, created_at: Timestamp.now(),
  });
  if (image_base64) {
    const contentType = rest.file_type === "pdf" ? "application/pdf" : "image/jpeg";
    const ext = rest.file_type === "pdf" ? "pdf" : "jpg";
    const path = `credentials/${uid}/${docRef.id}.${ext}`;
    const url = await uploadBase64Image(path, image_base64, contentType);
    await updateDoc(docRef, { image_url: url, image_path: path });
  }
  const snap = await getDocs(query(collection(db, "credentials"), where("ownerId", "==", uid)));
  const created = snap.docs.find((d) => d.id === docRef.id);
  return created ? docOut(created.id, created.data()) : { id: docRef.id };
}

export async function updateCredential(id: string, body: Record<string, any>) {
  const update: Record<string, any> = {};
  for (const k of ["title", "type", "issuer", "number", "issue_date", "expiry_date", "notes"]) {
    if (body[k] !== undefined) update[k] = body[k];
  }
  await updateDoc(doc(db, "credentials", id), update);
  return { id, ...update };
}

export async function deleteCredential(id: string) {
  const uid = requireUid();
  try {
    // File extension is unknown here without a read; try both.
    await deleteFile(`credentials/${uid}/${id}.jpg`);
    await deleteFile(`credentials/${uid}/${id}.pdf`);
  } catch (e) {
    console.warn("Failed to delete credential file from Storage:", e);
  }
  await deleteDoc(doc(db, "credentials", id));
}
