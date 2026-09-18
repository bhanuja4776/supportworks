import * as clientsService from "@/src/services/clients";
import * as receiptsService from "@/src/services/receipts";
import * as expensesService from "@/src/services/expenses";
import * as shiftsService from "@/src/services/shifts";
import * as tasksService from "@/src/services/tasks";
import * as invoicesService from "@/src/services/invoices";
import * as settingsService from "@/src/services/settings";
import * as credentialsService from "@/src/services/credentials";
import * as dashboardService from "@/src/services/dashboard";
import * as reportsService from "@/src/services/reports";
import * as dailyNotesService from "@/src/services/dailyNotes";
import * as bankService from "@/src/services/bank";
import * as clientDocsService from "@/src/services/clientDocuments";
import * as textDocsService from "@/src/services/textDocuments";
import * as aiService from "@/src/services/ai";
import * as billingService from "@/src/services/billing";

// Re-exported so existing callers (UpgradeSheet.tsx) don't need to change
// their import path — see src/upgradeListener.ts for why this lives in its
// own module now (src/services/ai.ts needs it too, without importing api.ts).
export { onUpgradeRequired } from "@/src/upgradeListener";

export const api = {
  // Auth, privacy/consent, and 2FA were all fully replaced by Firebase
  // Auth back in the very first Auth migration milestone
  // (src/auth/AuthContext.tsx uses onAuthStateChanged + the users/{uid}
  // Firestore doc directly — see ensureProfileDoc/acceptPrivacy/
  // updateProfile there). These req()-based versions were dead code
  // calling a backend nothing in the UI still reached — confirmed via a
  // full app/ reachability search before removal, not assumed. 2FA had no
  // Firebase-native equivalent and was out of scope from the start (see
  // the original migration plan's auth-scope note). resetAccountData can
  // be rebuilt as a real Firestore batch-delete if the account screen
  // ever wants a genuine "delete my data" action.

  // Billing / membership — plans/membership/limits/cancel are pure
  // Firestore (src/services/billing.ts); checkout/status call the two
  // Stripe-dependent Cloud Functions (functions/src/billing.ts)
  billingPlans: () => billingService.billingPlans(),
  billingMembership: () => billingService.billingMembership(),
  billingCheckout: (plan: string, origin_url: string) => billingService.billingCheckout(plan, origin_url),
  billingStatus: (session_id: string) => billingService.billingStatus(session_id),
  billingCancel: () => billingService.billingCancel(),
  billingLimits: () => billingService.billingLimits(),

  // AI — Cloud Functions (src/services/ai.ts / functions/src/ai.ts)
  scanReceipt: (image_base64: string) => aiService.scanReceipt(image_base64),
  scanDocument: (image_base64: string) => aiService.scanDocument(image_base64),
  scanText: (image_base64: string) => aiService.scanText(image_base64),
  ndisAssistant: (messages: { role: string; content: string }[]) => aiService.ndisAssistant(messages),
  appHelp: (messages: { role: string; content: string }[]) => aiService.appHelp(messages),
  transcribe: (audio_base64: string, format = "m4a") => aiService.transcribe(audio_base64, format),

  // NDIS — bundled static reference data (src/ndis.ts), no backend involved
  clientRecentCodes: (id: string) => invoicesService.recentCodesForClient(id),

  // Dashboard — Firestore-backed (src/services/dashboard.ts)
  stats: () => dashboardService.stats(),
  outstanding: () => dashboardService.outstanding(),
  upcoming: (days = 14) => dashboardService.upcoming(days),

  // Invoices
  listInvoices: () => invoicesService.listInvoices(),
  getInvoice: (id: string) => invoicesService.getInvoice(id),
  createInvoice: (body: any) => invoicesService.createInvoice(body),
  setInvoiceStatus: (id: string, status: string) => invoicesService.setInvoiceStatus(id, status),
  deleteInvoice: (id: string) => invoicesService.deleteInvoice(id),

  // Receipts — Firestore + Storage backed (src/services/receipts.ts)
  listReceipts: () => receiptsService.listReceipts(),
  createReceipt: (body: any) => receiptsService.createReceipt(body),
  deleteReceipt: (id: string) => receiptsService.deleteReceipt(id),

  // Text documents (Camera -> Text) — Firestore + Storage backed
  listTextDocuments: () => textDocsService.listTextDocuments(),
  getTextDocument: (id: string) => textDocsService.getTextDocument(id),
  createTextDocument: (body: { title: string; text: string; doc_type?: string; image_base64?: string }) =>
    textDocsService.createTextDocument(body),
  deleteTextDocument: (id: string) => textDocsService.deleteTextDocument(id),

  // Expenses (manual bills / direct debits) — Firestore-backed
  listExpenses: () => expensesService.listExpenses(),
  createExpense: (body: any) => expensesService.createExpense(body),
  updateExpense: (id: string, body: any) => expensesService.updateExpense(id, body),
  deleteExpense: (id: string) => expensesService.deleteExpense(id),

  // Tasks — Firestore-backed
  listTasks: (date?: string) => tasksService.listTasks(date),
  createTask: (body: any) => tasksService.createTask(body),
  updateTask: (id: string, body: any) => tasksService.updateTask(id, body),
  deleteTask: (id: string) => tasksService.deleteTask(id),

  // Clients — Firestore-backed (src/services/clients.ts), not the old REST API
  listClients: () => clientsService.listClients(),
  getClient: (id: string) => clientsService.getClient(id),
  clientBudget: (id: string) => clientsService.clientBudget(id),
  createClient: (body: any) => clientsService.createClient(body),
  updateClient: (id: string, body: any) => clientsService.updateClient(id, body),
  deleteClient: (id: string) => clientsService.deleteClient(id),
  clientOverview: (id: string) => clientsService.clientOverview(id),

  // Client notes (saved from Today's Notes) — Firestore-backed
  addClientNote: (clientId: string, body: { text: string; date?: string }) =>
    clientsService.addClientNote(clientId, body),
  listClientNotes: (clientId: string) => clientsService.listClientNotes(clientId),
  deleteClientNote: (clientId: string, noteId: string) => clientsService.deleteClientNote(clientId, noteId),

  // Reminders — Firestore-backed
  listReminders: (clientId?: string) => clientsService.listReminders(clientId),
  createReminder: (body: any) => clientsService.createReminder(body),
  updateReminder: (id: string, body: any) => clientsService.updateReminder(id, body),
  deleteReminder: (id: string) => clientsService.deleteReminder(id),

  // Reports & settings — Firestore-backed (src/services/reports.ts)
  reportsSummary: (fy?: number) => reportsService.summary(fy),
  exportInvoicesXlsx: () => reportsService.exportInvoicesXlsx(),
  exportReceiptsXlsx: () => reportsService.exportReceiptsXlsx(),
  getSettings: () => settingsService.getSettings(),
  putSettings: (body: any) => settingsService.putSettings(body),
  applyBusinessToInvoices: (invoice_ids: string[]) => invoicesService.applyBusinessToInvoices(invoice_ids),

  // Invoice sent
  markInvoiceSent: (id: string) => invoicesService.markInvoiceSent(id),

  // Credentials — Firestore + Storage backed (src/services/credentials.ts)
  listCredentials: () => credentialsService.listCredentials(),
  createCredential: (body: any) => credentialsService.createCredential(body),
  updateCredential: (id: string, body: any) => credentialsService.updateCredential(id, body),
  deleteCredential: (id: string) => credentialsService.deleteCredential(id),

  // Today's notes — Firestore + Storage backed (src/services/dailyNotes.ts)
  getNote: (date: string) => dailyNotesService.getNote(date),
  putNote: (date: string, body: any) => dailyNotesService.putNote(date, body),

  // Shifts — Firestore-backed (src/services/shifts.ts)
  //
  // startShift/endShift accept optional overrides sourced from the mobile
  // "Confirm start" and "Confirm end" sheets. Both are additive and safe to
  // omit (falls back to now / template defaults).
  startShift: (client_ids: string[], template_id = "", overrides: { started_at?: string; start_time?: string; end_time?: string } = {}) =>
    shiftsService.startShift(client_ids, template_id, overrides),
  activeShift: () => shiftsService.activeShift(),
  endShift: (id: string, overrides: { ended_at?: string; start_time?: string; end_time?: string } = {}) =>
    shiftsService.endShift(id, overrides),
  planShift: (client_ids: string[], scheduled_for: string, template_id = "") =>
    shiftsService.planShift(client_ids, scheduled_for, template_id),
  listShifts: (includeEnded = false) => shiftsService.listShifts(includeEnded),
  activateShift: (id: string) => shiftsService.activateShift(id),
  deleteShift: (id: string) => shiftsService.deleteShift(id),

  // Shift templates — Firestore-backed
  listShiftTemplates: () => shiftsService.listShiftTemplates(),
  createShiftTemplate: (body: any) => shiftsService.createShiftTemplate(body),
  updateShiftTemplate: (id: string, body: any) => shiftsService.updateShiftTemplate(id, body),
  deleteShiftTemplate: (id: string) => shiftsService.deleteShiftTemplate(id),

  // Bank reconciliation — Firestore-backed (src/services/bank.ts)
  bankImport: (csv_text: string) => bankService.bankImport(csv_text),
  bankTransactions: () => bankService.bankTransactions(),
  bankUpdateTxn: (id: string, body: any) => bankService.bankUpdateTxn(id, body),
  bankReconcile: (id: string, invoice_id: string) => bankService.bankReconcile(id, invoice_id),
  bankClear: () => bankService.bankClear(),

  // Client documents — Firestore + Storage backed (src/services/clientDocuments.ts)
  listClientDocs: (clientId: string) => clientDocsService.listClientDocs(clientId),
  createClientDoc: (body: any) => clientDocsService.createClientDoc(body),
  deleteClientDoc: (id: string) => clientDocsService.deleteClientDoc(id),

  // Per-client activity templates (reusable routines / activities the user can drop into a shift) — Firestore-backed
  listActivityTemplates: (clientId: string) => clientsService.listActivityTemplates(clientId),
  createActivityTemplate: (clientId: string, body: any) => clientsService.createActivityTemplate(clientId, body),
  updateActivityTemplate: (clientId: string, templateId: string, body: any) =>
    clientsService.updateActivityTemplate(clientId, templateId, body),
  deleteActivityTemplate: (clientId: string, templateId: string) =>
    clientsService.deleteActivityTemplate(clientId, templateId),

  // Invoice edit / duplicate
  editInvoice: (id: string, body: any) => invoicesService.editInvoice(id, body),
  duplicateInvoice: (id: string) => invoicesService.duplicateInvoice(id),
  addInvoiceItem: (id: string, body: any) => invoicesService.addInvoiceItem(id, body),
};

export const money = (n: number) =>
  `$${(n || 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ---- Australian date formatting (display DD/MM/YYYY, store ISO YYYY-MM-DD) ----
export const toDMY = (iso?: string): string => {
  if (!iso) return "";
  const s = String(iso).slice(0, 10);
  const p = s.split(/[-/]/);
  if (p.length === 3 && p[0].length === 4) return `${p[2]}/${p[1]}/${p[0]}`;
  return s;
};

// Parse a DD/MM/YYYY (or partial) string to ISO YYYY-MM-DD; returns "" if incomplete/invalid.
export const fromDMY = (dmy?: string): string => {
  if (!dmy) return "";
  const m = dmy.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  const d = m[1].padStart(2, "0"), mo = m[2].padStart(2, "0"), y = m[3];
  const dt = new Date(`${y}-${mo}-${d}T00:00:00`);
  if (isNaN(dt.getTime())) return "";
  return `${y}-${mo}-${d}`;
};
