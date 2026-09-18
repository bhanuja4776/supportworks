import { serverTimestamp } from "firebase/firestore";

export { db } from "./config";

// Consistent createdAt/updatedAt stamping across every collection.
export function withCreateTimestamps<T extends object>(data: T) {
  return { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
}
export function withUpdateTimestamp<T extends object>(data: T) {
  return { ...data, updatedAt: serverTimestamp() };
}
