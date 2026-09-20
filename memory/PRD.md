# NDIS Command Center — PRD

## Original Problem Statement
All-in-one business management app for disability support workers in Victoria, Australia (NDIS). Removes repetitive daily admin: invoicing, tax receipts, records, task/event tracking. AI receipt scanning, voice dictation, command-center dashboard, NDIS prefill codes, futuristic healthcare aesthetic, dopamine reward feedback. Clients hub with profiles, notes, reminders. Document templates (PDF/Excel).

## User Choices
- AI: OpenAI GPT-4o (receipt vision) + OpenAI Whisper (voice) via EMERGENT_LLM_KEY
- Single-user (no auth) for now
- Futuristic dark healthcare palette (teal/medical-blue, cyan accents) + celebratory reward animations/haptics

## Architecture
- Backend: FastAPI + MongoDB (Motor), all routes /api. emergentintegrations LlmChat(gpt-4o) + OpenAISpeechToText(whisper-1). reportlab (PDF), openpyxl (Excel).
- Frontend: Expo Router SDK 54, bottom tabs (Command/Clients/Scan/Invoices/Planner) + stack screens (client/[id], invoice/[id], invoice/new, vault, reports, templates, settings). reanimated, expo-camera, expo-audio, expo-notifications (local reminders), expo-sharing, expo-image, expo-linear-gradient, expo-haptics.
- Collections: invoices, receipts, tasks, clients, reminders, settings.

## User Personas
- Sole-trader NDIS support worker billing participants, tracking expenses, and managing a caseload of clients from their phone. Often non-tech-savvy → usability & fewer menu hops prioritised.

## Core Requirements (static)
- Fast receipt capture + AI extract + confirm + file
- Voice dictation into invoice/notes/report fields
- NDIS-compliant invoicing with prefill hot-keys + auto GST + PDF share
- Clients hub: profile, notes, reminders, tasks/shifts, invoices grouped
- Reports/BAS + record exports; document templates
- Reward feedback on completion / paid

## Implemented
### 2026-07-02 (v1 MVP)
- AI receipt scanner, voice dictation, command dashboard, NDIS invoice builder, planner, tax vault, celebration overlay. 11/11 tests pass.
### 2026-07-03 (v2)
- Clients CRUD + Clients tab + client detail (profile, contact call/email, editable notes, reminders w/ local device notifications, linked tasks, invoices grouped paid/pending, new-invoice-for-client prefill).
- Reminders (backend + local scheduled notifications via expo-notifications).
- Invoice detail screen + PDF generation (reportlab) + native share; invoice list → detail.
- Templates suite: NDIS Tax Invoice, dictated Progress Report → PDF, Expense Summary → Excel.
- Reports & BAS: FY switcher, income/expense bar chart, GST 1A/1B/net payable, invoices/receipts Excel export.
- Business Profile settings (appears on PDFs). Invoice builder client picker.
- Dashboard restructured: verb Quick Actions + Tools row (no duplicate buttons). Receipts moved off tab bar to /vault.
- 32/32 backend tests pass; all frontend flows verified.

### 2026-07-03 (v3)
- Comprehensive client fields (company, email, address, plan_manager) on add + shown on client detail; passed into invoices.
- NDIS-compliant invoices: client company/address/email + issue/sent/due dates on builder, detail & PDF; sent_date set when PDF shared.
- Certificates/Insurances/Licenses section (/credentials) with photo capture, expiry status pills, grouped by type.
- Today's Notes: dashboard card (voice record→text, preview, tap-to-expand inline edit, double-tap→full-screen editor). Full editor (/notes) with font family/size, text & background colour swatches, photo attach, voice dictation.
- Overdue-invoice alert on dashboard + payment follow-up local reminder scheduled on invoice due date.
- expo-image-picker + photo-library permissions added. 50/50 backend tests pass; all frontend flows verified.

### 2026-07-03 (v4)
- Client Documents per participant (service agreements/consent/plans as photos, base64) with in-app viewer.
- Start Shift → auto-creates pre-filled DRAFT invoices per selected client (multi-select); drafts editable to add line items then finalise. Active shift screen with shift receipts + End Shift.
- Edit invoice (PUT, recompute totals) + Duplicate (recurring) invoice.
- Receipt scanner: "Digital copy created" reveal animation + Add to Shift / Archive / Delete actions.
- Tax Vault: tap a receipt to expand its digital copy + "View original photo" viewer.
- Word (.docx) report export (python-docx) alongside PDF.
- Emergent push-notifications scaffolding: /register-push + send_push (non-blocking on invoice create), _layout registration + tap routing, expo-notifications plugin. Requires google-services.json + deploy/build to function; EMERGENT_PUSH_KEY auto-set in deploy pipeline.
- Refinements: drafts excluded from outstanding; edit preserves shift_id/recurrence/sent_date. 74/74 backend tests pass.

## Backlog
- P1: Word (.docx) export; fully editable templates with prompt boxes; recurring invoices.
- P1: Remote push notifications (needs deploy + build + google-services.json) for cross-device reminders.
- P1: Voice dictation on receipt fields; edit existing invoices.
- P2: Multi-user auth (JWT/Google) + cloud backup; date/time picker for reminders.
- P2: Harden API (ObjectId validation → 400, Pydantic partial-update models, status enum); concurrency-safe invoice numbering.
- P2: Panic button DIY integration (deferred per user).

### 2026-07-03 (v7)
- Persistent bottom nav: moved all tool/detail screens (vault, credentials, reports, templates, settings, ndis-codes, notes, shift, client/, invoice/) into the (tabs) group registered as href:null tabs (routes unchanged) so the 5-tab bar stays visible in every section. Added nested _layout.tsx stacks for client/ & invoice/.
- Command dropdown readability: Outstanding card dropdown now has an 'OUTSTANDING INVOICES' header and brighter text.
- Upcoming costs & renewals strip on Command: horizontal cards for bills due + expense renewals + credential expiries within 14 days, colour-coded (overdue/soon/cert), tap → /vault. Backend GET /api/dashboard/upcoming?days=N. 6/6 backend tests + frontend flows pass.

## Next Tasks
1. 2FA (email/SMS) — needs a Resend/SendGrid or Twilio key.
2. Real email delivery for password reset & subscription confirmations (add Resend key).
3. Multi-user data isolation (scope collections by user_id) if going multi-tenant.
4. [USER-REQUESTED SIDE NOTE / BACKLOG] Multi-language (i18n) for all app text — prioritise languages common in the AU healthcare/support workforce (e.g. Thai, Hindi/Punjabi/Tamil and other Indian languages, Mandarin, Vietnamese, Arabic, Filipino/Tagalog). Simple language switcher in Settings/Account; plan an i18n framework (e.g. i18next / expo-localization) with string extraction. Deferred for now per user.

### 2026-07-03 (v10) — Expandable NDIS catalogue + CSV importer
- Catalogue moved from static JSON into MongoDB (collection ndis_items, meta in ndis_meta; seeded from ndis_catalogue.json on first startup). Endpoints /ndis-codes, /ndis-catalogue, /ndis-catalogue/version now DB-backed.
- Admin CSV importer: POST /api/ndis-catalogue/import (auth required) — auto-detects Support Item Number/Name/Category/Registration Group/Unit/Price columns from the official price-guide CSV, upserts by code (merge or replace), bumps version. Frontend import screen /ndis-import (expo-document-picker + expo-file-system/legacy) reachable from Account and the NDIS Codes header; shows current version/count + result summary.
- Assistant scales via keyword RETRIEVAL: only relevant candidate codes (regex over name/category/subcategory/tags/description) go into the prompt once catalogue > 120 items; plus a regex fallback that extracts code patterns from the answer so chips always render. 16/16 backend + 5/5 frontend pass.

### 2026-07-03 (v9) — Lifetime owner + NDIS AI Code Assistant
- Seeded lifetime owner account TEST_USER_EMAIL / TEST_PASSWORD (plan 'lifetime', no fees). Membership screen shows "You have lifetime access" (no subscribe buttons) for lifetime users.
- Confirmed biometric quick-unlock is OPTIONAL: no lock unless the user sets a PIN; PIN is always the fallback, biometric never blocks.
- NDIS Code Assistant (flagship): POST /api/ai/ndis-assistant, GPT-4o via Emergent LLM key, grounded on the full 25-code catalogue with a strict system prompt (only real codes, JSON {answer, codes}). Backend maps returned code ids to catalogue entries (no hallucinated codes). Frontend chat screen /assistant with suggestion chips + tappable code chips that prefill the invoice builder (presetCode/presetDesc/presetRate). Prominent dashboard banner. 16/16 backend + 7/7 frontend pass.

### 2026-07-03 (v8) — Authentication + Membership
- Auth: email/password (bcrypt + server-side session tokens, /api/auth/register|login|me|logout|forgot|reset) + Emergent Google social login (/api/auth/session). App gated behind login (single-owner). AuthContext stores token in expo-secure-store (SecureStore) / localStorage on web, attaches Bearer via api.ts. 30-day sessions. Screens: (auth)/login, register, forgot.
- Quick unlock: 4-digit PIN (SecureStore) + biometrics (expo-local-authentication), re-locks on app resume. LockScreen overlay + Account screen to set/remove PIN and log out.
- Membership: Stripe test checkout via emergentintegrations (sk_test_emergent in backend/.env). Server-side plans (pro_monthly A$19.99, pro_yearly A$199, 14-day trial). /api/billing/plans|membership|checkout|status/{sid}|cancel + /api/webhook/stripe. payment_transactions collection, idempotent membership grant with expiry. Membership screen with plan cards + Stripe redirect + status polling.
- Cross-platform confirm helper (src/utils/confirm.ts) — Alert.alert is a no-op on RN-web; used for logout/cancel/delete.
- 28/28 backend tests + frontend flows pass. NOT DONE: 2FA and real email delivery (need provider keys); password-reset returns token in response until email configured.

### 2026-07-03 (v5)
- Offline/online NDIS support-item dictionary (`ndis_catalogue.json` v2024-25.1) with versioning: bundled offline, upgrades from backend when newer. Searchable/filterable /ndis-codes screen + version pill. Backend: /api/ndis-catalogue, /api/ndis-catalogue/version, /api/clients/{id}/recent-codes.
- Invoice builder smart suggestions: "RECENT FOR THIS CLIENT" section in the NDIS code picker, drawn from the selected client's last 3 invoices (de-duped). 8/8 new backend tests pass; frontend flows verified.
- Dopamine reward: success chime (expo-audio, assets/sounds/success.wav) added to celebration alongside existing animation+haptic; enabled on task-complete, invoice-marked-paid (list + detail) and receipt-scan-saved. celebrate() now takes { sound } opt; playsInSilentMode set so it plays on iOS silent switch.

### 2026-07-03 (v6)
- Clients: edit + delete (long-press menu on list, header buttons on detail). Shared ClientFormSheet + ClientAvatar components. Profile picture = photo (camera/upload) OR icon+colour picker. New care-profile fields: date_of_birth (+auto age), sex, condition/disability, severity (Mild/Moderate/Severe pill), medications, needs/concerns/behaviours — shown in a Care Profile card on the client detail. Backend Client model extended (photo_base64, icon, dob, sex, condition, severity, medications, behaviours).
- Certs & Insurance: certificate-of-currency / policy number field added, shown on card; tap a credential image to open full-screen viewer (eye badge on thumb).
- Expenses hub (was Tax Vault, /vault): 3 segments — Receipts | Bills & Costs | Calendar. Manual costs (Expense model + CRUD /api/expenses): name, description (what it covers), category, cost, due/direct-debit date, renewal/expiry date, direct-debit toggle. Monthly calendar (react-native-calendars, dark themed) marks receipts (brand) + bill due (warning) + renewals (info) with multi-dots; tap a day to list its items.
- Command: Expenses mini-stat now taps through to /vault; Outstanding hero card expands into a dropdown of pending invoices (number, amount owing, days since sent [clamped ≥0], client-initial colour badge, shift date) via /api/dashboard/outstanding ($0-owing excluded). 16/16 backend tests pass; frontend flows verified.

### 2026-07-04 (v11) — Phase 0 + Phase 1: Multi-tenant Security & NDIS Compliance
- **Phase 0 (Auth + org isolation):** Every data endpoint (50+) now requires a Bearer session token via `Depends(current_org)` and is scoped by `org_id`. Added `org_id` to user docs on register/Google login; idempotent startup migration assigned all pre-existing data to TEST_USER_EMAIL's org (demo starts empty). NDIS catalogue stays global. Cross-tenant reads/writes/deletes are firewalled (404/no-op). DELETE endpoints now return 404 on cross-tenant/missing ids.
- **Phase 1 (2FA + audit + rate limiting):** Optional TOTP 2FA (pyotp+qrcode) — setup w/ QR, verify-enrollment w/ 8 bcrypt-hashed single-use backup codes, disable, and two-step login (login→challenge_id→verify-challenge→token). Immutable append-only `audit_log` via HTTP middleware (org/user/method/path/status/ip/ts); org-scoped read-only GET /api/audit-log. slowapi rate limits: /auth/login & /auth/2fa/verify-challenge 10/min, /auth/forgot & /auth/reset 5/min.
- Frontend: two-step 2FA login screen; Account > Two-factor authentication (/security) setup/backup-codes/disable; Account > Security activity log (/audit-log). 30/30 backend tests pass; frontend flows verified.

### 2026-07-04 (v12) — Multi-language (i18n) + Learning & Resources hub
- i18n foundation: i18next + react-i18next + expo-localization, AsyncStorage persistence, device-locale auto-detect, cold-start gated to avoid flash. 8 languages + English: Thai, Hindi, Punjabi, Tamil, Mandarin, Vietnamese, Arabic (RTL text), Tagalog. Translations generated via GPT-4o (labelled "community translation"; script at /app/scripts/translate_locales.py, source of truth src/i18n/locales/en.json, all 85 keys validated identical across languages).
- Language switcher screen (Account > Language). Core surfaces wired to t(): login (incl. 2FA step), bottom tab-bar labels, Account screen. Other screens remain English (planned follow-on).
- Learning & Resources hub (Account > Learning & resources): translated labels + official NDIS links (rights & safeguards, worker orientation, Code of Conduct, complaints, "information in your language").
- Testing: 6/6 frontend i18n flows pass (iteration_15), incl. Thai/Arabic/English round-trip, tab-bar translation, persistence, Learning hub render, and NO regressions. Backend unchanged (still 30/30).
- Deliverable: /app/NDIS_App_Roadmap_Briefing.pdf (downloadable launch/compliance roadmap for the creator).

### 2026-07-04 (v13) — Onboarding walkthrough + extended i18n (Dashboard/Clients)
- Post-signup onboarding: new users (registerEmail sets needsOnboarding) are routed by RootNav to /onboarding — a 6-slide translated feature walkthrough (Skip/Back/Next/Get started, progress dots, tab bar hidden). completeOnboarding() persists AsyncStorage flag then -> tabs. Existing users skip it. Re-openable from Account > "How to use the app" (/onboarding?tour=1 -> returns to /account).
- Extended i18n to Dashboard + Clients (149 keys x 9 langs, structure + interpolation placeholders validated). Tester confirmed Thai renders on both screens with real numbers (no {{}} leaks) and clean English revert.
- Tested iteration_16: 6/6 flows pass (incl. existing-user regression). Fixed tour Skip navigation (router.replace('/account')).
- Follow-ons: i18n for NotesCard + remaining deep screens (invoices/planner/scan/vault/reports/settings); RN-web shadow*/pointerEvents deprecation warnings (non-blocking).

### 2026-07-04 (v14) — i18n coverage for main tabs + auth + NotesCard
- Translated Invoices, Scan, Planner, NotesCard, Register, Forgot (230 keys x 9 langs; structure + interpolation placeholders validated). Fixed shadowed `t` variables in Planner. Receipt category + task-type stored VALUES kept in English (data integrity); display labels translated.
- Tested iterations 15/16/17 + self-verified: Invoices/Planner/Scan/NotesCard/Register render clean in Thai with zero {{}} leaks, count interpolation correct, English revert clean; invoice paid/unpaid toggle regression OK on owner account.
- i18n DONE surfaces: login, register, forgot, tabs, account, language, learn, onboarding, dashboard, clients, invoices, scan, planner, NotesCard.
- i18n REMAINING (follow-on): deep tool screens (vault, reports, settings, credentials, templates, membership, ndis-codes/assistant), detail/form screens (client/[id], invoice/new, invoice/[id], notes editor, ndis-import), shared form components.
- NOTE: translations are AI-generated ("community translation"); genuine native-speaker/NAATI review is a human step (cannot be done by the agent) — recommended before public multilingual launch.

### 2026-07-04 (v15) — i18n coverage completed for settings/tools + all detail/form screens (P0 + P1)
- P0 screens localized & verified (iteration_18): Business Profile (settings), Membership, Expenses (vault), Certs & Insurance (credentials). Fixed shadowed `t` (renamed doc/type map params). Data-value chips (categories, doc/severity enums) kept English for DB integrity; display labels translated.
- P1 screens localized & verified (iteration_19): Code Assistant (assistant), NDIS Support Codes (ndis-codes), Reports & BAS (reports), Templates, Shift, Invoice detail (invoice/[id]), New/Edit Invoice (invoice/new), Client detail (client/[id]). en.json now 559 keys; 194 unique t() literals + 10 dynamic template-key combos all resolve. Zero i18n key leaks at runtime across all screens + modals.
- Translation sync: en.json is source of truth; run `python /app/scripts/translate_locales.py` (all langs) or `/app/scripts/translate_retry.py` (pa+ta only, lenient JSON parse). Current state: en + th, hi, zh, vi, ar, tl FULLY synced (P0+P1). **Punjabi (pa) & Tamil (ta) are missing the P1 new sections** (assistant/ndisCodes/reports/templates/shift/invoiceDetail/clientDetail/invoiceNew) and fall back to English — blocked by EMERGENT_LLM_KEY budget exhaustion (Profile → Universal Key → Add Balance, then re-run translate_retry.py to finish pa+ta).
- i18n now effectively DONE across the whole app. Remaining minor: ndis-import screen, notes editor, catalogue category/tag data labels (technical NDIS terms, intentionally English). Native-speaker/NAATI review still a recommended human step before public multilingual launch.

### 2026-07-04 (v16) — Feature roadmap batch (Phases A–E), all tested
User requested a large feature batch; built & tested in 5 phases:
- **Phase A (iter 20):** Invoice list shows time-since-sent ('Sent Xd Yh ago') + amber 'UNSENT' badge for non-draft invoices never sent. Receipts view shows 'incl. $X GST' subtotal. Expenses Calendar shows This week/This month/To date spend subtotals. Business Profile got a modern structured address card (street/suburb/state/postcode, composed into legacy `address` string on save). Voice-to-text mic added to NDIS Code Assistant input. Confirmed Reports/BAS already recompute live on focus.
- **Phase B+C (iter 21):** invoice/new.tsx fully rewritten. MULTI-PARTICIPANT: add multiple participants (collapsible cards, each own client link + fields + line items + notes); on submit creates a SEPARATE compliant invoice per participant (choice 1b). 'Copy item to other participants' button (copy/paste). 3-BUTTON workflow footer: Delete · Save · Send now. Save is standalone-safe; if an active shift exists, a modal offers 'Add to current shift' / 'Save without shift'. Send marks sent + shares PDF (single). Edit mode = single participant. Compliance checks now evaluate across all participants.
- **Phase D (iter 22):** Plan-ahead Shifts (choice 3a). New backend: POST /shifts/plan, GET /shifts, PATCH /shifts/{id}/activate, DELETE /shifts/{id}. Shift screen lists planned shifts (activate/cancel), plan a shift for a future date (pre-builds draft invoices per client), or Start now. Live shift retained.
- **Phase E (iter 22):** Bank Reconcile (secure CSV workaround — NO bank credentials/Open-Banking). New backend: POST /bank/import (flexible CSV parser, AU date formats, debit/credit columns), GET /bank/transactions, PATCH (select/ignore), POST /bank/transactions/{id}/reconcile (marks invoice paid → feeds BAS/income live), DELETE. New screen app/(tabs)/bank.tsx (paste or pick .csv), auto-matches deposits to outstanding invoices by amount+invoice-number, per-row select/unselect for privacy, ignore, reconcile one or selected. Linked from Reports. Bug fixed in testing: suggested_invoice_id uses str(match['_id']).
- Choice 4 (AI grammar 'polish') intentionally DEFERRED per user (revisit cost/scale later).
- i18n: all new English keys added; full translation sync run to propagate to all 8 other languages.
- Data note: iter22 reconcile test marked INV-1008 paid as a real side-effect.

### 2026-07-04 (v17) — Support-worker Tips banner + AI App-Help chat
- **Tips banner:** rotating educational banner on the Dashboard (below hero). 52 accurate real-world tips in /app/frontend/src/tips.ts (17 highlight the app's value/efficiency). Rotates every ~6.5s with fade; tap to advance. Component: src/components/TipsBanner.tsx.
- **App-Help chat:** new screen app/(tabs)/help.tsx (Dashboard → Tools → Help). LLM-backed how-to/troubleshooting assistant using GPT-4o via Emergent key. Backend POST /api/ai/app-help with a fixed APP_HELP_KNOWLEDGE system prompt (navigation + how-to + compliance-panel troubleshooting). Voice input included. Answers e.g. "how do I set up pre-filled invoices?", "why won't my invoice send?".
- **LANGUAGE TODO (deferred per user):** tips.ts is intentionally English-only; help.* + dashboard.tHelp keys were added to en.json only. All 8 non-English locales currently fall back to English for: help.*, dashboard.tHelp, and the tips content. Batch-translate these (and any future additions) in ONE sync run once feature work settles: run scripts/translate_locales.py, then scripts/translate_retry.py for any that fail; for large-payload failures (Tamil), use scripts/translate_ta_missing.py (translates only missing keys + merges). tips.ts will need its own translation approach (data file, not in locales).

### 2026-07-07 (v18) — Field-test bug fixes + Care Profile rework (Phases 1–2 of user's APK feedback)
- **'Page not found' on first sign-in:** added app/+not-found.tsx → any unmatched route silently redirects to '/'.
- **Tutorial on first login:** AuthContext.finishAuth now checks per-user AsyncStorage key `ndis_onboarded:<user_id>` → onboarding walkthrough shows on FIRST sign-in per device (not just registration). Added restartOnboarding(). New 7th slide advertises the 14-day free trial.
- **Trial visibility:** dashboard shows green '{{days}} days left in your free trial → View plans' banner when membership.status==='trialing'; membership screen shows 'Free 14-day trial / Trial ends dd/mm/yyyy · N days left' + Subscribe buttons (no Cancel for trials).
- **Fresh-start reset:** POST /api/account/reset-data wipes ALL org collections + settings + credentials (keeps account); owner email also restarts a fresh 14-day trial. In-app: Account > DANGER ZONE > 'Start fresh — erase all data' (double-confirm) → clears local checklist flags → routes to onboarding. Owner org was reset (settings gone → checklist 0/4 unticked, fixing 'business profile pre-ticked').
- **Notes:** 'Save to client' now clears today's note text after saving (persist({text:''})).
- **dd/mm/yyyy everywhere:** membership dates, client detail (reminders, tasks, invoices, saved notes, DOB header), vault receipt dates, credentials expiry; DOB + reminder date inputs switched to DateInput (DD/MM/YYYY).
- **Keyboard never covers inputs:** react-native-keyboard-controller@1.18.5 installed; KeyboardProvider wraps root; KeyboardAvoidingView imports swapped to the lib (behavior height on Android) across 16 screens; ClientFormSheet/client detail/template editor use KeyboardAwareScrollView. NATIVE-ONLY — requires a NEW APK build; no-ops on web preview.
- **Care Profile rework (user: remove condition/severity entirely):** backend Client/ClientCreate models dropped condition+severity; new `care_sections: [{title,text}]`. ClientFormSheet: flexible sections w/ suggestion chips (Communication, Mobility, Personal care, Routines & preferences, Likes & dislikes, Health & safety, Goals) + custom sections. Client detail renders sections in the Care Profile card.
- i18n: all new keys synced to 9 languages (scripts/translate_merge.py). Tested iteration_25: 12/12 backend + all frontend flows pass.

### 2026-07-07 (v19) — Shift templates, live preview & trip planning (Phases 3–4)
- **Backend:** new collection shift_templates + CRUD (/api/shift-templates GET/POST/PUT/DELETE). Template: name, client_id/client_name, start_time/end_time (HH:MM), routine_tasks[], items[{ndis_code,description,quantity,rate}], trip_stops[{name,address,icon}]. Responses include preview_subtotal/gst/total (same maths as invoice builder). /shifts/start + /shifts/plan accept template_id → template's client auto-included, its draft invoice pre-filled with template line items (totals computed), planner tasks auto-created from routine_tasks (type 'shift', template start_time), shift stores template_id/start_time/end_time. /shifts/active embeds the template (for trip plan on live shift).
- **Frontend:** Dashboard now shows 'Current Shift' (green, only while on shift) + 'Create Shift' buttons. Shift screen: templates section (cards w/ client, times, N tasks · N codes, preview total; pencil=edit, tap=select), live 'Shift preview' panel (participant, times, routine tasks, billing lines, invoice total, trip stops), template-aware CTAs ('Start now · {name}' / 'Plan · {name}'). New components: src/components/ShiftTemplateEditor.tsx (bottom-sheet editor w/ client chips, HH:MM auto-format, routine task list, recent-codes suggestion chips from /clients/{id}/recent-codes, manual line items w/ live total, trip stops w/ 10 activity icons) and src/components/TripPlan.tsx (ordered stops, one-tap Google Maps `google.com/maps/dir/?api=1&destination=` / Waze `waze.com/ul?q=..&navigate=yes` deep links). Active shift shows times chip + trip plan.
- i18n: 39 new keys synced to 9 languages.

### 2026-07-08 (v20) — NDIS-compliant invoicing, Next of Kin, AI document scanner, Planner UX (iteration 29, FULL PASS)
User answered pending Phase-A questions: privacy-policy consent DEFERRED (wants professional compliant copy later); Next of Kin = ONE contact; scanned docs live in client's Documents section. Also supplied an NDIS invoicing compliance spec.
- **NDIS-compliant invoicing:** InvoiceItem gained service_date/start_time/end_time (optional per line, "no date ranges") + gst_free (default TRUE — GST now only charged on items explicitly marked not GST-free; compute_invoice_totals updated). Invoice gained ttp bool (Temporary Transformation Payment claim type). Unique never-reused invoice numbers via persistent counter db.counters ("invoice::<org>") — survives deletion of highest number. Settings gained account_name (Business Settings UI between Bank & BSB; appears in PDF payment details). PDF: per-line "Delivered: dd/mm/yyyy · HH:MM–HH:MM · GST-free" meta under description, "Claim type: TTP (Temporary Transformation Payment)" meta line, GST totals row labelled "GST (GST-free supports)" when $0, Account name line. Frontend invoice/new: per-item service date + start/end time inputs + GST-free checkbox, invoice-level TTP toggle (testID ttp-toggle), new compliance check "Invoice dated on/after service date(s)", totals card now shows Subtotal/GST/Total live. Invoice detail shows per-line delivered date/times, GST-free label, Claim type: TTP.
- **Next of Kin (one contact):** clients.next_of_kin {name,relationship,phone,email}. ClientFormSheet section (testIDs nok-*); client profile card (nok-card) with tap-to-call phone chip + email.
- **Scanner Document Mode:** POST /api/scan-document (auth-protected, GPT-4o Vision via Emergent key) extracts {title, doc_type, date, key_parties[], full_text, confidence}. client_documents accept extracted_text/doc_date/key_parties. Client profile Add-document modal has 3rd "AI Scan" button (doc-ai-scan) → capture → auto-fills title/type + stores readable text; doc rows (sparkles icon when AI-scanned) open detail sheet (doc-view-sheet) showing image + extracted text + key parties.
- **Planner UX:** tap row = edit sheet pre-filled (Edit plan, Save changes, Delete button); tap checkbox = complete; X = quick delete. Day cards show up to 4 colored type dots (shift/task/event + finance amber). Selected-day summary chips (planner-summary): "N Shift / N Task / x/y done".
- i18n: ~25 new keys synced to all 9 languages (scripts/translate_merge.py NEW_KEYS updated).
- Testing: iteration_29 — 12/12 backend pytest + 20/20 frontend UI checks PASS. LESSON: never run parallel search_replace edits on the SAME file (corrupted server.py once; restored via git checkout and re-applied via single python patch script).
- **Still pending (backlog):** P0 privacy-policy consent screen (deferred, needs professional copy), Phase B tier gating + AI code→shift/invoice attach, Phase C planner day/week/month views + audible alarms (expo-audio/notifications, native build), VPN offline-loop issue on APK, server.py refactor into routes/.

### 2026-07-08 (v21) — Privacy consent, tier gating, AI attach, planner views, audible alarms, VPN fix (iteration 30, FULL PASS 16/16 backend + frontend)
User approved: Free = 2 clients / 3 invoices/mo / 10 AI actions/mo; Business tier deferred to employee suite; consent must-accept.
- **Privacy Policy + Consent (P0, APP compliance):** /app/backend/privacy_policy.py (VERSION 1.0, professional APP-compliant copy: APPs 1-13, AI disclosure, NDB scheme, OAIC complaints). Endpoints: GET /api/legal/privacy-policy (PUBLIC — needed for app stores), GET /api/legal/consent, POST /api/legal/consent/accept (server-side timestamp+version on users doc). Blocking consent screen app/(tabs)/consent.tsx (accept → onboarding/tabs; decline → sign-out). AuthContext.needsConsent + acceptPrivacy; RootNav gates consent BEFORE onboarding. Read-only /privacy-policy screen from Account with "accepted on" banner. Version bump → users re-accept when PRIVACY_POLICY_VERSION changes.
- **Tier gating:** FREE_LIMITS in server.py; _is_pro (membership_expires_at in future = trial/paid/lifetime), enforcement on POST /clients, POST /invoices, duplicate, shift drafts, and all 5 AI endpoints via _consume_ai (db.ai_usage per org/month). 402 detail "UPGRADE_REQUIRED:<feature>:<limit>". GET /api/billing/limits {tier, limits, usage}. Frontend: api.ts maybeUpgrade → global UpgradeSheet modal (mounted in root layout, routes to /membership); membership screen shows usage bars (usage-card) for free tier.
- **AI Code Assistant attach:** assistant code chips open attach-sheet: New invoice OR append to draft invoice (active-shift drafts flagged/sorted first). Backend POST /api/invoices/{id}/items appends + recomputes totals.
- **Planner Day/Week/Month:** segmented control (view-day/week/month). Week = 7 rows w/ type-count chips + 3 task previews + nav; Month = Monday-first calendar grid w/ numeric badges + type dots + THIS MONTH summary; both drill into Day view.
- **Audible alarms:** src/alarms.ts — expo-notifications DATE triggers on timed plans (schedule on create/edit, cancel on delete/complete), per-sound Android channels (alarm-default/chime/bell/pulse), contextual permission flow per handle_permissions_contract (pre-prompt, canAskAgain, Open Settings). 3 generated WAVs in frontend/assets/sounds (scripts/gen_sounds.py). app.json: expo-notifications plugin sounds array; version 1.1.0 / versionCode 3. Alert-sound picker /alert-sound (expo-audio preview). NATIVE BUILD REQUIRED for notification sounds — user must rebuild APK.
- **VPN fix:** api.ts checkOnline() = real GET /api/ probe (4s timeout, 8s cache) replaces NetInfo trust; OfflineBanner probes (NetInfo listener only triggers re-check). Fixes infinite offline loop under VPNs.
- i18n: ~45 new keys synced to 9 languages.
- Testing: iteration_30 FULL PASS. Note: owner+demo consent now accepted server-side; INV-1010 (owner) has 2 items from attach test.
- **Backlog:** Business tier + employee suite, panic button DIY, server.py refactor into routes/.
