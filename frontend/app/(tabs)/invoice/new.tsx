import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, FlatList,
  Platform, ActivityIndicator, Alert,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, money } from "@/src/api";
import { formatTime24h } from "@/src/utils/time";
import { colors, radius, spacing, weight } from "@/src/theme";
import { VoiceField } from "@/src/components/VoiceField";
import { useConfirm } from "@/src/components/Celebration";
import { confirmAction } from "@/src/utils/confirm";
import { DateInput } from "@/src/components/DateInput";
import { ensureNotifPermission, scheduleReminder } from "@/src/notifications";
import { shareInvoicePdf } from "@/src/pdf/invoicePdf";
import { loadCatalogue, filterItems, FILTER_TAGS, NdisItem } from "@/src/ndis";
import { useTranslation } from "react-i18next";

type Item = {
  description: string; ndis_code: string; quantity: string; rate: string;
  service_date: string; start_time: string; end_time: string; gst_free: boolean;
};
type Participant = {
  key: string;
  client_id: string;
  name: string;
  ndis: string;
  company: string;
  address: string;
  email: string;
  notes: string;
  collapsed: boolean;
  items: Item[];
};

let _seq = 0;
const uid = () => `p${Date.now()}_${_seq++}`;
const blankItem = (): Item => ({ description: "", ndis_code: "", quantity: "1", rate: "", service_date: "", start_time: "", end_time: "", gst_free: true });

// Compact d-MMM date used in the "glance" summary strip.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function _formatDMY(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[(m - 1) % 12]}`;
}
const blankParticipant = (seed?: Partial<Participant>): Participant => ({
  key: uid(), client_id: "", name: "", ndis: "", company: "", address: "", email: "",
  notes: "", collapsed: false, items: [blankItem()], ...seed,
});
const partTotals = (p: Participant) => {
  let sub = 0, gst = 0;
  p.items.forEach((it) => {
    const amt = (parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0);
    sub += amt;
    if (!it.gst_free) gst += amt * 0.1; // most NDIS supports are GST-free
  });
  return { sub, gst, total: sub + gst };
};

export default function NewInvoice() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ clientId?: string; clientName?: string; ndis?: string; company?: string; address?: string; email?: string; editId?: string; presetCode?: string; presetDesc?: string; presetRate?: string }>();
  const confirm = useConfirm();
  const editId = params.editId || "";
  const isEdit = !!editId;

  const [loadedStatus, setLoadedStatus] = useState("unpaid");
  const [invoiceNumber, setInvoiceNumber] = useState("");   // editable — blank means server-assigned
  const [invoiceNumberOriginal, setInvoiceNumberOriginal] = useState(""); // remembers what we loaded so we can spot manual edits
  const [invoiceNumberDupe, setInvoiceNumberDupe] = useState(false);      // duplicate-guard warning
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [ttp, setTtp] = useState(false);
  // NDIS plan management category for the invoice — controls which fields show up.
  const [mgmtType, setMgmtType] = useState<"self_managed" | "plan_managed" | "ndia_managed">("self_managed");
  const [planMgrName, setPlanMgrName] = useState("");
  const [planMgrEmail, setPlanMgrEmail] = useState("");
  const [acceptedCodes, setAcceptedCodes] = useState<string[]>([]);

  const [participants, setParticipants] = useState<Participant[]>([
    blankParticipant({
      client_id: params.clientId || "",
      name: params.clientName || "",
      ndis: params.ndis || "",
      company: params.company || "",
      address: params.address || "",
      email: params.email || "",
      items: params.presetCode
        ? [{ ...blankItem(), description: params.presetDesc || "", ndis_code: params.presetCode, quantity: "1", rate: params.presetRate || "" }]
        : [blankItem()],
    }),
  ]);

  const [catItems, setCatItems] = useState<NdisItem[]>([]);
  const [recentCodes, setRecentCodes] = useState<any[]>([]);
  const [favourites, setFavourites] = useState<string[]>([]);
  const [codeQuery, setCodeQuery] = useState("");
  const [codeTags, setCodeTags] = useState<string[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [clientPickerFor, setClientPickerFor] = useState<number | null>(null);
  const [pickerFor, setPickerFor] = useState<{ p: number; i: number } | null>(null);
  const [busy, setBusy] = useState<"" | "send" | "save" | "delete">("");
  const [shiftPrompt, setShiftPrompt] = useState(false);
  const [activeShiftId, setActiveShiftId] = useState("");

  // ---- Multi-date invoicing: import line items from past ended shifts ----
  const [importFor, setImportFor] = useState<number | null>(null);   // participant index whose importer is open
  const [pastShifts, setPastShifts] = useState<any[]>([]);            // { id, started_at, items[], invoice_number }
  const [importPicked, setImportPicked] = useState<Record<string, boolean>>({});
  const [importBusy, setImportBusy] = useState(false);

  const openImportShifts = async (pIdx: number) => {
    const cid = participants[pIdx]?.client_id;
    if (!cid) {
      Alert.alert(t("invoiceNew.pickParticipantFirst"));
      return;
    }
    setImportFor(pIdx);
    setImportPicked({});
    setImportBusy(true);
    try {
      const [shiftsAll, invsAll] = await Promise.all([
        api.listShifts(true),
        api.listInvoices(),
      ]);
      // Bucket invoices by shift_id for this participant.
      const byShift: Record<string, any[]> = {};
      (invsAll || []).forEach((inv: any) => {
        if (inv.client_id === cid && inv.shift_id) {
          (byShift[inv.shift_id] = byShift[inv.shift_id] || []).push(inv);
        }
      });
      // Only ENDED shifts + only if at least one linked invoice for this client + within 8 weeks.
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 8 * 7);
      const rows = (shiftsAll || [])
        .filter((s: any) => s.status === "ended" && byShift[s.id])
        .filter((s: any) => !s.started_at || new Date(s.started_at) >= cutoff)
        .map((s: any) => {
          const invs = byShift[s.id];
          const items = invs.flatMap((inv: any) => (inv.items || []).map((it: any) => ({ ...it, _source_invoice: inv.invoice_number })));
          const startedAt = s.started_at || s.scheduled_for || s.created_at || "";
          const hours = items.reduce((h: number, it: any) => {
            if (it.start_time && it.end_time) {
              const [sh, sm] = String(it.start_time).split(":").map(Number);
              const [eh, em] = String(it.end_time).split(":").map(Number);
              const mins = ((eh || 0) * 60 + (em || 0)) - ((sh || 0) * 60 + (sm || 0));
              return h + Math.max(0, mins) / 60;
            }
            return h + (Number(it.quantity) || 0);
          }, 0);
          const amount = items.reduce((a: number, it: any) => a + (Number(it.quantity) || 0) * (Number(it.rate) || 0), 0);
          return { id: s.id, started_at: startedAt, items, invoice_numbers: invs.map((i: any) => i.invoice_number), hours, amount };
        })
        .sort((a: any, b: any) => (b.started_at || "").localeCompare(a.started_at || ""));
      setPastShifts(rows);
    } catch {
      setPastShifts([]);
    } finally {
      setImportBusy(false);
    }
  };

  const closeImportShifts = () => { setImportFor(null); setPastShifts([]); setImportPicked({}); };

  const applyImportedShifts = () => {
    if (importFor === null) return;
    const picked = pastShifts.filter((s) => importPicked[s.id]);
    if (picked.length === 0) { closeImportShifts(); return; }
    const newItems: Item[] = [];
    picked.forEach((s) => {
      const date = (s.started_at || "").slice(0, 10);
      s.items.forEach((it: any) => {
        newItems.push({
          description: it.description || "",
          ndis_code: it.ndis_code || "",
          quantity: String(it.quantity ?? "1"),
          rate: String(it.rate ?? ""),
          service_date: it.service_date || date,
          start_time: it.start_time || "",
          end_time: it.end_time || "",
          gst_free: it.gst_free !== false,
        });
      });
    });
    setParticipants((prev) => prev.map((p, i) => {
      if (i !== importFor) return p;
      // Drop the leading blank row if the user hasn't started editing it.
      const blank = (it: Item) => !it.description && !it.ndis_code && !it.rate && !it.service_date;
      const trimmed = p.items.length === 1 && blank(p.items[0]) ? [] : p.items;
      return { ...p, items: [...trimmed, ...newItems] };
    }));
    confirm(t("invoiceNew.importedShifts", { count: picked.length }));
    closeImportShifts();
  };

  // ---- AI Code Assistant (opens from the code picker for quick amendments) ----
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ role: "user" | "assistant"; content: string; codes?: any[] }[]>([]);
  const openAiAssistant = () => {
    setAiOpen(true);
    if (aiMessages.length === 0) {
      setAiMessages([{ role: "assistant", content: t("invoiceNew.aiIntro") }]);
    }
  };
  const askAi = async () => {
    const q = aiInput.trim();
    if (!q || aiBusy) return;
    const next = [...aiMessages, { role: "user" as const, content: q }];
    setAiMessages(next);
    setAiInput("");
    setAiBusy(true);
    try {
      const payload = next.map((m) => ({ role: m.role, content: m.content }));
      const res = await api.ndisAssistant(payload);
      setAiMessages((m) => [...m, { role: "assistant", content: res.answer, codes: res.codes }]);
    } catch {
      setAiMessages((m) => [...m, { role: "assistant", content: t("invoiceNew.aiError") }]);
    } finally {
      setAiBusy(false);
    }
  };
  const applyAiCode = (code: any) => {
    // Apply into whichever line item the picker was opened on.
    if (pickerFor === null) return;
    // Fresh code picks always update the description so users don't end up
    // with a description that mismatches the code they just chose.
    setItem(pickerFor.p, pickerFor.i, {
      ndis_code: code.code,
      rate: String(code.rate ?? ""),
      description: code.name || code.description || "",
    });
    setAiOpen(false);
    setPickerFor(null);
    confirm(t("invoiceNew.aiApplied", { code: code.code }));
  };

  useEffect(() => {
    loadCatalogue().then(({ catalogue }) => setCatItems(catalogue.items)).catch(() => {});
    api.listClients().then(setClients).catch(() => {});
    api.getSettings().then((s) => setFavourites(Array.isArray(s?.favourite_codes) ? s.favourite_codes : [])).catch(() => {});
    if (editId) {
      api.getInvoice(editId).then((inv) => {
        setLoadedStatus(inv.status || "unpaid");
        setInvoiceNumber(inv.invoice_number || "");
        setInvoiceNumberOriginal(inv.invoice_number || "");
        setIssueDate(inv.issue_date || new Date().toISOString().slice(0, 10));
        setServiceDate(inv.service_date || inv.issue_date || new Date().toISOString().slice(0, 10));
        setDueDate(inv.due_date || "");
        setTtp(!!inv.ttp);
        setMgmtType((inv.management_type as any) || "self_managed");
        setPlanMgrName(inv.plan_manager_name || "");
        setPlanMgrEmail(inv.plan_manager_email || "");
        setParticipants([blankParticipant({
          client_id: inv.client_id || "",
          name: inv.client_name || "",
          ndis: inv.participant_ndis_number || "",
          company: inv.client_company || "",
          address: inv.client_address || "",
          email: inv.client_email || "",
          notes: inv.notes || "",
          items: inv.items?.length
            ? inv.items.map((it: any) => ({
                description: it.description || "", ndis_code: it.ndis_code || "",
                quantity: String(it.quantity ?? "1"), rate: String(it.rate ?? ""),
                service_date: it.service_date || "", start_time: it.start_time || "",
                end_time: it.end_time || "", gst_free: it.gst_free !== false,
              }))
            : [blankItem()],
        })]);
      }).catch(() => {});
    }
  }, [editId]);

  // Debounced duplicate-check for the manually-typed invoice number.
  // Only checks after 500ms of idle typing, and only when the number is different
  // from what we loaded (i.e. the user actually changed it). Warning only — the
  // server enforces uniqueness with a 409 on save.
  useEffect(() => {
    const num = (invoiceNumber || "").trim();
    if (!num || num === invoiceNumberOriginal) { setInvoiceNumberDupe(false); return; }
    const timer = setTimeout(async () => {
      try {
        const all = await api.listInvoices();
        const clash = (Array.isArray(all) ? all : []).some(
          (i: any) => i.invoice_number === num && i.id !== editId
        );
        setInvoiceNumberDupe(clash);
      } catch {
        setInvoiceNumberDupe(false); // network hiccup — don't misinform the user
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [invoiceNumber, invoiceNumberOriginal, editId]);

  // Load recent codes for whichever participant's code picker is open.
  useEffect(() => {
    const cid = pickerFor !== null ? participants[pickerFor.p]?.client_id : "";
    if (cid) api.clientRecentCodes(cid).then(setRecentCodes).catch(() => setRecentCodes([]));
    else setRecentCodes([]);
    // Only refetch when the picker target changes, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerFor]);

  const setP = (pIdx: number, patch: Partial<Participant>) =>
    setParticipants((prev) => prev.map((p, i) => (i === pIdx ? { ...p, ...patch } : p)));
  const setItem = (pIdx: number, iIdx: number, patch: Partial<Item>) =>
    setParticipants((prev) => prev.map((p, i) => (i === pIdx ? { ...p, items: p.items.map((it, j) => (j === iIdx ? { ...it, ...patch } : it)) } : p)));
  const addItem = (pIdx: number) => setP(pIdx, { items: [...participants[pIdx].items, blankItem()] });
  const removeItem = (pIdx: number, iIdx: number) => setP(pIdx, { items: participants[pIdx].items.filter((_, j) => j !== iIdx) });

  const addParticipant = () => setParticipants((prev) => [...prev.map((p) => ({ ...p, collapsed: true })), blankParticipant()]);
  const removeParticipant = (pIdx: number) => setParticipants((prev) => prev.filter((_, i) => i !== pIdx));
  const toggleCollapse = (pIdx: number) => setP(pIdx, { collapsed: !participants[pIdx].collapsed });

  // Copy a line item to every OTHER participant — the "copy & paste" feature.
  const copyItemToOthers = (pIdx: number, iIdx: number) => {
    if (participants.length < 2) { confirm(t("invoiceNew.noOthersToCopy")); return; }
    const src = participants[pIdx].items[iIdx];
    setParticipants((prev) => prev.map((p, i) => (i === pIdx ? p : { ...p, items: [...p.items, { ...src }] })));
    confirm(t("invoiceNew.copiedItems", { count: participants.length - 1 }));
  };

  const pickClient = (c: any) => {
    if (clientPickerFor === null) return;
    setP(clientPickerFor, {
      client_id: c.id, name: c.name, company: c.company || "", address: c.address || "",
      email: c.email || "", ndis: c.ndis_number || participants[clientPickerFor].ndis,
    });
    // Auto-hydrate the invoice's management type & plan manager from the linked client (first participant only).
    if (clientPickerFor === 0) {
      if (c.management_type) setMgmtType(c.management_type);
      setPlanMgrName(c.plan_manager_name || "");
      setPlanMgrEmail(c.plan_manager_email || "");
      setAcceptedCodes(Array.isArray(c.accepted_plan_codes) ? c.accepted_plan_codes : []);
    }
    setClientPickerFor(null);
  };

  const applyCode = (code: any) => {
    if (pickerFor === null) return;
    // Description follows the picked code (fixes: "changing the code should
    // change the description too, not only when the field is empty").
    const desc = code.name || code.label || code.description || "";
    setItem(pickerFor.p, pickerFor.i, { ndis_code: code.code, rate: String(code.rate ?? ""), description: desc });
    setPickerFor(null); setCodeQuery(""); setCodeTags([]);
  };
  const toggleCodeTag = (tag: string) => setCodeTags((s) => (s.includes(tag) ? s.filter((x) => x !== tag) : [...s, tag]));
  const filteredCat = filterItems(catItems, codeQuery, codeTags);
  const toggleFavourite = (code: string) => {
    setFavourites((prev) => {
      const next = prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code];
      api.putSettings({ favourite_codes: next }).catch(() => {});
      return next;
    });
  };
  const favouriteItems = catItems.filter((it) => favourites.includes(it.code));
  // Codes the currently-picking participant has flagged as accepted / preferred —
  // these appear as one-tap suggestions right above the global favourites so
  // users don't have to re-search for the same codes for the same client every time.
  const pickerClient = pickerFor !== null ? participants[pickerFor.p] : null;
  const acceptedForPicker: string[] = (() => {
    if (!pickerClient?.client_id) return [];
    const c = clients.find((x: any) => x.id === pickerClient.client_id);
    return Array.isArray(c?.accepted_plan_codes) ? c!.accepted_plan_codes : [];
  })();
  const suggestedForClient = catItems.filter((it) => acceptedForPicker.includes(it.code));
  const showShortcuts = !codeQuery && codeTags.length === 0;

  const grandSub = participants.reduce((s, p) => s + partTotals(p).sub, 0);
  const grandGst = participants.reduce((s, p) => s + partTotals(p).gst, 0);
  const grandTotal = grandSub + grandGst;

  // ---- Multi-date "glance" summary ----
  // Roll up unique service dates, total hours worked and item count so the
  // user can see at a glance what they're invoicing for. Falls back to the
  // invoice-level service date when a line hasn't been given its own.
  const allItems = participants.flatMap((p) => p.items);
  const dateSet = new Set<string>();
  let totalHoursMin = 0;
  let filledItems = 0;
  allItems.forEach((it) => {
    if (!it.description && !it.ndis_code && !it.rate) return; // skip empty rows
    filledItems += 1;
    const d = (it.service_date || serviceDate || "").slice(0, 10);
    if (d) dateSet.add(d);
    if (it.start_time && it.end_time) {
      const [sh, sm] = it.start_time.split(":").map(Number);
      const [eh, em] = it.end_time.split(":").map(Number);
      const m = ((eh || 0) * 60 + (em || 0)) - ((sh || 0) * 60 + (sm || 0));
      if (m > 0) totalHoursMin += m;
    } else if (parseFloat(it.quantity) > 0 && !it.ndis_code.includes("KM")) {
      // Fallback: treat quantity as hours for hourly-style lines.
      totalHoursMin += (parseFloat(it.quantity) || 0) * 60;
    }
  });
  const uniqueDates = Array.from(dateSet).sort();
  const dateRange = uniqueDates.length === 0 ? "" :
    uniqueDates.length === 1 ? _formatDMY(uniqueDates[0]) :
    `${_formatDMY(uniqueDates[0])} – ${_formatDMY(uniqueDates[uniqueDates.length - 1])}`;
  const totalHoursText = totalHoursMin > 0 ? `${(totalHoursMin / 60).toFixed(1)} ${t("invoiceNew.hoursShort")}` : "";

  // ---- NDIS compliance checks: every participant must satisfy each field ----
  const everyP = (fn: (p: Participant) => boolean) => participants.every(fn);
  const checks = [
    { key: "name", label: t("invoiceNew.checkName"), ok: everyP((p) => !!p.name.trim()) },
    { key: "ndis", label: t("invoiceNew.checkNdis"), ok: everyP((p) => !!p.ndis.trim()) },
    { key: "contact", label: t("invoiceNew.checkContact"), ok: everyP((p) => !!(p.address.trim() || p.email.trim())) },
    { key: "service", label: t("invoiceNew.checkService"), ok: !!serviceDate },
    { key: "issue", label: t("invoiceNew.checkIssue"), ok: !!issueDate },
    { key: "due", label: t("invoiceNew.checkDue"), ok: !!dueDate },
    { key: "items", label: t("invoiceNew.checkItems"), ok: everyP((p) => p.items.some((it) => it.description.trim() && (parseFloat(it.rate) || 0) > 0)) },
    {
      key: "dateOrder", label: t("invoiceNew.checkDateOrder"),
      ok: !!issueDate && !!serviceDate && issueDate >= serviceDate,
    },
  ];
  const complete = checks.filter((c) => c.ok).length;
  const isCompliant = complete === checks.length;
  const okBorder = (ok: boolean) => (ok ? { borderColor: colors.success } : { borderColor: colors.error });

  const bodyFor = (p: Participant, status: string, shiftId = "") => ({
    client_id: p.client_id, client_name: p.name, client_company: p.company,
    client_address: p.address, client_email: p.email, participant_ndis_number: p.ndis,
    notes: p.notes, issue_date: issueDate, service_date: serviceDate, due_date: dueDate, status, shift_id: shiftId, ttp,
    management_type: mgmtType,
    plan_manager_name: mgmtType === "plan_managed" ? planMgrName : "",
    plan_manager_email: mgmtType === "plan_managed" ? planMgrEmail : "",
    // Manual invoice number override — server auto-generates INV-XXXX when blank.
    // Only send it when editing OR when the user has typed something for a new invoice,
    // so multi-participant creates still get unique auto numbers.
    invoice_number: isEdit ? (invoiceNumber || "") : (invoiceNumber && invoiceNumber !== invoiceNumberOriginal ? invoiceNumber : ""),
    items: p.items.map((it) => ({
      description: it.description, ndis_code: it.ndis_code,
      quantity: parseFloat(it.quantity) || 0, rate: parseFloat(it.rate) || 0,
      // Per-line service date — falls back to the invoice-level date when the
      // user hasn't set one. This is what powers multi-date invoicing.
      service_date: it.service_date || serviceDate,
      start_time: it.start_time, end_time: it.end_time, gst_free: it.gst_free,
    })),
  });

  // Warn (non-blocking) when a line item uses a code NOT in the client's accepted list.
  const codeMismatches = acceptedCodes.length > 0
    ? participants.flatMap((p) => p.items
        .filter((it) => it.ndis_code && !acceptedCodes.includes(it.ndis_code))
        .map((it) => it.ndis_code))
    : [];

  const scheduleDue = async (inv: any, name: string) => {
    try {
      if (!dueDate) return;
      const d = new Date(`${dueDate}T09:00:00`);
      if (isNaN(d.getTime())) return;
      if (await ensureNotifPermission()) {
        await scheduleReminder(t("invoiceNew.reminderTitle"), t("invoiceNew.reminderBody", { number: inv.invoice_number, client: name || t("invoiceNew.clientFallback"), amount: money(inv.total) }), d.toISOString());
      }
    } catch {}
  };

  const persist = async (status: string, action: "send" | "save", shiftId = "") => {
    if (!participants.every((p) => p.name.trim())) { Alert.alert(t("invoiceNew.needName")); return; }
    setBusy(action);
    try {
      const created: any[] = [];
      if (isEdit) {
        const inv = await api.editInvoice(editId, bodyFor(participants[0], status === "draft" ? (loadedStatus === "draft" ? "draft" : loadedStatus) : status, shiftId));
        created.push(inv);
      } else {
        for (const p of participants) created.push(await api.createInvoice(bodyFor(p, status, shiftId)));
      }
      if (action === "send") {
        for (const inv of created) await api.markInvoiceSent(inv.id).catch(() => {});
      }
      for (let i = 0; i < created.length; i++) await scheduleDue(created[i], participants[i]?.name || participants[0]?.name);

      if (action === "send" && created.length === 1) {
        confirm(t("invoiceNew.sentToast", { count: 1 }));
        const settings = await api.getSettings().catch(() => null);
        await shareInvoicePdf(created[0], settings).catch(() => {});
      } else if (action === "send") {
        confirm(t("invoiceNew.sentToast", { count: created.length }));
      } else {
        confirm(shiftId ? t("invoiceNew.attachedShift") : t("invoiceNew.savedToast", { count: created.length }));
      }
      router.back();
    } catch (e: any) {
      Alert.alert(t("invoiceNew.saveErrorTitle"), e?.message || t("invoiceNew.saveErrorBody"));
      setBusy("");
    }
  };

  const onSend = () => persist(isEdit ? loadedStatus === "draft" ? "unpaid" : loadedStatus : "unpaid", "send");

  const onSave = async () => {
    // Standalone-safe: saving never requires a shift. Offer to attach if one is active.
    if (!isEdit) {
      try {
        const active = (await api.activeShift())?.shift;
        if (active?.id) { setActiveShiftId(active.id); setShiftPrompt(true); return; }
      } catch {}
    }
    persist("draft", "save");
  };

  const onDelete = () => {
    confirmAction({
      title: isEdit ? t("invoiceNew.deleteInvoiceTitle") : t("invoiceNew.discardTitle"),
      message: isEdit ? t("invoiceNew.deleteInvoiceMsg") : t("invoiceNew.discardMsg"),
      confirmText: isEdit ? t("invoiceNew.deleteBtn") : t("invoiceNew.discard"),
      destructive: true,
      onConfirm: async () => {
        if (isEdit) { setBusy("delete"); try { await api.deleteInvoice(editId); } catch {} }
        router.back();
      },
    });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEdit ? t("invoiceNew.editTitle") : t("invoiceNew.newTitle")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Editable invoice number — power-user field. Blank on a NEW invoice
              means the server will assign the next INV-XXXX in sequence. In
              edit-mode we prefill the existing number. Duplicates are checked
              debounced client-side (soft warning) + hard-blocked server-side. */}
          <View style={{ marginBottom: spacing.md }}>
            <Text style={styles.label}>{t("invoiceNew.invoiceNumber")}</Text>
            <TextInput
              testID="invoice-number-input"
              value={invoiceNumber}
              onChangeText={setInvoiceNumber}
              placeholder={isEdit ? invoiceNumberOriginal : t("invoiceNew.invoiceNumberPh")}
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              style={[styles.input, invoiceNumberDupe && { borderColor: colors.warning }]}
            />
            {invoiceNumberDupe ? (
              <Text style={[styles.dateHint, { color: colors.warning }]} testID="invoice-number-dupe">
                {t("invoiceNew.invoiceNumberDupe", { number: invoiceNumber })}
              </Text>
            ) : (
              <Text style={styles.dateHint}>{t("invoiceNew.invoiceNumberHint")}</Text>
            )}
          </View>

          {/* Shared dates */}
          <View style={{ marginBottom: spacing.md }}>
            <Text style={styles.label}>{t("invoiceNew.serviceDate")}</Text>
            <DateInput testID="service-date-input" value={serviceDate} onChange={setServiceDate} style={[styles.input, okBorder(!!serviceDate)]} />
            <Text style={styles.dateHint}>{t("invoiceNew.serviceDateHint")}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.md, marginBottom: spacing.lg }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{t("invoiceNew.issueDate")}</Text>
              <DateInput testID="issue-date-input" value={issueDate} onChange={setIssueDate} style={[styles.input, okBorder(!!issueDate)]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{t("invoiceNew.dueDate")}</Text>
              <DateInput testID="due-date-input" value={dueDate} onChange={setDueDate} style={[styles.input, okBorder(!!dueDate)]} />
            </View>
          </View>

          <Pressable testID="ttp-toggle" onPress={() => setTtp(!ttp)} style={[styles.ttpRow, ttp && { borderColor: colors.brand }]}>
            <Ionicons name={ttp ? "checkbox" : "square-outline"} size={20} color={ttp ? colors.brand : colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.ttpLabel}>{t("invoiceNew.ttpLabel")}</Text>
              <Text style={styles.dateHint}>{t("invoiceNew.ttpHint")}</Text>
            </View>
          </Pressable>

          {/* Plan management type — drives which recipient details appear on the invoice. */}
          <Text style={styles.label}>{t("invoiceNew.mgmtTypeLabel")}</Text>
          <View style={styles.mgmtRow}>
            {[
              { key: "self_managed", label: t("invoiceNew.mgmtSelf"), icon: "person" },
              { key: "plan_managed", label: t("invoiceNew.mgmtPlan"), icon: "business" },
              { key: "ndia_managed", label: t("invoiceNew.mgmtNdia"), icon: "shield" },
            ].map((opt) => (
              <Pressable
                key={opt.key}
                testID={`inv-mgmt-${opt.key}`}
                onPress={() => setMgmtType(opt.key as any)}
                style={[styles.mgmtChip, mgmtType === opt.key && styles.mgmtChipOn]}
              >
                <Ionicons name={opt.icon as any} size={14} color={mgmtType === opt.key ? colors.onBrand : colors.brand} />
                <Text style={[styles.mgmtChipText, mgmtType === opt.key && { color: colors.onBrand }]}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
          {mgmtType === "plan_managed" && (
            <View style={styles.pmBlock}>
              <Text style={styles.dateHint}>{t("invoiceNew.pmHint")}</Text>
              <View style={{ marginTop: spacing.sm }}>
                <Text style={styles.label}>{t("invoiceNew.pmName")}</Text>
                <TextInput testID="inv-pm-name" value={planMgrName} onChangeText={setPlanMgrName} placeholder={t("invoiceNew.pmNamePh")} placeholderTextColor={colors.muted} style={styles.input} />
              </View>
              <View style={{ marginTop: spacing.md }}>
                <Text style={styles.label}>{t("invoiceNew.pmEmail")}</Text>
                <TextInput testID="inv-pm-email" value={planMgrEmail} onChangeText={setPlanMgrEmail} placeholder={t("invoiceNew.pmEmailPh")} placeholderTextColor={colors.muted} style={[styles.input, planMgrEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(planMgrEmail) ? { borderColor: colors.warning } : {}]} keyboardType="email-address" autoCapitalize="none" />
              </View>
            </View>
          )}
          {mgmtType === "ndia_managed" && (
            <View style={styles.pmBlock}>
              <Text style={styles.dateHint}>{t("invoiceNew.ndiaHint")}</Text>
            </View>
          )}
          {codeMismatches.length > 0 && (
            <View style={styles.warnBlock} testID="plan-code-warning">
              <Ionicons name="warning" size={16} color={colors.warning} />
              <Text style={styles.warnText}>{t("invoiceNew.codeWarning", { codes: [...new Set(codeMismatches)].join(", ") })}</Text>
            </View>
          )}

          {/* ---------- Glance summary strip ---------- */}
          {/* Auto-updates as line items change. Shows unique service dates,   */}
          {/* total items, hours worked and grand total in one horizontal      */}
          {/* card — perfect for weekly / multi-date invoices.                 */}
          {filledItems > 0 && (
            <View style={styles.glanceCard} testID="invoice-glance">
              <View style={styles.glanceRow}>
                <View style={styles.glanceCell}>
                  <Ionicons name="calendar" size={14} color={colors.brand} />
                  <Text style={styles.glanceValue} testID="glance-dates">
                    {uniqueDates.length === 0 ? "—" : t(uniqueDates.length === 1 ? "invoiceNew.datesCountOne" : "invoiceNew.datesCountMany", { count: uniqueDates.length })}
                  </Text>
                  <Text style={styles.glanceLabel}>{t("invoiceNew.glanceDates")}</Text>
                </View>
                <View style={styles.glanceSep} />
                <View style={styles.glanceCell}>
                  <Ionicons name="list" size={14} color={colors.brand} />
                  <Text style={styles.glanceValue} testID="glance-items">{filledItems}</Text>
                  <Text style={styles.glanceLabel}>{t("invoiceNew.glanceItems")}</Text>
                </View>
                <View style={styles.glanceSep} />
                <View style={styles.glanceCell}>
                  <Ionicons name="time" size={14} color={colors.brand} />
                  <Text style={styles.glanceValue} testID="glance-hours">{totalHoursText || "—"}</Text>
                  <Text style={styles.glanceLabel}>{t("invoiceNew.glanceHours")}</Text>
                </View>
                <View style={styles.glanceSep} />
                <View style={styles.glanceCell}>
                  <Ionicons name="cash" size={14} color={colors.brand} />
                  <Text style={styles.glanceValue} testID="glance-total">{money(grandTotal)}</Text>
                  <Text style={styles.glanceLabel}>{t("invoiceNew.glanceTotal")}</Text>
                </View>
              </View>
              {!!dateRange && (
                <Text style={styles.glanceRange} testID="glance-range">{dateRange}</Text>
              )}
            </View>
          )}

          <View style={[styles.complianceCard, { borderColor: isCompliant ? colors.success : colors.warning }]} testID="compliance-panel">
            <View style={styles.complianceHead}>
              <Ionicons name={isCompliant ? "shield-checkmark" : "shield-half"} size={18} color={isCompliant ? colors.success : colors.warning} />
              <Text style={[styles.complianceTitle, { color: isCompliant ? colors.success : colors.warning }]}>
                {isCompliant ? t("invoiceNew.compliant") : t("invoiceNew.complianceProgress", { done: complete, total: checks.length })}
              </Text>
            </View>
            {checks.map((c) => (
              <View key={c.key} style={styles.checkRow} testID={`check-${c.key}-${c.ok ? "ok" : "missing"}`}>
                <Ionicons name={c.ok ? "checkmark-circle" : "close-circle"} size={16} color={c.ok ? colors.success : colors.error} />
                <Text style={[styles.checkText, { color: c.ok ? colors.onSurfaceTertiary : colors.error }]}>{c.label}</Text>
              </View>
            ))}
            <Text style={styles.complianceHint}>{t("invoiceNew.complianceHint")}</Text>
          </View>

          {participants.map((p, pIdx) => {
            const pt = partTotals(p);
            return (
              <View key={p.key} style={styles.partCard} testID={`participant-${pIdx}`}>
                <Pressable style={styles.partHead} onPress={() => toggleCollapse(pIdx)} testID={`participant-head-${pIdx}`}>
                  <Ionicons name={p.collapsed ? "chevron-forward" : "chevron-down"} size={18} color={colors.brand} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.partTitle}>{p.name?.trim() || t("invoiceNew.participant", { n: pIdx + 1 })}</Text>
                    {p.collapsed && <Text style={styles.partSub}>{money(pt.total)}</Text>}
                  </View>
                  {participants.length > 1 && (
                    <Pressable testID={`remove-participant-${pIdx}`} onPress={() => removeParticipant(pIdx)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </Pressable>
                  )}
                </Pressable>

                {!p.collapsed && (
                  <View style={styles.partBody}>
                    <Pressable testID={`link-client-btn-${pIdx}`} onPress={() => setClientPickerFor(pIdx)} style={styles.codeBtn}>
                      <Ionicons name="people" size={16} color={colors.brand} />
                      <Text style={[styles.codeText, !p.client_id && { color: colors.muted }]} numberOfLines={1}>
                        {p.client_id ? t("invoiceNew.linked", { name: p.name }) : t("invoiceNew.linkClient")}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color={colors.muted} />
                    </Pressable>

                    <VoiceField label={t("invoiceNew.clientParticipant")} value={p.name} onChangeText={(v) => setP(pIdx, { name: v })} placeholder={t("invoiceNew.dictateName")} testID={`client-field-${pIdx}`} />
                    <View style={{ marginBottom: spacing.lg }}>
                      <Text style={styles.label}>{t("invoiceNew.ndisNumberLabel")}</Text>
                      <TextInput testID={`ndis-number-input-${pIdx}`} value={p.ndis} onChangeText={(v) => setP(pIdx, { ndis: v })} placeholder="4300000000" placeholderTextColor={colors.muted} style={[styles.input, okBorder(!!p.ndis.trim())]} keyboardType="number-pad" />
                    </View>
                    <View style={{ marginBottom: spacing.lg }}>
                      <Text style={styles.label}>{t("invoiceNew.companyLabel")}</Text>
                      <TextInput testID={`company-input-${pIdx}`} value={p.company} onChangeText={(v) => setP(pIdx, { company: v })} placeholder={t("invoiceNew.companyPlaceholder")} placeholderTextColor={colors.muted} style={styles.input} />
                    </View>
                    <View style={{ marginBottom: spacing.lg }}>
                      <Text style={styles.label}>{t("invoiceNew.addressLabel")}</Text>
                      <TextInput testID={`address-input-${pIdx}`} value={p.address} onChangeText={(v) => setP(pIdx, { address: v })} placeholder={t("invoiceNew.addressPlaceholder")} placeholderTextColor={colors.muted} style={styles.input} />
                    </View>
                    <View style={{ marginBottom: spacing.lg }}>
                      <Text style={styles.label}>{t("invoiceNew.emailLabel")}</Text>
                      <TextInput testID={`email-input-${pIdx}`} value={p.email} onChangeText={(v) => setP(pIdx, { email: v })} placeholder={t("invoiceNew.emailPlaceholder")} placeholderTextColor={colors.muted} style={styles.input} keyboardType="email-address" autoCapitalize="none" />
                    </View>

                    <Text style={styles.sectionTitle}>{t("invoiceNew.lineItems")}</Text>
                    {p.items.map((it, i) => {
                      const amount = (parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0);
                      return (
                        <View key={i} style={styles.itemCard} testID={`item-${pIdx}-${i}`}>
                          <View style={styles.itemHeader}>
                            <Text style={styles.itemNo}>{t("invoiceNew.item", { n: i + 1 })}</Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                              {participants.length > 1 && (
                                <Pressable testID={`copy-item-${pIdx}-${i}`} onPress={() => copyItemToOthers(pIdx, i)} hitSlop={8}>
                                  <Ionicons name="copy-outline" size={17} color={colors.brand} />
                                </Pressable>
                              )}
                              {p.items.length > 1 && (
                                <Pressable testID={`remove-item-${pIdx}-${i}`} onPress={() => removeItem(pIdx, i)} hitSlop={8}>
                                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                                </Pressable>
                              )}
                            </View>
                          </View>

                          <Pressable testID={`ndis-code-btn-${pIdx}-${i}`} onPress={() => setPickerFor({ p: pIdx, i })} style={styles.codeBtn}>
                            <Ionicons name="pricetags" size={16} color={colors.brand} />
                            <Text style={[styles.codeText, !it.ndis_code && { color: colors.muted }]} numberOfLines={1}>
                              {it.ndis_code ? it.ndis_code : t("invoiceNew.selectCode")}
                            </Text>
                            <Ionicons name="chevron-down" size={16} color={colors.muted} />
                          </Pressable>

                          <VoiceField label={t("invoiceNew.descriptionLabel")} value={it.description} onChangeText={(v) => setItem(pIdx, i, { description: v })} placeholder={t("invoiceNew.dictateService")} multiline testID={`item-desc-${pIdx}-${i}`} />

                          <View style={{ flexDirection: "row", gap: spacing.md }}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.label}>{t("invoiceNew.qty")}</Text>
                              <TextInput testID={`item-qty-${pIdx}-${i}`} value={it.quantity} onChangeText={(v) => setItem(pIdx, i, { quantity: v })} keyboardType="decimal-pad" style={styles.input} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.label}>{t("invoiceNew.rate")}</Text>
                              <TextInput testID={`item-rate-${pIdx}-${i}`} value={it.rate} onChangeText={(v) => setItem(pIdx, i, { rate: v })} keyboardType="decimal-pad" style={styles.input} placeholder="0.00" placeholderTextColor={colors.muted} />
                            </View>
                          </View>

                          <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.md }}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.label}>{t("invoiceNew.startTime")}</Text>
                              <TextInput
                                testID={`item-start-${pIdx}-${i}`}
                                value={it.start_time}
                                onChangeText={(v) => setItem(pIdx, i, { start_time: formatTime24h(v) })}
                                placeholder="09:00"
                                placeholderTextColor={colors.muted}
                                keyboardType="number-pad"
                                maxLength={5}
                                style={styles.input}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.label}>{t("invoiceNew.endTime")}</Text>
                              <TextInput
                                testID={`item-end-${pIdx}-${i}`}
                                value={it.end_time}
                                onChangeText={(v) => setItem(pIdx, i, { end_time: formatTime24h(v) })}
                                placeholder="13:00"
                                placeholderTextColor={colors.muted}
                                keyboardType="number-pad"
                                maxLength={5}
                                style={styles.input}
                              />
                            </View>
                          </View>
                          {/* Per-line service date — powers multi-date invoicing. */}
                          {/* Leave blank to fall back to the invoice-level date. */}
                          <View style={{ marginTop: spacing.md }}>
                            <Text style={styles.label}>{t("invoiceNew.itemServiceDate")}</Text>
                            <DateInput
                              testID={`item-servicedate-${pIdx}-${i}`}
                              value={it.service_date}
                              onChange={(v) => setItem(pIdx, i, { service_date: v })}
                              style={styles.input}
                            />
                            <Text style={styles.dateHint}>{t("invoiceNew.itemServiceDateHint")}</Text>
                          </View>

                          <Pressable testID={`item-gstfree-${pIdx}-${i}`} onPress={() => setItem(pIdx, i, { gst_free: !it.gst_free })} style={styles.gstRow}>
                            <Ionicons name={it.gst_free ? "checkbox" : "square-outline"} size={18} color={it.gst_free ? colors.success : colors.muted} />
                            <Text style={styles.gstText}>{t("invoiceNew.gstFree")}</Text>
                            {!it.gst_free && <Text style={styles.gstPlus}>{t("invoiceNew.gstAdded")}</Text>}
                          </Pressable>
                          <Text style={styles.itemAmount}>{t("invoiceNew.amount", { amount: money(amount) })}</Text>
                        </View>
                      );
                    })}

                    <View style={{ flexDirection: "row", gap: spacing.md }}>
                      <Pressable testID={`add-item-btn-${pIdx}`} onPress={() => addItem(pIdx)} style={[styles.addItem, { flex: 1 }]}>
                        <Ionicons name="add-circle" size={20} color={colors.brand} />
                        <Text style={styles.addItemText}>{t("invoiceNew.addLineItem")}</Text>
                      </Pressable>
                      {!!p.client_id && (
                        <Pressable testID={`import-shifts-btn-${pIdx}`} onPress={() => openImportShifts(pIdx)} style={[styles.addItem, styles.importBtn, { flex: 1 }]}>
                          <Ionicons name="calendar" size={18} color={colors.info} />
                          <Text style={[styles.addItemText, { color: colors.info }]} numberOfLines={1}>{t("invoiceNew.importShifts")}</Text>
                        </Pressable>
                      )}
                    </View>

                    <View style={{ marginTop: spacing.lg }}>
                      <VoiceField label={t("invoiceNew.notesLabel")} value={p.notes} onChangeText={(v) => setP(pIdx, { notes: v })} placeholder={t("invoiceNew.dictateNotes")} multiline testID={`notes-field-${pIdx}`} />
                    </View>

                    <View style={styles.partTotalRow}>
                      <Text style={styles.partTotalLabel}>{t("invoiceNew.participantTotal")}</Text>
                      <Text style={styles.partTotalValue}>{money(pt.total)}</Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })}

          {!isEdit && (
            <Pressable testID="add-participant-btn" onPress={addParticipant} style={styles.addParticipant}>
              <Ionicons name="person-add" size={18} color={colors.brand} />
              <Text style={styles.addItemText}>{t("invoiceNew.addParticipant")}</Text>
            </Pressable>
          )}

          <View style={styles.totals}>
            <Row label={t("invoiceNew.subtotal")} value={money(grandSub)} />
            <Row label={t("invoiceNew.gst")} value={money(grandGst)} />
            <Row label={participants.length > 1 ? t("invoiceNew.grandTotal", { count: participants.length }) : t("invoiceNew.total")} value={money(grandTotal)} big />
          </View>
        </ScrollView>

        {/* 3-button footer: Send now · Save · Delete */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Pressable testID="delete-invoice-btn" style={[styles.footBtn, styles.deleteBtn]} onPress={onDelete} disabled={!!busy}>
            {busy === "delete" ? <ActivityIndicator color={colors.error} /> : (<><Ionicons name="trash-outline" size={18} color={colors.error} /><Text style={[styles.footText, { color: colors.error }]}>{t("invoiceNew.deleteBtn")}</Text></>)}
          </Pressable>
          <Pressable testID="save-invoice-btn" style={[styles.footBtn, styles.saveBtn]} onPress={onSave} disabled={!!busy}>
            {busy === "save" ? <ActivityIndicator color={colors.onSurface} /> : (<><Ionicons name="bookmark-outline" size={18} color={colors.onSurface} /><Text style={[styles.footText, { color: colors.onSurface }]}>{t("invoiceNew.saveDraft")}</Text></>)}
          </Pressable>
          <Pressable testID="send-invoice-btn" style={[styles.footBtn, styles.sendBtn]} onPress={onSend} disabled={!!busy}>
            {busy === "send" ? <ActivityIndicator color={colors.onBrand} /> : (<><Ionicons name="send" size={18} color={colors.onBrand} /><Text style={[styles.footText, { color: colors.onBrand }]}>{t("invoiceNew.sendNow")}</Text></>)}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* NDIS code picker */}
      <Modal visible={pickerFor !== null} transparent animationType="slide" onRequestClose={() => setPickerFor(null)}>
        <View style={styles.modalWrap}>
          <View style={styles.pickerSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t("invoiceNew.selectSupportItem")}</Text>
            <Pressable testID="open-ai-assistant-btn" onPress={openAiAssistant} style={styles.aiOpenBtn}>
              <Ionicons name="sparkles" size={16} color={colors.brand} />
              <Text style={styles.aiOpenText}>{t("invoiceNew.askAi")}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.brand} />
            </Pressable>
            <View style={styles.codeSearch}>
              <Ionicons name="search" size={16} color={colors.muted} />
              <TextInput testID="code-search" value={codeQuery} onChangeText={setCodeQuery} placeholder={t("invoiceNew.searchCodePlaceholder")} placeholderTextColor={colors.muted} style={styles.codeSearchInput} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 46, marginBottom: spacing.sm }} contentContainerStyle={{ gap: spacing.sm, alignItems: "center" }}>
              {FILTER_TAGS.map((tag) => {
                const on = codeTags.includes(tag);
                return (
                  <Pressable key={tag} testID={`codetag-${tag}`} onPress={() => toggleCodeTag(tag)} style={[styles.miniTag, on && styles.miniTagOn]}>
                    <Text style={[styles.miniTagText, on && { color: colors.onBrand }]}>{tag}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <FlatList
              data={filteredCat}
              keyExtractor={(c) => c.code}
              showsVerticalScrollIndicator
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: spacing.md }}
              ListHeaderComponent={
                showShortcuts ? (
                  <View style={{ marginBottom: spacing.sm }}>
                    {suggestedForClient.length > 0 && (
                      <>
                        <Text style={styles.recentLabel}>{t("invoiceNew.suggestedForClient", { name: pickerClient?.name || "" })}</Text>
                        {suggestedForClient.map((sc) => (
                          <Pressable key={`s-${sc.code}`} testID={`client-suggest-${sc.code}`} style={[styles.codeRow, { borderColor: colors.brand + "66" }]} onPress={() => applyCode(sc)}>
                            <Ionicons name="person-circle" size={18} color={colors.brand} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.codeRowCode}>{sc.code}</Text>
                              <Text style={styles.codeRowLabel} numberOfLines={1}>{sc.name}</Text>
                            </View>
                            <Text style={styles.codeRowRate}>{money(sc.rate)}</Text>
                          </Pressable>
                        ))}
                      </>
                    )}
                    {favouriteItems.length > 0 && (
                      <>
                        <Text style={styles.recentLabel}>{t("invoiceNew.favourites")}</Text>
                        {favouriteItems.map((fc) => (
                          <Pressable key={`f-${fc.code}`} testID={`fav-code-${fc.code}`} style={[styles.codeRow, { borderColor: colors.warning + "55" }]} onPress={() => applyCode(fc)}>
                            <Ionicons name="star" size={16} color={colors.warning} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.codeRowCode}>{fc.code}</Text>
                              <Text style={styles.codeRowLabel} numberOfLines={1}>{fc.name}</Text>
                            </View>
                            <Text style={styles.codeRowRate}>{money(fc.rate)}</Text>
                            <Pressable testID={`unstar-${fc.code}`} onPress={() => toggleFavourite(fc.code)} hitSlop={8} style={styles.starBtn}>
                              <Ionicons name="star" size={18} color={colors.warning} />
                            </Pressable>
                          </Pressable>
                        ))}
                      </>
                    )}
                    {recentCodes.length > 0 && (
                      <>
                        <Text style={styles.recentLabel}>{t("invoiceNew.recentForClient")}</Text>
                        {recentCodes.map((rc) => (
                          <Pressable key={`r-${rc.code}`} testID={`recent-code-${rc.code}`} style={[styles.codeRow, { borderColor: colors.brand + "55" }]} onPress={() => applyCode(rc)}>
                            <Ionicons name="time" size={16} color={colors.brand} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.codeRowCode}>{rc.code}</Text>
                              <Text style={styles.codeRowLabel} numberOfLines={1}>{rc.description || t("invoiceNew.previouslyUsed")}</Text>
                            </View>
                            <Text style={styles.codeRowRate}>{money(rc.rate)}</Text>
                          </Pressable>
                        ))}
                      </>
                    )}
                    {(favouriteItems.length > 0 || recentCodes.length > 0) && (
                      <Text style={styles.recentLabel}>{t("invoiceNew.allSupportItems")}</Text>
                    )}
                  </View>
                ) : null
              }
              renderItem={({ item }) => {
                const fav = favourites.includes(item.code);
                return (
                  <Pressable testID={`code-${item.code}`} style={styles.codeRow} onPress={() => applyCode(item)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.codeRowCode}>{item.code}</Text>
                      <Text style={styles.codeRowLabel} numberOfLines={2}>{item.name}</Text>
                    </View>
                    <Text style={styles.codeRowRate}>{money(item.rate)}/{item.unit}</Text>
                    <Pressable testID={`star-${item.code}`} onPress={() => toggleFavourite(item.code)} hitSlop={8} style={styles.starBtn}>
                      <Ionicons name={fav ? "star" : "star-outline"} size={18} color={fav ? colors.warning : colors.muted} />
                    </Pressable>
                  </Pressable>
                );
              }}
            />
            <Pressable style={styles.closePicker} onPress={() => setPickerFor(null)}>
              <Text style={styles.closePickerText}>{t("invoiceNew.close")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Client picker */}
      <Modal visible={clientPickerFor !== null} transparent animationType="slide" onRequestClose={() => setClientPickerFor(null)}>
        <View style={styles.modalWrap}>
          <View style={styles.pickerSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t("invoiceNew.linkClientTitle")}</Text>
            <FlatList
              data={clients}
              keyExtractor={(c) => c.id}
              showsVerticalScrollIndicator
              style={{ flex: 1 }}
              ListEmptyComponent={<Text style={styles.codeRowLabel}>{t("invoiceNew.noClientsPicker")}</Text>}
              renderItem={({ item }) => (
                <Pressable testID={`pick-client-${item.id}`} style={styles.codeRow} onPress={() => pickClient(item)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.codeRowCode}>{item.name}</Text>
                    <Text style={styles.codeRowLabel}>{item.ndis_number ? t("invoiceNew.ndisNum", { number: item.ndis_number }) : t("invoiceNew.noNdisNumber")}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </Pressable>
              )}
            />
            <Pressable style={styles.closePicker} onPress={() => setClientPickerFor(null)}>
              <Text style={styles.closePickerText}>{t("invoiceNew.close")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Save → attach to active shift prompt */}
      <Modal visible={shiftPrompt} transparent animationType="fade" onRequestClose={() => setShiftPrompt(false)}>
        <View style={styles.centerWrap}>
          <View style={styles.promptCard}>
            <Ionicons name="briefcase" size={30} color={colors.brand} />
            <Text style={styles.promptTitle}>{t("invoiceNew.attachShiftTitle")}</Text>
            <Text style={styles.promptMsg}>{t("invoiceNew.attachShiftMsg")}</Text>
            <Pressable testID="attach-shift-btn" style={[styles.promptBtn, { backgroundColor: colors.brand }]} onPress={() => { setShiftPrompt(false); persist("draft", "save", activeShiftId); }}>
              <Text style={[styles.footText, { color: colors.onBrand }]}>{t("invoiceNew.attachToShift")}</Text>
            </Pressable>
            <Pressable testID="save-no-shift-btn" style={[styles.promptBtn, styles.saveBtn]} onPress={() => { setShiftPrompt(false); persist("draft", "save"); }}>
              <Text style={[styles.footText, { color: colors.onSurface }]}>{t("invoiceNew.saveNoShift")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      {/* AI Code Assistant — for quick amendments during create/edit */}
      <Modal visible={aiOpen} transparent animationType="slide" onRequestClose={() => setAiOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.aiSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.aiHeader}>
              <Ionicons name="sparkles" size={20} color={colors.brand} />
              <Text style={styles.sheetTitle}>{t("invoiceNew.aiTitle")}</Text>
              <Pressable onPress={() => setAiOpen(false)} hitSlop={12} testID="ai-close-btn">
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <Text style={styles.aiHint}>{t("invoiceNew.aiHint")}</Text>

            <ScrollView style={styles.aiChatArea} contentContainerStyle={{ paddingBottom: spacing.md }} showsVerticalScrollIndicator={false}>
              {aiMessages.map((m, idx) => (
                <View key={idx} style={m.role === "user" ? styles.aiBubbleUser : styles.aiBubbleBot} testID={`ai-msg-${idx}`}>
                  <Text style={m.role === "user" ? styles.aiUserText : styles.aiBotText}>{m.content}</Text>
                  {m.codes && m.codes.length > 0 && (
                    <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                      {m.codes.map((c) => (
                        <Pressable
                          key={c.code}
                          testID={`ai-code-${c.code}`}
                          onPress={() => applyAiCode(c)}
                          style={styles.aiCodeRow}
                        >
                          <Ionicons name="add-circle" size={18} color={colors.brand} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.aiCodeCode}>{c.code}</Text>
                            <Text style={styles.aiCodeLabel} numberOfLines={2}>{c.name}</Text>
                          </View>
                          <Text style={styles.aiCodeRate}>{money(c.rate)}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              ))}
              {aiBusy && (
                <View style={styles.aiBubbleBot}>
                  <ActivityIndicator color={colors.brand} size="small" />
                </View>
              )}
            </ScrollView>

            <View style={styles.aiInputRow}>
              <TextInput
                testID="ai-input"
                value={aiInput}
                onChangeText={setAiInput}
                placeholder={t("invoiceNew.aiInputPlaceholder")}
                placeholderTextColor={colors.muted}
                style={styles.aiInput}
                multiline
                editable={!aiBusy}
                onSubmitEditing={askAi}
                blurOnSubmit
              />
              <Pressable testID="ai-send-btn" onPress={askAi} disabled={aiBusy || !aiInput.trim()} style={[styles.aiSendBtn, (aiBusy || !aiInput.trim()) && { opacity: 0.5 }]}>
                {aiBusy ? <ActivityIndicator color={colors.onBrand} size="small" /> : <Ionicons name="send" size={18} color={colors.onBrand} />}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* -------- Import from past shifts (multi-select) -------- */}
      <Modal visible={importFor !== null} transparent animationType="slide" onRequestClose={closeImportShifts}>
        <View style={styles.modalWrap}>
          <View style={styles.importSheet} testID="import-shifts-sheet">
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t("invoiceNew.importShiftsTitle")}</Text>
            <Text style={styles.importSub}>{t("invoiceNew.importShiftsSub")}</Text>
            {importBusy ? (
              <View style={{ paddingVertical: spacing.xxl, alignItems: "center" }}>
                <ActivityIndicator color={colors.brand} />
              </View>
            ) : pastShifts.length === 0 ? (
              <View style={{ paddingVertical: spacing.xl, alignItems: "center", gap: spacing.sm }}>
                <Ionicons name="hourglass-outline" size={30} color={colors.muted} />
                <Text style={styles.importEmpty}>{t("invoiceNew.importShiftsEmpty")}</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator>
                {pastShifts.map((s) => {
                  const picked = !!importPicked[s.id];
                  const d = (s.started_at || "").slice(0, 10);
                  return (
                    <Pressable
                      key={s.id}
                      testID={`import-shift-${s.id}`}
                      onPress={() => setImportPicked((p) => ({ ...p, [s.id]: !p[s.id] }))}
                      style={[styles.importRow, picked && styles.importRowOn]}
                    >
                      <Ionicons name={picked ? "checkbox" : "square-outline"} size={22} color={picked ? colors.brand : colors.muted} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.importDate}>{_formatDMY(d)}{d ? ` ${d.slice(0, 4)}` : ""}</Text>
                        <Text style={styles.importMeta} numberOfLines={1}>
                          {t("invoiceNew.importShiftMeta", { count: s.items.length, hours: s.hours.toFixed(1) })}
                        </Text>
                        {!!s.invoice_numbers?.length && (
                          <Text style={styles.importInvoice} numberOfLines={1}>{s.invoice_numbers.join(" · ")}</Text>
                        )}
                      </View>
                      <Text style={styles.importAmount}>{money(s.amount)}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.md }}>
              <Pressable testID="import-cancel-btn" onPress={closeImportShifts} style={[styles.footBtn, styles.saveBtn]}>
                <Text style={[styles.footText, { color: colors.onSurface }]}>{t("common.cancel")}</Text>
              </Pressable>
              <Pressable
                testID="import-apply-btn"
                onPress={applyImportedShifts}
                disabled={Object.values(importPicked).filter(Boolean).length === 0}
                style={[styles.footBtn, styles.sendBtn, Object.values(importPicked).filter(Boolean).length === 0 && { opacity: 0.5 }]}
              >
                <Ionicons name="download" size={16} color={colors.onBrand} />
                <Text style={[styles.footText, { color: colors.onBrand }]}>
                  {t("invoiceNew.importApply", { count: Object.values(importPicked).filter(Boolean).length })}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Row({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, big && { fontSize: 16, color: colors.onSurface }]}>{label}</Text>
      <Text style={[styles.totalValue, big && { fontSize: 22, color: colors.brand }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontSize: 18, fontWeight: weight.heavy },
  label: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: weight.bold, marginBottom: spacing.sm },
  dateHint: { color: colors.muted, fontSize: 11, marginTop: spacing.xs, fontStyle: "italic" },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { color: colors.onSurface, fontSize: 16, fontWeight: weight.heavy, marginBottom: spacing.md },
  partCard: { backgroundColor: colors.surfaceSecondary + "55", borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg, overflow: "hidden" },
  partHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md },
  partTitle: { color: colors.onSurface, fontSize: 15, fontWeight: weight.heavy },
  partSub: { color: colors.brand, fontSize: 13, fontWeight: weight.bold, marginTop: 2 },
  partBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  partTotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  partTotalLabel: { color: colors.muted, fontSize: 13, fontWeight: weight.bold },
  partTotalValue: { color: colors.onSurface, fontSize: 16, fontWeight: weight.heavy },
  addParticipant: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.brand, borderStyle: "dashed", marginBottom: spacing.md },
  itemCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  itemNo: { color: colors.brand, fontSize: 13, fontWeight: weight.bold, letterSpacing: 0.5 },
  codeBtn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.borderStrong, marginBottom: spacing.md },
  codeText: { flex: 1, color: colors.brand, fontSize: 13, fontWeight: weight.bold },
  itemAmount: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: weight.bold, marginTop: spacing.sm, textAlign: "right" },
  addItem: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed" },
  addItemText: { color: colors.brand, fontWeight: weight.bold },
  totals: { marginTop: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.xs },
  totalLabel: { color: colors.muted, fontSize: 14 },
  totalValue: { color: colors.onSurface, fontSize: 15, fontWeight: weight.bold },
  footer: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface },
  footBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, height: 54, borderRadius: radius.md },
  deleteBtn: { flex: 1, borderWidth: 1, borderColor: colors.error + "66", backgroundColor: colors.error + "12" },
  saveBtn: { flex: 1.1, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary },
  sendBtn: { flex: 1.4, backgroundColor: colors.brand },
  footText: { fontWeight: weight.heavy, fontSize: 14 },
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  pickerSheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, height: "82%" },
  sheetHandle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  sheetTitle: { color: colors.onSurface, fontSize: 20, fontWeight: weight.heavy, marginBottom: spacing.md },
  codeSearch: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  codeSearchInput: { flex: 1, color: colors.onSurface, fontSize: 15, paddingVertical: spacing.md },
  miniTag: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  miniTagOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  miniTagText: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: weight.bold },
  codeRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  codeRowCode: { color: colors.brand, fontSize: 13, fontWeight: weight.bold },
  codeRowLabel: { color: colors.onSurfaceTertiary, fontSize: 13, marginTop: 2 },
  codeRowRate: { color: colors.onSurface, fontSize: 14, fontWeight: weight.bold },
  closePicker: { alignItems: "center", paddingVertical: spacing.md, marginTop: spacing.sm },
  closePickerText: { color: colors.muted, fontWeight: weight.bold },
  recentLabel: { color: colors.muted, fontSize: 11, fontWeight: weight.bold, letterSpacing: 0.8, marginTop: spacing.sm, marginBottom: spacing.xs },
  starBtn: { padding: spacing.xs, marginLeft: spacing.xs },
  complianceCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.lg },
  complianceHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  complianceTitle: { fontSize: 13, fontWeight: weight.heavy, flex: 1 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 3 },
  checkText: { fontSize: 13 },
  complianceHint: { color: colors.muted, fontSize: 11, marginTop: spacing.xs, fontStyle: "italic" },
  centerWrap: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)", padding: spacing.xl },
  promptCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, width: "100%", maxWidth: 380, alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  promptTitle: { color: colors.onSurface, fontSize: 18, fontWeight: weight.heavy, marginTop: spacing.sm },
  promptMsg: { color: colors.muted, fontSize: 14, textAlign: "center", marginBottom: spacing.md },
  promptBtn: { width: "100%", height: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  aiOpenBtn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandTertiary, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.brand + "55", marginBottom: spacing.md },
  aiOpenText: { flex: 1, color: colors.brand, fontSize: 13, fontWeight: weight.heavy },
  aiSheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, height: "80%" },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  aiHint: { color: colors.muted, fontSize: 12, marginBottom: spacing.md, fontStyle: "italic" },
  aiChatArea: { flex: 1, marginBottom: spacing.sm },
  aiBubbleUser: { alignSelf: "flex-end", maxWidth: "85%", backgroundColor: colors.brand, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  aiBubbleBot: { alignSelf: "flex-start", maxWidth: "92%", backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  aiUserText: { color: colors.onBrand, fontSize: 14, lineHeight: 20 },
  aiBotText: { color: colors.onSurface, fontSize: 14, lineHeight: 20 },
  aiCodeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, backgroundColor: colors.brandTertiary, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.brand + "44" },
  aiCodeCode: { color: colors.brand, fontSize: 12, fontWeight: weight.heavy },
  aiCodeLabel: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  aiCodeRate: { color: colors.onSurface, fontSize: 13, fontWeight: weight.bold },
  aiInputRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  aiInput: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 14, borderWidth: 1, borderColor: colors.border, maxHeight: 100, minHeight: 44 },
  aiSendBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  ttpRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.lg },
  ttpLabel: { color: colors.onSurface, fontSize: 14, fontWeight: weight.bold },
  gstRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  gstText: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: weight.bold, flex: 1 },
  gstPlus: { color: colors.warning, fontSize: 12, fontWeight: weight.heavy },
  mgmtRow: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm },
  mgmtChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  mgmtChipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  mgmtChipText: { color: colors.brand, fontSize: 12, fontWeight: weight.bold },
  pmBlock: { backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.brand + "44" },
  warnBlock: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, backgroundColor: colors.warning + "22", borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.warning + "88", marginBottom: spacing.lg },
  warnText: { flex: 1, color: colors.warning, fontSize: 12, fontWeight: weight.bold, lineHeight: 18 },
  // ---- Multi-date glance summary strip ----
  glanceCard: { backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.brand + "44", marginBottom: spacing.md },
  glanceRow: { flexDirection: "row", alignItems: "center" },
  glanceCell: { flex: 1, alignItems: "center", gap: 2 },
  glanceValue: { color: colors.onSurface, fontSize: 15, fontWeight: weight.heavy },
  glanceLabel: { color: colors.muted, fontSize: 10, fontWeight: weight.bold, letterSpacing: 0.4, textTransform: "uppercase" },
  glanceSep: { width: 1, alignSelf: "stretch", backgroundColor: colors.brand + "33" },
  glanceRange: { color: colors.brand, fontSize: 12, fontWeight: weight.bold, textAlign: "center", marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.brand + "22" },
  // ---- Import from past shifts ----
  importBtn: { borderColor: colors.info + "77", backgroundColor: colors.info + "10" },
  importSheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing.xxl, maxHeight: "82%" },
  importSub: { color: colors.muted, fontSize: 12, marginBottom: spacing.md, fontStyle: "italic" },
  importEmpty: { color: colors.muted, fontSize: 13, textAlign: "center" },
  importRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderRadius: radius.md, paddingHorizontal: spacing.sm, marginBottom: spacing.xs, borderWidth: 1, borderColor: "transparent" },
  importRowOn: { backgroundColor: colors.brand + "12", borderColor: colors.brand + "55" },
  importDate: { color: colors.onSurface, fontSize: 14, fontWeight: weight.heavy },
  importMeta: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  importInvoice: { color: colors.brand, fontSize: 11, marginTop: 1, fontWeight: weight.bold },
  importAmount: { color: colors.onSurface, fontSize: 14, fontWeight: weight.bold },
});
