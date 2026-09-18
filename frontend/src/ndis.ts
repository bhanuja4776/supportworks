import bundled from "@/src/data/ndis_catalogue.json";

export type NdisItem = {
  code: string; name: string; category: string; subcategory: string;
  unit: string; rate: number; icon: string; tags: string[];
};
export type Catalogue = { version: string; last_updated: string; source_note: string; items: NdisItem[] };

// Curated filter chips (ordered) so users can tag activities quickly.
export const FILTER_TAGS = [
  "Self-Care", "Community Access", "Household Tasks", "Transport", "Travel",
  "Support Coordination", "Therapy", "Employment", "Group",
  "Weekday", "Evening", "Night", "Saturday", "Sunday", "Public Holiday",
  "Outdoors", "In-home", "Client Transport",
];

// Small (25 items), rarely-changing reference data — bundled with the app
// rather than served from Firestore. There is no longer a backend "check
// for a newer catalogue" round-trip (that hit the now-retired Mongo
// /ndis-catalogue endpoints): a catalogue update means editing this JSON
// file and shipping a new build, same as any other static asset.
export async function loadCatalogue(): Promise<{ catalogue: Catalogue; updateAvailable: boolean }> {
  return { catalogue: bundled as Catalogue, updateAvailable: false };
}

export function filterItems(items: NdisItem[], query: string, tags: string[]): NdisItem[] {
  const q = query.trim().toLowerCase();
  return items.filter((it) => {
    const matchesQuery =
      !q || it.name.toLowerCase().includes(q) || it.code.toLowerCase().includes(q);
    const matchesTags = tags.length === 0 || tags.every((t) => it.tags.includes(t));
    return matchesQuery && matchesTags;
  });
}

export function groupByCategory(items: NdisItem[]): { category: string; items: NdisItem[] }[] {
  const map: Record<string, NdisItem[]> = {};
  for (const it of items) {
    (map[it.category] ||= []).push(it);
  }
  return Object.keys(map).map((category) => ({ category, items: map[category] }));
}
