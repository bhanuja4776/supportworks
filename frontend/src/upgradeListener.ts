// Free-tier-limit-reached pub/sub, split out from api.ts so both api.ts
// (re-exports onUpgradeRequired for existing callers like UpgradeSheet.tsx)
// and src/services/ai.ts (calls notifyUpgradeRequired when a Cloud
// Function reports UPGRADE_REQUIRED) can import it without a circular
// dependency between the two.
export type UpgradeInfo = { feature: string; limit: number };

let upgradeListener: ((u: UpgradeInfo) => void) | null = null;
export function onUpgradeRequired(fn: ((u: UpgradeInfo) => void) | null) { upgradeListener = fn; }
export function notifyUpgradeRequired(info: UpgradeInfo) {
  if (upgradeListener) upgradeListener(info);
}
