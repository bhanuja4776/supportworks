// Firestore + Storage backed replacement for the /text-documents REST
// endpoints (server.py:2828-2889). Field names mirror TextDocumentCreate
// (title, text, doc_type) — image_base64 -> image_url (Storage), same
// rename pattern as every other photo-carrying collection this migration.
import { collection, doc, getDoc, getDocs, addDoc, deleteDoc, updateDoc, query, where, Timestamp } from "firebase/firestore";
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
  for (const [k, v] of Object.entries(data)) out[k] = v instanceof Timestamp ? v.toDate().toISOString() : v;
  return out;
}
function docOut(id: string, data: Record<string, any>): Record<string, any> {
  return { id, ...toPlain(data) };
}

export async function listTextDocuments(): Promise<any[]> {
  const uid = requireUid();
  const snap = await getDocs(query(collection(db, "textDocuments"), where("ownerId", "==", uid)));
  const items = snap.docs.map((d) => docOut(d.id, d.data()));
  items.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  return items;
}

export async function getTextDocument(id: string): Promise<any> {
  const snap = await getDoc(doc(db, "textDocuments", id));
  if (!snap.exists()) throw new Error("Document not found");
  return docOut(snap.id, snap.data());
}

export async function createTextDocument(body: Record<string, any>): Promise<any> {
  const uid = requireUid();
  if (!(body.text || "").trim()) throw new Error("No text to save");
  const { image_base64, ...rest } = body;
  const ref = await addDoc(collection(db, "textDocuments"), {
    title: (rest.title || "").trim() || "Untitled document",
    text: rest.text || "", doc_type: rest.doc_type || "Document",
    image_url: "",
    ownerId: uid, created_at: Timestamp.now(),
  });
  if (image_base64) {
    const path = `textDocuments/${uid}/${ref.id}.jpg`;
    const url = await uploadBase64Image(path, image_base64, "image/jpeg");
    await updateDoc(ref, { image_url: url });
    return { id: ref.id, image_url: url };
  }
  return { id: ref.id };
}

export async function deleteTextDocument(id: string): Promise<void> {
  const uid = requireUid();
  try {
    await deleteFile(`textDocuments/${uid}/${id}.jpg`);
  } catch (e) {
    console.warn("Failed to delete text document file from Storage:", e);
  }
  await deleteDoc(doc(db, "textDocuments", id));
}
