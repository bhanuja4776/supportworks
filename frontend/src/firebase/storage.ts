// Thin wrapper around Firebase Storage. Receipt/document images are real
// files (up to ~9MB decoded) — Firestore's 1MB document limit makes storing
// them as base64 fields a hard blocker, unlike the small client-avatar
// photos left as base64 in Milestone 2. Paths are scoped by ownerId so
// storage.rules can check ownership directly from the path, no Firestore
// lookup needed.
import { ref, uploadString, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "./config";

// Uploads a base64 (no data: prefix) file and returns its download URL.
// Defaults to JPEG (the common case: receipt/client photos); callers with a
// different file type (e.g. a PDF credential) pass contentType explicitly.
export async function uploadBase64Image(path: string, base64: string, contentType = "image/jpeg"): Promise<string> {
  const r = ref(storage, path);
  await uploadString(r, base64, "base64", { contentType });
  return getDownloadURL(r);
}

export async function deleteFile(path: string): Promise<void> {
  try {
    await deleteObject(ref(storage, path));
  } catch (e: any) {
    // Already gone / never existed — not an error worth surfacing to the user.
    if (e?.code !== "storage/object-not-found") throw e;
  }
}
