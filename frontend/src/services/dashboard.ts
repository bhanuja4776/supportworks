// Firestore-backed replacement for the /dashboard/* REST endpoints.
// Reduction logic ported verbatim from server.py:1334-1453 (dashboard_stats,
// dashboard_upcoming, dashboard_outstanding) — same fields, same rounding,
// same overdue/upcoming windows — just reading Firestore collections
// instead of aggregating Mongo cursors.
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
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

async function ownedDocs(uid: string, collectionName: string): Promise<any[]> {
  const snap = await getDocs(query(collection(db, collectionName), where("ownerId", "==", uid)));
  return snap.docs.map((d) => docOut(d.id, d.data()));
}

const today = () => new Date().toISOString().slice(0, 10);
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export async function stats(): Promise<Record<string, any>> {
  const uid = requireUid();
  const [invoices, receipts, tasks] = await Promise.all([
    ownedDocs(uid, "invoices"), ownedDocs(uid, "receipts"), ownedDocs(uid, "tasks"),
  ]);
  const t = today();
  const todaysTasks = tasks.filter((x) => x.date === t);

  const paid = invoices.filter((i) => i.status === "paid");
  const unpaid = invoices.filter((i) => i.status === "unpaid");
  const earnings = round2(paid.reduce((s, i) => s + (Number(i.total) || 0), 0));
  const outstanding = round2(unpaid.reduce((s, i) => s + (Number(i.total) || 0), 0));
  const expenses = round2(receipts.reduce((s, r) => s + (Number(r.total) || 0), 0));
  const gst_collected = round2(paid.reduce((s, i) => s + (Number(i.gst) || 0), 0));
  const overdue = unpaid.filter((i) => i.due_date && i.due_date < t);
  const overdue_amount = round2(overdue.reduce((s, i) => s + (Number(i.total) || 0), 0));

  return {
    earnings, outstanding, expenses, gst_collected,
    invoice_count: invoices.length, paid_count: paid.length, unpaid_count: unpaid.length,
    overdue_count: overdue.length, overdue_amount,
    receipt_count: receipts.length,
    tasks_today: todaysTasks.length, tasks_done_today: todaysTasks.filter((x) => x.completed).length,
  };
}

export async function upcoming(days = 14): Promise<any[]> {
  const uid = requireUid();
  const [expenses, credentials] = await Promise.all([
    ownedDocs(uid, "expenses"), ownedDocs(uid, "credentials"),
  ]);
  const now = new Date();
  const todayD = new Date(now.toISOString().slice(0, 10) + "T00:00:00Z");
  const horizon = new Date(todayD.getTime() + days * 86400000);

  const parse = (d?: string) => {
    if (!d) return null;
    const dt = new Date(d.slice(0, 10) + "T00:00:00Z");
    return isNaN(dt.getTime()) ? null : dt;
  };
  const daysUntil = (d: Date) => Math.round((d.getTime() - todayD.getTime()) / 86400000);

  const items: any[] = [];
  for (const e of expenses) {
    for (const [field, kind] of [["due_date", "due"], ["renewal_date", "renewal"]] as const) {
      const d = parse(e[field]);
      if (d && d <= horizon) {
        items.push({
          id: `${e.id}:${kind}`, kind,
          title: e.name || "Cost",
          subtitle: (e.category || "") + (e.direct_debit && kind === "due" ? " · Direct debit" : ""),
          date: d.toISOString().slice(0, 10),
          days_until: daysUntil(d),
          amount: round2(e.cost),
          direct_debit: !!e.direct_debit,
        });
      }
    }
  }
  for (const c of credentials) {
    const d = parse(c.expiry_date);
    if (d && d <= horizon) {
      items.push({
        id: `${c.id}:cert`, kind: "cert",
        title: c.title || "Credential",
        subtitle: (c.type || "") + (c.issuer ? ` · ${c.issuer}` : ""),
        date: d.toISOString().slice(0, 10),
        days_until: daysUntil(d),
        amount: 0, direct_debit: false,
      });
    }
  }
  items.sort((a, b) => a.date.localeCompare(b.date));
  return items;
}

function initials(name?: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
}

export async function outstanding(): Promise<any[]> {
  const uid = requireUid();
  const [invoicesRaw, clients, shifts] = await Promise.all([
    ownedDocs(uid, "invoices"), ownedDocs(uid, "clients"), ownedDocs(uid, "shifts"),
  ]);
  const clientsById = new Map(clients.map((c) => [c.id, c]));
  const shiftsById = new Map(shifts.map((s) => [s.id, s]));
  const t = new Date();

  let invoices = invoicesRaw
    .filter((i) => i.status === "unpaid" && (Number(i.total) || 0) > 0)
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));

  return invoices.map((i) => {
    const client = clientsById.get(i.client_id);
    const sent = i.sent_date || i.issue_date || "";
    let days_since_sent: number | null = null;
    if (sent) {
      const d = new Date(sent.slice(0, 10) + "T00:00:00Z");
      if (!isNaN(d.getTime())) {
        days_since_sent = Math.max(0, Math.round((t.getTime() - d.getTime()) / 86400000));
      }
    }
    const shift = i.shift_id ? shiftsById.get(i.shift_id) : null;
    const shift_date = shift?.started_at ? String(shift.started_at).slice(0, 10) : "";
    const name = i.client_name || client?.name || "";
    return {
      id: i.id, invoice_number: i.invoice_number || "", total: round2(i.total),
      sent_date: sent, days_since_sent,
      client_name: name, client_initials: initials(name),
      client_color: client?.color || "#00E5FF",
      shift_date, due_date: i.due_date || "",
    };
  });
}
