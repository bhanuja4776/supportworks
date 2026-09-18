// Firestore + Storage backed replacement for GET/PUT /notes/{date}
// (server.py:2208-2247). One doc per (owner, date) — nested under the
// user's own doc (users/{uid}/dailyNotes/{date}) rather than a top-level
// collection, since ownership is then just "the {uid} path segment", no
// ownerId field or get()-lookup needed for the security rule. Field names
// match DailyNoteUpsert exactly (text, font, font_size, text_color,
// bg_color, photos[]); photos move to Storage (was inline base64) — an
// array of download URLs instead of base64 strings.
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "@/src/firebase/firestore";
import { uploadBase64Image, deleteFile } from "@/src/firebase/storage";
import { currentFirebaseUser } from "@/src/firebase/auth";

function requireUid(): string {
  const u = currentFirebaseUser();
  if (!u) throw new Error("Not signed in");
  return u.uid;
}

const DEFAULT_NOTE = {
  text: "", font: "system", font_size: 16,
  text_color: "#F0F9FF", bg_color: "#0A1E24", photos: [] as string[],
};

function isUploadedUrl(p: string): boolean {
  return p.startsWith("http://") || p.startsWith("https://");
}

export async function getNote(date: string): Promise<Record<string, any>> {
  const uid = requireUid();
  const snap = await getDoc(doc(db, "users", uid, "dailyNotes", date));
  if (!snap.exists()) return { date, ...DEFAULT_NOTE };
  const data = snap.data();
  return { date, ...DEFAULT_NOTE, ...data };
}

export async function putNote(date: string, body: Record<string, any>): Promise<Record<string, any>> {
  const uid = requireUid();
  const incomingPhotos: string[] = body.photos || [];

  // Any entry that isn't already an uploaded URL is a freshly-captured
  // base64 photo from this editing session — upload it now.
  const photos = await Promise.all(incomingPhotos.map(async (p, idx) => {
    if (isUploadedUrl(p)) return p;
    const path = `dailyNotes/${uid}/${date}/${Date.now()}-${idx}.jpg`;
    return uploadBase64Image(path, p);
  }));

  const update = {
    text: body.text || "", font: body.font || "system", font_size: body.font_size || 16,
    text_color: body.text_color || DEFAULT_NOTE.text_color, bg_color: body.bg_color || DEFAULT_NOTE.bg_color,
    photos, updated_at: Timestamp.now(),
  };
  await setDoc(doc(db, "users", uid, "dailyNotes", date), update, { merge: true });
  return { date, ...update };
}

export async function deleteNotePhoto(date: string, url: string): Promise<void> {
  const uid = requireUid();
  try {
    // Storage path is deterministic-ish only by prefix; deleting by full
    // gs path parsed from the download URL isn't reliable across SDKs, so
    // this is best-effort cleanup — the doc update (removing the URL from
    // the array) is what actually matters and always happens via putNote.
    const marker = `dailyNotes%2F${uid}%2F${date}%2F`;
    if (url.includes(marker)) {
      const start = url.indexOf(marker);
      const end = url.indexOf("?", start);
      const encoded = url.slice(start, end === -1 ? undefined : end);
      const path = decodeURIComponent(encoded);
      await deleteFile(path);
    }
  } catch (e) {
    console.warn("Failed to delete note photo from Storage:", e);
  }
}
