// Firestore + Storage backed replacement for the /client-documents REST
// endpoints (server.py:2791-2825). Field names mirror ClientDocCreate
// exactly (client_id, title, type, extracted_text, doc_date, key_parties)
// — the one rename is file_base64 -> file_url (Storage), same pattern as
// receipts/credentials. extracted_text/doc_date/key_parties are populated
// by the AI document-scan flow (api.scanDocument, migrated separately to a
// Cloud Function) but this service itself has no AI dependency — it just
// stores whatever the caller passes.
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
  for (const [k, v] of Object.entries(data)) out[k] = v instanceof Timestamp ? v.toDate().toISOString() : v;
  return out;
}
function docOut(id: string, data: Record<string, any>): Record<string, any> {
  return { id, ...toPlain(data) };
}

export async function listClientDocs(clientId: string): Promise<any[]> {
  const uid = requireUid();
  const snap = await getDocs(query(
    collection(db, "clientDocuments"), where("ownerId", "==", uid), where("client_id", "==", clientId),
  ));
  const items = snap.docs.map((d) => docOut(d.id, d.data()));
  items.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  return items;
}

export async function createClientDoc(body: Record<string, any>): Promise<any> {
  const uid = requireUid();
  const { file_base64, ...rest } = body;
  const ref = await addDoc(collection(db, "clientDocuments"), {
    client_id: rest.client_id || "", title: rest.title || "", type: rest.type || "Document",
    extracted_text: rest.extracted_text || "", doc_date: rest.doc_date || "",
    key_parties: Array.isArray(rest.key_parties) ? rest.key_parties : [],
    file_url: "",
    ownerId: uid, created_at: Timestamp.now(),
  });
  if (file_base64) {
    const path = `clientDocuments/${uid}/${ref.id}.jpg`;
    const url = await uploadBase64Image(path, file_base64, "image/jpeg");
    await updateDoc(ref, { file_url: url });
    return { id: ref.id, file_url: url };
  }
  return { id: ref.id };
}

export async function deleteClientDoc(id: string): Promise<void> {
  const uid = requireUid();
  try {
    await deleteFile(`clientDocuments/${uid}/${id}.jpg`);
  } catch (e) {
    console.warn("Failed to delete client document file from Storage:", e);
  }
  await deleteDoc(doc(db, "clientDocuments", id));
}
