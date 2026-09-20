#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
## ── Phase 0 + Phase 1: Multi-tenant Security Refactor (2026-07-04) ──
## user_problem_statement: "Enforce authentication + org_id data isolation across ALL API endpoints (Phase 0), and add TOTP 2FA + audit logging + rate limiting (Phase 1) for NDIS multi-user compliance."
## backend:
##   - task: "Auth enforcement on all data endpoints (Depends(current_org))"
##     implemented: true
##     working: true
##     file: "backend/server.py"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Added Depends(current_org) to ALL 50+ data endpoints (clients, invoices, receipts, expenses, tasks, credentials, reminders, notes, shifts, client-documents, settings, reports, dashboard). Verified via curl: unauth /clients -> 401. NDIS catalogue stays global."
##   - task: "org_id multi-tenant data isolation + migration"
##     implemented: true
##     working: true
##     file: "backend/server.py"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Every query scoped by org_id via _oid_org() helper. Startup migration assigns all existing ownerless data to TEST_USER's org; demo starts empty. Verified: owner sees 2 clients, demo sees []. Cross-tenant GET/DELETE of owner's client by demo returns 404 / no-op (owner data intact)."
##   - task: "TOTP 2FA (setup/verify-enrollment/disable/verify-challenge) + two-step login"
##     implemented: true
##     working: true
##     file: "backend/server.py"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "pyotp + qrcode. Verified full flow via curl+pyotp: setup returns secret+QR, verify-enrollment enables & returns 8 backup codes, login then returns two_factor_required+challenge_id, verify-challenge exchanges TOTP for session token. Backup codes bcrypt-hashed, single-use."
##   - task: "Immutable audit log + rate limiting"
##     implemented: true
##     working: true
##     file: "backend/server.py"
##     stuck_count: 0
##     priority: "medium"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Append-only audit_log via HTTP middleware records org_id/user_id/method/path/status/ip/ts on all mutations. GET /api/audit-log is org-scoped read-only. Verified entries created. slowapi rate limits on /auth/login (10/min), /auth/2fa/verify-challenge (10/min), /auth/forgot & /auth/reset (5/min)."
## frontend:
##   - task: "Two-step 2FA login screen"
##     implemented: true
##     working: "NA"
##     file: "frontend/app/(auth)/login.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Login now handles two_factor_required: shows OTP entry step, calls verifyLoginTwoFactor. Needs UI test."
##   - task: "2FA management screen (setup QR, verify, backup codes, disable)"
##     implemented: true
##     working: "NA"
##     file: "frontend/app/(tabs)/security.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "New screen reachable from Account > Security. Shows QR + manual key, verifies enrollment, displays backup codes (copy), and disable flow. Needs UI test."
##   - task: "Security activity log screen"
##     implemented: true
##     working: "NA"
##     file: "frontend/app/(tabs)/audit-log.tsx"
##     stuck_count: 0
##     priority: "low"
##     needs_retesting: true
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "New screen reachable from Account > Security activity log; lists audit trail. Needs UI test."
## metadata:
##   created_by: "main_agent"
##   version: "1.1"
##   test_sequence: 1
## test_plan:
##   current_focus:
##     - "Auth enforcement on all data endpoints"
##     - "org_id multi-tenant data isolation + migration"
##     - "TOTP 2FA + two-step login"
##   stuck_tasks: []
##   test_all: false
##   test_priority: "high_first"
## agent_communication:
##     -agent: "main"
##     -message: "Completed Phase 0 (auth + org isolation) and Phase 1 (2FA, audit, rate limiting). Backend verified via curl. Please run full cross-tenant matrix on backend and validate 2FA + login flows on frontend. Credentials in memory/test_credentials.md."

## ── i18n Multi-language + Learning Hub (2026-07-04) ──
## frontend:
##   - task: "i18n foundation (i18next + expo-localization) + 8 languages"
##     implemented: true
##     working: true
##     file: "frontend/src/i18n/index.ts, frontend/src/i18n/locales/*.json"
##     stuck_count: 0
##     priority: "medium"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "8 languages (th,hi,pa,ta,zh,vi,ar,tl) + en. GPT-4o generated translations, all 85 keys validated identical structure. Device-locale detect + AsyncStorage persistence. Smoke test: switching to Thai translated Language screen + bottom tab bar; Arabic right-aligned."
##   - task: "Language switcher screen"
##     implemented: true
##     working: true
##     file: "frontend/app/(tabs)/language.tsx"
##     stuck_count: 0
##     priority: "medium"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Account > Language. Lists all langs w/ native names + community-translation pills; selection persists. Verified via smoke test."
##   - task: "Learning & Resources hub (per-language, official NDIS links)"
##     implemented: true
##     working: "NA"
##     file: "frontend/app/(tabs)/learn.tsx"
##     stuck_count: 0
##     priority: "low"
##     needs_retesting: true
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Account > Learning & resources. Opens official ndiscommission.gov.au / ndis.gov.au links (rights, worker orientation, code of conduct, complaints, info in your language). Translated labels. Needs UI test."
##   - task: "Core screens wired to i18n (login, tabs, account)"
##     implemented: true
##     working: true
##     file: "frontend/app/(auth)/login.tsx, frontend/app/(tabs)/_layout.tsx, frontend/app/(tabs)/account.tsx"
##     stuck_count: 0
##     priority: "medium"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Login (incl. 2FA step), tab bar labels, and Account screen use t(). Other screens remain English (planned follow-on). No regressions expected."
## agent_communication:
##     -agent: "main"
##     -message: "Added i18n (8 languages) + Learning hub. Please validate frontend ONLY: (1) login as TEST_DEMO_EMAIL / TEST_PASSWORD, (2) Account>Language switch to Thai then Arabic then back to English - confirm tab bar + account labels change and persist across navigation, (3) Account>Learning & resources renders and rows are tappable, (4) confirm no regression: dashboard, clients list, invoices list still load. Do NOT re-test backend (already 30/30)."

## ── Onboarding walkthrough + extended i18n (2026-07-04) ──
## frontend:
##   - task: "Post-signup onboarding walkthrough (6 slides, translated) + Account re-entry"
##     implemented: true
##     working: true
##     file: "frontend/app/(tabs)/onboarding.tsx, frontend/app/_layout.tsx, frontend/src/auth/AuthContext.tsx, frontend/app/(tabs)/account.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "New user register -> RootNav routes to /onboarding (needsOnboarding). 6 paged slides w/ dots, Skip/Back/Next/Get started. completeOnboarding() persists AsyncStorage flag then -> /(tabs). Re-openable from Account > 'How to use the app' (/onboarding?tour=1) which returns to Account. Smoke test verified register->onboarding->dashboard."
##   - task: "Extended i18n: Dashboard + Clients screens (with interpolation)"
##     implemented: true
##     working: true
##     file: "frontend/app/(tabs)/index.tsx, frontend/app/(tabs)/clients.tsx"
##     stuck_count: 0
##     priority: "medium"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "149 keys across 9 langs, all structure-validated + interpolation placeholders ({{count}},{{days}},{{amount}},{{name}},{{done}},{{total}}) verified preserved in all languages. Dashboard static labels/sections + Clients fully wired. Renamed shadowed map var 't'->task/tool to protect translation fn."
## agent_communication:
##     -agent: "main"
##     -message: "Please validate FRONTEND ONLY: (1) NEW USER: register a fresh account -> onboarding walkthrough must appear, swipe/Next through slides, Get started -> lands on dashboard. (2) EXISTING USER regression: login TEST_DEMO_EMAIL / TEST_PASSWORD must go STRAIGHT to dashboard (NO onboarding). (3) Account > 'How to use the app' reopens the tour and Skip returns to Account. (4) i18n: Account>Language switch to Thai -> Dashboard section titles/labels + Clients screen translate, counts render correctly (e.g. participants count, Outstanding · N) with NO raw {{placeholder}} leaking; switch back to English. Do NOT test backend."

## ── i18n coverage: main tabs + auth + NotesCard (2026-07-04) ──
## frontend:
##   - task: "i18n for Invoices, Scan, Planner, NotesCard, Register, Forgot"
##     implemented: true
##     working: true
##     file: "frontend/app/(tabs)/invoices.tsx, scan.tsx, planner.tsx, frontend/src/components/NotesCard.tsx, frontend/app/(auth)/register.tsx, forgot.tsx"
##     stuck_count: 0
##     priority: "medium"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "230 keys x 9 langs, structure + interpolation placeholders all validated. Renamed shadowed 't' vars in planner (toggle/keyExtractor/TYPES map) to protect translation fn. Smoke test: Invoices + Planner render fully in Thai, count interpolation ('0 total') correct, ZERO {{}} leaks, English revert clean. Receipt categories + task type VALUES stay English (data integrity); only display labels translated."
## agent_communication:
##     -agent: "main"
##     -message: "Please validate FRONTEND ONLY the newly-translated screens + regression. (1) Switch app to Thai (Account>Language>lang-th). (2) Visit Scan tab (testID camera perm or scanner) — labels translated, no {{}} leaks, no crash. (3) NotesCard on dashboard shows translated title/Record/placeholder. (4) Logout -> Register screen (go-register) + Forgot screen translated. (5) Switch back to English (lang-en) and confirm all revert. (6) REGRESSION: in English, create a task in Planner and toggle complete (celebration), toggle an invoice paid/unpaid on Invoices — must still work. Backend already 30/30; do not retest backend."

## ── Plan management types + Client Activity Templates + Planner attach + Copyable notes (2026-07-08) ──
## backend:
##   - task: "Invoice/Client management_type + plan_manager fields + PDF routing to plan manager"
##     implemented: true
##     working: true
##     file: "backend/server.py"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Added management_type (self_managed|plan_managed|ndia_managed), plan_manager_name, plan_manager_email to both Invoice + Client. Also accepted_plan_codes list on Client. create_invoice + edit_invoice carry-through. PDF: when plan_managed, appends 'Send to plan manager:' block with name & email to BILL TO. Meta line now shows 'Plan type:'."
##   - task: "Per-client Activity Templates CRUD"
##     implemented: true
##     working: true
##     file: "backend/server.py"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "New collection client_activity_templates + endpoints POST/GET/PATCH/DELETE under /api/clients/{client_id}/activity-templates. Fields: name, activity_type, duration_min, location, distance_km, description, notes, checklist[]. Strictly per-client (ownership verified via _oid_org)."
##   - task: "Task model extended with activity_template_id/shift_id/location/duration + active shift returns planned_activities"
##     implemented: true
##     working: true
##     file: "backend/server.py"
##     stuck_count: 0
##     priority: "medium"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Task/TaskCreate now optionally carry activity_template_id, shift_id, duration_min, location, distance_km, activity_type. /shifts/active returns planned_activities[] (tasks whose shift_id matches active shift) sorted by time."
## frontend:
##   - task: "Client profile: copyable saved notes (Copy button + selectable text)"
##     implemented: true
##     working: true
##     file: "frontend/app/(tabs)/client/[id].tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Each saved note now has a Copy button (expo-clipboard) + selectable Text so users can highlight and copy pieces to paste into plan-manager text/group chats. Confirm toast on copy."
##   - task: "Invoice: Self / Plan / NDIA managed toggle + plan manager fields + plan-code warning"
##     implemented: true
##     working: true
##     file: "frontend/app/(tabs)/invoice/new.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "New management type chips below TTP. Plan-managed reveals name+email inputs (highlighted, email validated visually). Auto-hydrates from linked client. Non-blocking warning banner when a line item's NDIS code isn't in the client's accepted_plan_codes list."
##   - task: "Fix: Invoice code picker (search codes / activity) subsections not visible"
##     implemented: true
##     working: true
##     file: "frontend/app/(tabs)/invoice/new.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Picker sheet changed maxHeight->height:82% and FlatList given style flex:1 + contentContainerStyle padding so Favourites/Recent/All support items scroll correctly and are always visible below the search input on both invoice create AND edit."
##   - task: "Client Activity Templates editor (create/edit/delete + type badges + checklist)"
##     implemented: true
##     working: true
##     file: "frontend/src/components/ActivityTemplatesEditor.tsx, frontend/app/(tabs)/client/[id].tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "New reusable component surfaces per-client templates. Client profile shows up-to-4 template rows + 'See all N' link. Templates carry name/type/duration/location/distance/description/notes/checklist and are picked from the Planner attach flow."
##   - task: "Planner: Attach to Participant/Activity template/Current shift/Saved shift + duration/location/distance fields"
##     implemented: true
##     working: true
##     file: "frontend/app/(tabs)/planner.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Planner new/edit modal now has an 'ATTACH TO' block: participant picker → shows their activity templates → auto-populates title/duration/location/distance. Current-shift and Saved-shift toggles link the task to a shift so it appears on the active-shift screen. Row list now shows glanceable extras (duration · location)."
##   - task: "Shift screen: Planned routines & activities summary + tap-through detail modal"
##     implemented: true
##     working: true
##     file: "frontend/app/(tabs)/shift.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Active shift screen shows Planned routines/activities section pulling from GET /shifts/active planned_activities. Rows: time+duration · type · location · chevron. Tap opens a modal with duration/location/distance chips, notes and a Mark complete toggle."
##   - task: "ClientFormSheet: management type + plan manager + accepted plan codes"
##     implemented: true
##     working: true
##     file: "frontend/src/components/ClientFormSheet.tsx"
##     stuck_count: 0
##     priority: "medium"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Client editor now has Plan management type chips (Self / Plan managed / NDIA), reveals plan-manager name/email when plan_managed, plus a repeatable Accepted plan codes chip list to drive invoice code warnings."
##   - task: "i18n: new keys synced across 9 locales"
##     implemented: true
##     working: true
##     file: "frontend/src/i18n/locales/*, scripts/translate_merge.py"
##     stuck_count: 0
##     priority: "low"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Translate merge run: clientDetail.activityTpls/copy/noteCopied/savedNotesCopyHint, activityTpl.*, invoiceNew.mgmt*/pm*/codeWarning, planner.attach*, shift.plannedActivities* — all 9 languages synced (OK across th/hi/pa/ta/zh/vi/ar/tl)."
## agent_communication:
##     -agent: "main"
##     -message: "Please test the following new backend + frontend flows. Test both backend + frontend (use TEST_USER_EMAIL / TEST_PASSWORD). BACKEND (all under /api): 1) POST/PUT invoice with management_type=plan_managed and plan_manager_name/plan_manager_email — verify GET returns them and PDF header adds 'Send to plan manager:' block. 2) PATCH client with management_type + accepted_plan_codes — verify persisted. 3) POST/GET/PATCH/DELETE /clients/{cid}/activity-templates — full CRUD. 4) Create Task with activity_template_id + shift_id — verify /shifts/active returns it in planned_activities[]. FRONTEND: 5) Login → open a client → Saved notes → Copy button toast + selectable text works. 6) Client → Activity templates section → 'New template' → save → appears in the list. 7) Client → Edit → set management_type=Plan managed → add plan manager email + accepted codes → save. 8) Invoice → New → link that client → management_type auto-fills Plan managed + plan manager section appears; add a line item with a code NOT in accepted list → yellow warning banner appears. 9) Fix verification: open NDIS code picker on invoice → below the 'Search code or activity' input, Favourites / Recent / All support items sections must ALL be visible and scrollable. 10) Planner → + FAB → tap Participant → pick client → Activity picker opens → pick a template → duration/location auto-populate. 11) On an active shift → new Planned routines & activities section shows tasks linked to the shift and taps open the detail modal."

## ── Retention + Save-loop fix (2026-07-08 pre-build) ──
## backend:
##   - task: "list_shifts accepts include_ended=true (retains history)"
##     implemented: true
##     working: true
##     file: "backend/server.py"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "GET /api/shifts?include_ended=true now returns ended shifts as well (default false to preserve existing behaviour). 5k list cap. Sorted so active first."
##   - task: "Bump listing caps for 7-year retention"
##     implemented: true
##     working: true
##     file: "backend/server.py"
##     stuck_count: 0
##     priority: "medium"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "list_invoices/list_receipts/list_expenses/list_tasks/list_reminders/list_client_notes/client_overview raised to to_list(20000). Zero data ever auto-deleted (audited: only user_sessions + twofa_challenges carry TTL)."
## frontend:
##   - task: "45s AbortController on all mutations — fixes stuck invoice save loop"
##     implemented: true
##     working: true
##     file: "frontend/src/api.ts"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Wrapped mutation fetch with AbortController(45s). On abort → treated as network error → mutation queued for offline replay. GET fetch also has a 30s AbortController; on abort falls back to offline cache. This prevents the reported invoice-save infinite spinner."
##   - task: "Shift screen: Past shifts (ended) collapsible section"
##     implemented: true
##     working: true
##     file: "frontend/app/(tabs)/shift.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "listShifts(true) now fetches all statuses; ended shifts are split into pastShifts[] and rendered under a collapsible header. Shows up to 30 rows with dates, invoice count and totals. Compliance hint included."
##   - task: "Planner day carousel extended to -7…+21 with auto-scroll to today"
##     implemented: true
##     working: true
##     file: "frontend/app/(tabs)/planner.tsx"
##     stuck_count: 0
##     priority: "medium"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "next14() → dayWindow(-7..+21). ScrollView ref auto-scrolls to today onLayout so past days sit off-screen but swipeable. Week/Month tabs unchanged."
##   - task: "Account: retention compliance note"
##     implemented: true
##     working: true
##     file: "frontend/app/(tabs)/account.tsx"
##     stuck_count: 0
##     priority: "low"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Small info card under Privacy Policy: 'Your records (invoices, receipts, notes, shifts, planner) are retained for 7 years to meet Australian business record-keeping obligations.' — 9 locales synced."
## agent_communication:
##     -agent: "main"
##     -message: "Please test the following focused fixes only (feature set from iteration 31 remains stable; no regressions expected):\nBACKEND:\n1) GET /api/shifts (default) still returns only planned/active shifts.\n2) GET /api/shifts?include_ended=true also returns ended shifts, sorted so active first.\n3) Confirm no TTL index appears on invoices/tasks/shifts/receipts/client_notes/expenses (retention safety).\nFRONTEND:\n4) Login as TEST_USER_EMAIL / TEST_PASSWORD. Open the Shifts tab — if the seed data has any ended shift, the 'Past shifts · N' collapsible header should appear (tap expands). If no ended shifts, section is hidden.\n5) Planner: verify the day carousel now shows 7 past days + today + 20 future days, auto-scrolled so today is centred-ish on mount. Tapping a past day loads that date's tasks.\n6) Account tab: near Privacy Policy, verify the small 'retentionNote' compliance banner is visible.\n7) Regression: create + save an invoice. If it saves quickly, that's the win. (The 45s AbortController only kicks in on hung network; happy path unchanged.)"

## ── Iteration 33: In-app preview + save UX + shift hours 24h + PDF auth fix + one-tap Save to planner (2026-07-08) ──
## backend:
##   - task: "Task model — start/end time 24h (end_time added)"
##     implemented: true
##     working: true
##     file: "backend/server.py"
##     stuck_count: 0
##     priority: "medium"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Task + TaskCreate now carry end_time. Existing 'time' becomes the start. Backwards compatible."
## frontend:
##   - task: "In-app invoice preview (faithful paper render, matches PDF styles)"
##     implemented: true
##     working: true
##     file: "frontend/app/(tabs)/invoice/preview/[id].tsx, frontend/app/(tabs)/invoice/[id].tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "New route /invoice/preview/[id] renders the whole invoice as a paper mock (band header for modern, classic underline, minimal rule) with logo, BILL TO/plan-manager, invoice meta grid, striped item table with Code/Desc/Qty/Rate/Amount, totals stack, notes, remit-to footer. Preview button on invoice/[id] now navigates here instead of downloading a PDF. Share PDF stays as secondary action in header + footer."
##   - task: "Fix PDF download/share (auth token missing → 401 downloaded as .pdf)"
##     implemented: true
##     working: true
##     file: "frontend/src/download.ts, frontend/src/api.ts"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "shareGetFile now attaches Authorization header via getAuthToken(). Non-2xx download deletes the target file and throws with HTTP status so the caller can show a toast. sharePostFile updated the same way. Root cause of 'PDF won't open even after download'."
##   - task: "Invoice new/edit: single Service date (removed per-line-item date)"
##     implemented: true
##     working: true
##     file: "frontend/app/(tabs)/invoice/new.tsx"
##     stuck_count: 0
##     priority: "medium"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Line items no longer render a service-date input; each item.service_date is set to the invoice-level serviceDate on save (backward compatible). Compliance check simplified accordingly."
##   - task: "Invoice line-item start/end times auto-format HH:MM"
##     implemented: true
##     working: true
##     file: "frontend/app/(tabs)/invoice/new.tsx, frontend/src/utils/time.ts"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Shared formatTime24h() drops non-digits, caps 4 chars, clamps HH ≤ 23 & MM ≤ 59, and inserts the colon after two digits. Applied to invoice start/end inputs (maxLength=5, keyboard number-pad)."
##   - task: "Planner: start/end shift hours in 24h + live duration hint"
##     implemented: true
##     working: true
##     file: "frontend/app/(tabs)/planner.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Modal replaces single time+minutes with start & end 24h inputs (auto-format). Live 'Shift duration: 8h 30m' hint under the inputs when both filled. Task row shows '09:00 – 17:00 · 8h · <location>' summary. On save, minutesBetween derives duration_min when unset."
##   - task: "Business settings save UX (dirty tracking + green tick, hide save when clean)"
##     implemented: true
##     working: true
##     file: "frontend/app/(tabs)/settings.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Snapshots the saved payload, computes `dirty = JSON.stringify(form) !== savedSnapshot`. Save button only renders when dirty; on success shows a green tick 'Saved' badge for ~2.2s (with sound via confirm), then falls to a subtle 'All changes saved' pill. Any field edit re-enables the button instantly."
##   - task: "Shift screen: one-tap Save to planner (removed Schedule for date input)"
##     implemented: true
##     working: true
##     file: "frontend/app/(tabs)/shift.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "DateInput and 'Schedule date' section removed. Footer becomes a 2-button row: 'Save to planner' (ghost, defaults to today's date; users can re-attach via Planner) + 'Start now' (primary). DateInput import removed."
## agent_communication:
##     -agent: "main"
##     -message: "Please test the following (credentials: TEST_USER_EMAIL / TEST_PASSWORD):\nBACKEND:\n1) Task model accepts end_time field via POST/PATCH /api/tasks and returns it via GET.\nFRONTEND:\n2) Open any invoice → tap 'Preview' → new in-app preview screen loads with paper-styled mock (header band/logo, BILL TO, invoice meta grid, item table, totals). Verify plan-managed invoice shows the plan manager block.\n3) In the preview screen tap Share PDF → PDF downloads AND opens (no more 401→corrupt PDF).\n4) Invoice new/edit: each line item shows Start Time + End Time inputs but NO per-item Service Date. Typing 0900 into start time auto-formats to 09:00.\n5) Planner + new plan modal: Start + End inputs, both auto-format. When both filled, a 'Shift duration: Xh Ym' hint appears. Save → task row shows '09:00 – 17:00 · 8h · location'.\n6) Business Settings: edit any field → save button reveals; tap Save → green 'Saved' badge briefly, button hides. Edit again → button reappears.\n7) Shifts tab (no active shift): footer shows 'Save to planner' + 'Start now' buttons. 'Save to planner' saves as planned for today. No Schedule-for date picker visible."

## ── Iteration 35: Security Audit Fixes (2026-07-27) ──
## backend:
##   - task: "SEC-001 CRITICAL: /api/auth/forgot no longer leaks reset_token in response body"
##     implemented: true
##     working: true
##     file: "backend/server.py"
##     stuck_count: 0
##     priority: "critical"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Reset token now only stored server-side and logged with a short prefix so an operator can retrieve it manually until an email provider (Resend/SendGrid) is integrated. Response is always {'sent': true} whether or not the email exists (prevents both token disclosure AND user enumeration). Added TTL index on password_resets.expires_at so used/expired tokens are purged."
##   - task: "SEC-002 HIGH: seeded owner password is now random/env-driven (never 'TEST_PASSWORD')"
##     implemented: true
##     working: true
##     file: "backend/server.py"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Owner seed now reads SEED_OWNER_PASSWORD env if provided; otherwise generates _secrets.token_urlsafe(18) and prints it to server logs with a change-immediately warning. Sets must_change_password=True on new seed. Existing owner accounts are NEVER re-seeded — password stays untouched (preserves Drew's active session)."
##   - task: "SEC-003 MEDIUM: /api/ndis-catalogue/import restricted to platform owner"
##     implemented: true
##     working: true
##     file: "backend/server.py"
##     stuck_count: 0
##     priority: "medium"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Endpoint now compares current user's email against PLATFORM_OWNER_EMAIL env (defaults to TEST_USER_EMAIL). Non-owners get 403; owner can still import/replace as before. Blocks the cross-tenant billing-code poisoning scenario."
##   - task: "SEC-004 MEDIUM: size caps on every base64 upload path"
##     implemented: true
##     working: true
##     file: "backend/server.py"
##     stuck_count: 0
##     priority: "medium"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "New _check_upload_size() helper. Applied to /scan-receipt, /scan-document (12 MB b64 → ~9MB image), /transcribe (32 MB b64 → ~24MB audio), POST/PATCH /clients (photo_base64), PUT /settings (logo_base64), POST /receipts (image_base64), POST /credentials, POST /client-documents. Rejects with HTTP 413 BEFORE base64 decode → memory-safe."
##   - task: "P3 hardening: password_resets TTL + retention bump for client_documents"
##     implemented: true
##     working: true
##     file: "backend/server.py"
##     stuck_count: 0
##     priority: "low"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "TTL index on password_resets.expires_at; list_client_docs bumped to 20k for 7-year retention consistency."
## frontend:
##   - task: "Forgot password flow: gracefully handles missing reset_token"
##     implemented: true
##     working: true
##     file: "frontend/app/(auth)/forgot.tsx, frontend/src/i18n/locales/en.json"
##     stuck_count: 0
##     priority: "medium"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Existing conditional `if (res?.reset_token)` already handles both cases — dev-token display is skipped, the reset stage still opens with the manual token paste input. Copy updated so users know the token was written to logs when email provider isn't set up."
## agent_communication:
##     -agent: "main"
##     -message: "Please verify the security audit fixes end-to-end. Credentials: TEST_USER_EMAIL (existing password). Focus areas:\n\n**BACKEND — critical fixes (SEC-001..004)**\n1. POST /api/auth/forgot with email=TEST_USER_EMAIL → response body must NOT contain a 'reset_token' key. Only {'sent': true}. Server logs should show a warning with the token prefix.\n2. POST /api/auth/forgot with unknown email → same {'sent': true} (user enumeration prevented).\n3. Confirm /api/auth/reset still works end-to-end: retrieve token from backend logs, POST /api/auth/reset with that token + new password → 200. Old sessions should be invalidated (existing Bearer token → 401 after reset). NOTE: after this test, please reset the password back to Drew's known one so his session works.\n4. Seed test: search for the exact string _hash_pw(\"TEST_PASSWORD\") in server.py — must be ABSENT. Only test the code, do not touch the running DB.\n5. Non-owner POST /api/ndis-catalogue/import → 403. (Create a second dummy user OR verify with the code path — must return 'Catalogue imports are restricted to the platform owner.')\n6. Upload size guard: POST /api/scan-receipt with an image_base64 > 12MB → 413. POST /api/transcribe with audio_base64 > 32MB → 413. Should return 413 BEFORE base64 decode.\n\n**REGRESSION**\n7. Login flow still works for Drew.\n8. Creating a client + creating an invoice + generating a PDF all still return 200 (no regressions from the new upload guards on normal-sized inputs).\n9. GET /api/invoices/{id}/pdf still returns application/pdf and stays org-scoped (regression check).\n\n**FRONTEND**\n10. Login → tap 'Forgot password' → enter TEST_USER_EMAIL → submit → the 'reset stage' UI appears with a manual token input (no auto-populated dev token this time). Copy should be the generic sentMsg text.\n\nIf ANY test fails, hand back the exact failing route + payload and I'll patch. Please do NOT restore weak seeds or leak-token behaviour."

## ── Iteration 36: Client privacy + shift template picker + description overwrite + past-shift delete + client favourite codes (2026-07-27) ──
## frontend:
##   - task: "PRIVACY: Client list subtitle never exposes diagnosis/behaviours/condition"
##     implemented: true
##     working: true
##     file: "frontend/app/(tabs)/clients.tsx"
##     stuck_count: 0
##     priority: "critical"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Root cause: subtitle was `[item.condition, age].filter(Boolean).join(' · ')`. Ben's DB record had a legacy `condition: 'Autism'` field left over from an older app version, which surfaced on the list card. Rewrote subtitle to only concat NDIS number, age (from DOB) and suburb (from address_suburb or address parsing). Diagnosis/behaviours/notes now stay inside the participant profile."
##   - task: "Shift template editor: inline-editable prefill lines + smart catalogue picker"
##     implemented: true
##     working: true
##     file: "frontend/src/components/ShiftTemplateEditor.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Every billing item row is now a fully editable card with 4 inputs (Code, Qty, Rate, Description). New two-button footer: 'Pick from catalogue' opens the same picker used on invoices (search box + FILTER_TAGS chips like Self-Care, Community Access, Household Tasks, Transport, Therapy) with a scrollable FlatList; tap a row → line is added and sheet closes. 'Add manual line' inserts a blank editable row. Also surfaces this participant's `accepted_plan_codes` as one-tap chips above the item list. Old iCode/iDesc/iRate/iQty states + addItem() removed."
##   - task: "Invoice: description auto-updates when the picked code changes"
##     implemented: true
##     working: true
##     file: "frontend/app/(tabs)/invoice/new.tsx"
##     stuck_count: 0
##     priority: "medium"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Old behaviour: `description: cur.description || desc` — description only filled when empty. Flipped to `description: desc` so re-picking a different code always refreshes the description text to match. Same fix applied to applyAiCode."
##   - task: "Invoice: one-tap 'Suggested for participant' chips (from accepted_plan_codes)"
##     implemented: true
##     working: true
##     file: "frontend/app/(tabs)/invoice/new.tsx"
##     stuck_count: 0
##     priority: "medium"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Picker now surfaces the currently-selected client's accepted_plan_codes as a highlighted section at the very top (before global Favourites), with a person-circle icon so it's visually distinct. Each suggestion is a one-tap add — closes the sheet and populates the line item with code/description/rate."
##   - task: "Past shifts: delete button with confirm dialog"
##     implemented: true
##     working: true
##     file: "frontend/app/(tabs)/shift.tsx"
##     stuck_count: 0
##     priority: "medium"
##     needs_retesting: true
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Each row in the collapsible 'Past shifts' section gets a trash icon that opens confirmAction → tapping Delete calls api.deleteShift(id). Backend delete endpoint already existed. Copy explains that linked invoices remain on record. On success shows 'Shift deleted' toast + reloads."
## agent_communication:
##     -agent: "main"
##     -message: "Please verify the following user-reported fixes (credentials TEST_USER_EMAIL / TEST_PASSWORD):\n\n1. PRIVACY (CRITICAL) — Open Clients tab. Verify NO participant subtitle displays 'Autism' or any diagnosis/behaviours/condition text. Ben's card in particular used to show 'Autism' because his DB record has a legacy `condition` field. Subtitle should now only show combinations of `NDIS <num>`, `<n> yrs` and `<suburb>` (whichever are set).\n2. SHIFT TEMPLATE EDITOR — Open Shifts → Templates → tap New template or edit an existing one → scroll to Billing items. Verify (a) each existing item row is fully editable inline (Code, Qty, Rate, Description text inputs), NOT just a read-only summary. (b) A 'Pick from catalogue' button opens a bottom sheet with a search box, category chips (Self-Care, Community Access, etc.), and a scrollable list of items. Tapping an item closes the sheet AND adds the item as an editable row. (c) 'Add manual line' inserts a blank editable row. (d) If the selected client has accepted_plan_codes, a chip row 'SUGGESTED FOR THIS PARTICIPANT' appears with one-tap add.\n3. INVOICE DESCRIPTION OVERWRITE — On new/edit invoice, add a line item, pick code A (description auto-fills), then re-pick a different code B → the description text should CHANGE to match code B, not keep code A's text.\n4. SUGGESTED FOR PARTICIPANT (INVOICE) — On new invoice, pick a client who has accepted_plan_codes set. Open the NDIS code picker for a line item → verify the very top section shows 'Suggested for <participant name>' with those codes as one-tap rows.\n5. PAST SHIFT DELETE — Shifts tab → expand 'Past shifts · N' section (if any ended shifts exist) → verify each row has a trash icon → tap trash → confirm dialog → tap Delete → shift is removed from the list.\n\nNo backend changes in this iteration — please skip backend regression unless a frontend flow hits an unexpected error."

## ── Iteration 37: AI Code Assistant shift attach + Scanner Document Mode + Visual Roadmap (2026-07-27) ──
## backend:
##   - task: "Visual launch roadmap PDF (landscape, timeline + donut + compliance) served via GET /api/launch-roadmap.pdf"
##     implemented: true
##     working: true
##     file: "scripts/generate_launch_roadmap.py, backend/server.py"
##     stuck_count: 0
##     priority: "low"
##     needs_retesting: false
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "Rewrote generate_launch_roadmap.py as a 2-page landscape infographic: timeline swim-lane pins (Foundation → Public Launch), progress donut (92%), category readiness bars (feature completeness, AUS data residency, APP+NDIS, 500-user security, AI, i18n, payments, offline) and a 15-item launch checklist covering AU cloud hosting, encryption, TLS, APP, 500-user scale, AI residency disclosure, Play Store + iOS TestFlight. PNG preview auto-generated via pypdfium2. Owner-only endpoint /api/launch-roadmap.pdf serves it."
## frontend:
##   - task: "AI Code Assistant: attach code to active shift (create draft if none) or existing unpaid draft"
##     implemented: true
##     working: "NA"
##     file: "frontend/app/(tabs)/assistant.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Overhauled the attach modal. openAttach() now fetches invoices + activeShift together. Explicit sections: YOUR CURRENT SHIFT (green highlight — either 'Add to current shift' if the shift already has a draft, or 'Start a draft for this shift' which calls api.createInvoice({ shift_id, client_id, items:[…] }) to create a shift-linked draft on the fly), OTHER UNPAID DRAFTS (drafts NOT linked to active shift), OR START FRESH (new invoice). Cross-verified with a real code chip in web preview — OTHER UNPAID DRAFTS + OR START FRESH sections render correctly."
##   - task: "Scan tab: Receipt / Document mode toggle + Document mode with GPT-4o Vision → client documents"
##     implemented: true
##     working: "NA"
##     file: "frontend/app/(tabs)/scan.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Added a top pill toggle (Receipt / Document) inside the camera overlay. In Document mode, capture() posts to /api/scan-document (already existed) then opens a review sheet with editable Title, Doc type chips (Service Agreement/Consent/Plan/Document), Doc date, Key parties (comma-separated) and full extracted text. Participant picker (horizontal chip row driven by GET /clients) is required before Save; save calls /api/client-documents with extracted_text/doc_date/key_parties so the record shows up in Client Detail → Documents with the sparkles icon. Camera permissions still gated the usual way."
##   - task: "i18n keys synced across 9 languages for new attach + scanner document copy"
##     implemented: true
##     working: true
##     file: "frontend/src/i18n/locales/*, scripts/translate_merge.py"
##     stuck_count: 0
##     priority: "low"
##     needs_retesting: false
##     status_history:
##         -working: true
##         -agent: "main"
##         -comment: "assistant.{attachSub,activeShiftGroup,activeShiftAdd,activeShiftCreate,activeShiftDraftLbl,activeShiftNewLbl,draftsGroup,newInvoiceGroup,addedToShift,creatingDraft} + scan.{docScannerTitle,docScannerHint,modeReceipt,modeDocument,readingDoc,readErrorDoc,confirmDocTitle,docTitle,docType,docDate,docParties,docExtracted,docClient,docPickClient,docNoClients,docSave,docSaved,docType*} — all 9 languages OK via translate_merge.py."
## agent_communication:
##     -agent: "main"
##     -message: "Please validate these two new frontend flows end-to-end. Credentials: TEST_USER_EMAIL / TEST_PASSWORD.\n\nFRONTEND — AI CODE ASSISTANT ATTACH MODAL:\n1) Open Command → Try the Code Assistant. Tap any suggestion chip (e.g. a Personal Care question). Wait for the reply + code-chip.\n2) Tap the Invoice button on the code chip → the attach sheet opens.\n3) VERIFY three sections render in this order (only 'YOUR CURRENT SHIFT' is conditional on there being an active shift):\n   • YOUR CURRENT SHIFT (green, testID attach-active-shift) — this row must show 'Add to current shift' (if a draft already exists) OR 'Start a draft for this shift'. Tapping should add the item to the existing shift draft, OR create a brand-new draft invoice with shift_id set and add the item.\n   • OTHER UNPAID DRAFTS — each row testID attach-inv-<id>. Tapping should add the item and open a confirm alert with 'View invoice'.\n   • OR START FRESH — 'New invoice' (testID attach-new-invoice) navigates to /invoice/new with the code preset.\n4) If NO active shift, the YOUR CURRENT SHIFT section must be hidden.\n\nFRONTEND — SCAN TAB DOCUMENT MODE:\n5) Open Scan tab. Grant camera perms if requested. Verify the pill toggle at top: Receipt (default, testID mode-receipt) and Document (testID mode-document).\n6) Tap Document — title changes to 'Document Scanner', hint changes, shutter icon changes.\n7) Tap the shutter (testID capture-btn). Once the document sheet opens, verify: Title input, doc-type chips (testID doctype-Service Agreement/Consent/Plan/Document), Doc date input, Key parties (comma-separated), full Extracted text multiline input, then a participant chip row (testID doc-client-<id>).\n8) Pick a participant → save-doc-btn becomes enabled. Tap it → 'Document saved to <name> ✓' toast. Then open Clients → that participant → Documents section should show the new entry with the sparkles ✨ icon (extracted_text present).\n\nBACKEND — light regression only (existing endpoints):\n9) POST /api/scan-document with a small dummy base64 image should still return {success, data: {title, doc_type, date, key_parties, full_text, confidence}}.\n10) POST /api/client-documents with {client_id, title, type, extracted_text, doc_date, key_parties} → 200 with saved doc; GET /api/client-documents?client_id=<id> returns it.\n\nSkip: heavy backend regression (no server.py changes in this iteration beyond the earlier iteration 35/36 patches which are already covered)."



##
## ─── Iteration 37 — Testing Agent (T1) results ───────────────────────────────
##     -agent: "testing"
##     -date: "2026-07-27"
##     -message: "Iteration 37 validated end-to-end. See /app/test_reports/iteration_37.json and /app/test_reports/pytest/iteration37_results.xml.
##
##       FRONTEND — AI Code Assistant attach modal (assistant.tsx):
##         • Logged in as TEST_USER_EMAIL, navigated Command → Try the Code Assistant.
##         • Sent 'morning shower and dressing support at home on a Saturday for 1 hour' → GPT-4o returned code 01_002_0107_1_1 with a use-code-* chip.
##         • Tapped the code chip → attach-sheet opened. Verified all 3 sections + Cancel.
##         • WITH ACTIVE SHIFT (started one via POST /api/shifts/start for cleanup afterwards): YOUR CURRENT SHIFT row rendered green with 'Add to current shift' + 'Adds to draft INV-1021 · TEST_iter29 FE NoK'. Tapping it added the item to INV-1021 (confirmed via GET /api/invoices/<id>). Sheet closed correctly.
##         • WITHOUT ACTIVE SHIFT: the attach-active-shift row was correctly HIDDEN.
##         • OTHER UNPAID DRAFTS listed 4 drafts (INV-1010, 1017, 1018, 1019) — the shift-linked INV-1021 correctly EXCLUDED.
##         • attach-new-invoice and attach-cancel present and working.
##
##       FRONTEND — Scan Document mode (scan.tsx):
##         • Granted camera permission via Playwright context (Chromium fake camera).
##         • scan-screen loaded with pill toggle: mode-receipt (default) and mode-document — both wired.
##         • Tapping Document flipped header to 'Document Scanner' + hint 'Photograph an agreement, plan or consent form'. capture-btn switched to document-text icon.
##         • Full review-sheet UI (field-doc-title / doctype-* / field-doc-date / field-doc-parties / field-doc-extracted / doc-client-<id> / save-doc-btn) is wired in source (verified via code review — end-to-end capture requires a real image feed, not fake WebRTC, so validated code path + no crash + toggle reachability).
##         • No red screen, no console errors during the flow.
##
##       BACKEND — /app/backend/tests/backend_iteration37_test.py (3/3 PASS in 2.7s):
##         • TestScanDocument: POST /api/scan-document with a 32x32 PIL JPEG → 200 {success:true, data:{title, doc_type, date, key_parties, full_text, confidence}} — all keys present, types validated.
##         • TestClientDocuments: created a TEST_iter37 client, POST /api/client-documents with extracted_text + doc_date + key_parties[] + file_base64 → 200 with all fields echoed and no _id leak; GET /api/client-documents?client_id=<id> returns the doc with the same fields intact.
##         • TestLaunchRoadmapSanity: GET /api/launch-roadmap.pdf returned 200 application/pdf starting with %PDF for the owner.
##
##       No bugs found. All requested flows work as designed. Success rate: backend 100% (3/3), frontend 100% (attach modal all 3 branches + scan document toggle verified live).
##       Cleanup: active shift was ended via PATCH /api/shifts/{id}/end after testing. TEST_iter37 client is auto-deleted by fixture teardown."

## ── Iteration 38: Unified shift picker + Compliance FAQs + Multi-date invoicing (2026-07-30) ──
## backend:
##   - task: "Assistant system prompt widened to cover ABN sole-trader compliance"
##     file: "backend/server.py::_build_assistant_system"
##     working: "NA"
##     needs_retesting: true
##   - task: "PDF header multi-date awareness — 'Service dates: X – Y (N dates)' when items span >1 date"
##     file: "backend/server.py (PDF renderer around line 1861)"
##     working: "NA"
##     needs_retesting: true
## frontend:
##   - task: "Planner unified picker: shift templates + planned shifts in one modal"
##     file: "frontend/app/(tabs)/planner.tsx"
##     working: "NA"
##     needs_retesting: true
##   - task: "Assistant FAQ library expanded: Sole Trader Setup + Safety & First Aid + Incidents & Reporting"
##     file: "frontend/src/assistantFaqs.ts, en.json (assistant.intro)"
##     working: "NA"
##     needs_retesting: true
##   - task: "Multi-date invoicing — glance summary, per-line service_date, import from past shifts"
##     file: "frontend/app/(tabs)/invoice/new.tsx"
##     working: "NA"
##     needs_retesting: true
## agent_communication:
##     -agent: "main"
##     -message: "Iteration 38 test sheet. Owner: TEST_USER_EMAIL / TEST_PASSWORD. Focus areas below."
##     -agent: "testing"
##     -message: "Iteration 38 validated end-to-end.
##
##       BACKEND — /app/backend/tests/backend_iteration38_test.py (7/7 PASS in 4s):
##         • TestAssistantCompliance: POST /api/ai/ndis-assistant with 'As an ABN sole trader, when do I need to register for GST?' → answer mentions $75,000; codes:[] (compliance-only, no crash).
##         • TestAssistantCode: POST /api/ai/ndis-assistant with 'Which code covers Saturday personal care?' → codes:[>=1 entry] with {code,name,rate,unit} — format unchanged.
##         • TestInvoicePdfMultiDate::test_multi_date_pdf_contains_service_dates_plural: created invoice with items on 2026-07-01 and 2026-07-03; GET /api/invoices/<id>/pdf contains 'Service dates:'. PASS.
##         • TestInvoicePdfMultiDate::test_single_date_pdf_contains_service_date_singular: single-date invoice PDF contains 'Service date:' (singular) and NOT 'Service dates:'. PASS.
##         • TestShiftEndpointsSanity: GET /api/shift-templates 200 (list); GET /api/shifts?include_ended=true 200 (list); POST /api/shift-templates creates a template that appears in the list. All PASS.
##
##       FRONTEND — Planner unified picker (planner.tsx):
##         • Seeded 1 shift-template (TEST_iter38 Wed AM run, 09:00-13:00, client TEST_iter29 FE NoK) via POST /api/shift-templates.
##         • Login → Planner tab → tapped add-task-fab → in the modal tapped attach-saved-shift.
##         • Modal titled 'Attach a shift or template' opened with:
##             - Section 'REUSABLE SHIFT TEMPLATES' with pick-template-<id> row + blue 'TEMPLATE' chip. ✓
##             - Section 'PLANNED SHIFTS' rendered (empty — no planned shifts in DB, correct empty-state text).
##         • Tapping pick-template-<id> closed modal and pre-filled parent form: title='TEST_iter38 Wed AM run', start=09:00, end=13:00, participant chip lit with 'TEST_iter29 FE NoK'. ✓
##         • Crucially the 'Saved shift / template' chip stayed un-highlighted (linkedShiftId remained empty — templates are blueprints, not shift records). ✓
##
##       FRONTEND — Code Assistant expanded scope (assistant.tsx):
##         • All 3 new category chips visible: faq-cat-sole_trader_compliance / faq-cat-safety_first_aid / faq-cat-incidents_reporting. (Note: actual testID prefix is 'faq-cat-' — the review request said 'cat-'; harmless.)
##         • Sent 'As an ABN sole trader, when do I need to register for GST?' → reply in plain English, mentioned '$75,000', NO NDIS code chips rendered (codes:[]). ✓
##
##       FRONTEND — Multi-date invoicing (invoice/new.tsx):
##         • Attached participant → picked NDIS code 01_011_0107_1_1 → rate 70.23, 09:00-13:00, item-servicedate-0-0=01/07/2026.
##             - glance-dates='1 date', glance-items='1', glance-hours='4.0 hrs', glance-total='$70.23', glance-range='1 Jul'. ✓
##         • Added second item → rate 70.23, 10:00-12:00, item-servicedate-0-1=03/07/2026.
##             - glance-dates='2 date' (MINOR i18n plural bug — should say '2 dates'), glance-items='2', glance-hours='6.0 hrs', glance-total='$140.46', glance-range='1 Jul – 3 Jul'. ✓
##         • Tapped import-shifts-btn-0 → sheet opened with 3 real ended shifts listed (import-shift-<id>). Import path is wired.
##         • Save-as-draft succeeded — created INV-1028. Downloaded via /api/invoices/<id>/pdf and pdfminer confirmed the header 'Service dates: 01/07/2026 – 03/07/2026 (2 dates)' and per-line captions 'Delivered: 01/07/2026 · 09:00–13:00 · GST-free' and 'Delivered: 03/07/2026 · 10:00–12:00 · GST-free'. ✓
##
##       Bugs found:
##         • LOW / cosmetic — glance-dates shows '2 date' (singular) for 2+ dates. Root cause: i18next in this app isn't picking the '_plural' key. Fix: set compatibilityJSON:'v3' on the i18n init, or explicit ternary in invoice/new.tsx:588. Everything else works correctly.
##       Cleanup: template + planned task were deleted after testing. Draft INV-1028 left in place for main-agent PDF inspection.
##       Success rate: backend 100% (7/7), frontend 100% functional (1 cosmetic plural bug)."




##     -agent: "testing"
##     -message: "Iteration 40 focused retest of the two shipped fixes — ALL PASS.
##
##       BACKEND — /app/backend/tests/backend_iteration40_test.py (11/11 PASS in 2.3s):
##         • TestInvoicePdfDeliveredDates (6 tests): created a 3-item invoice via POST /api/invoices with
##           items[0].service_date='2026-08-01', items[1].service_date='2026-08-03', items[2].service_date=''
##           and invoice-level service_date='2026-08-15'. GET /api/invoices/<id>/pdf → pdfminer:
##             - Header contains NEITHER 'Service date:' NOR 'Service dates:' (both removed). ✓
##             - PDF contains 'Delivered: 01/08/2026' (line A). ✓
##             - PDF contains 'Delivered: 03/08/2026' (line B). ✓
##             - PDF contains 'Delivered: 15/08/2026' (line C, empty per-line date fell back to invoice-level). ✓
##             - Exactly 3 'Delivered: dd/mm/yyyy' captions rendered (no dedupe/over-render). ✓
##             - Persisted line data on GET matches what was POSTed. ✓
##         • TestInvoicePdfBackwardCompatFallback: scanned org's existing invoices for a legacy row with
##           empty per-line dates + populated invoice-level date; auto-skipped (no legacy row matched — this
##           org's older invoices already carry per-line dates or lack an invoice-level date). Fallback path
##           is fully covered by the Line-C case in TestInvoicePdfDeliveredDates. ✓
##         • TestSessionExpiryHttpBehaviour (4 tests):
##             - GET /api/invoices with 'Bearer thisTokenIsFake123' → 401 with body containing 'Invalid session'. ✓
##             - GET /api/invoices with 'Bearer ' (empty) → 401 with body containing 'Not authenticated'. ✓
##             - GET /api/invoices with no Authorization header → 401 with a FE-marker match. ✓
##             - Login → POST /api/auth/logout → same bearer reused on GET /api/invoices → 401 'Invalid session'. ✓
##           All 4 FE regex markers ('invalid session', 'session expired', 'not authenticated', 'user not found')
##           are matched in the response body strings so handleSessionError fires correctly.
##
##       FRONTEND — mobile viewport 390x844, TEST_USER_EMAIL / TEST_PASSWORD:
##         • F1 — /invoice/preview/<id> for the 3-item test invoice INV-1042:
##             - INVOICE metadata column shows Issued / Sent / Due / Status / Plan type; NO 'Service date' MetaRow. ✓
##             - Each line's description shows its own 'Delivered: dd/mm/yyyy' caption
##               (01/08/2026, 03/08/2026, 15/08/2026 — the third one via invoice-level fallback). ✓
##             - preview-share-btn AND preview-download-btn present and enabled; totals unchanged. ✓
##         • F2 — Session-expiry graceful UX:
##             - Logged in via UI, navigated to Invoices tab (invoices-screen loaded).
##             - Grabbed ndis_token from localStorage, invalidated it server-side via POST /api/auth/logout.
##             - Purged localStorage 'cache:*' entries so the next fetch hits the network.
##             - page.reload() → app cleared ndis_token (post-check: null in localStorage), redirected to
##               /(auth)/login (URL: .../login), login-email input visible, invoices-screen removed from DOM.
##             - NO raw error stack shown to the user. Clean redirect. ✓
##
##       Cleanup: test invoice INV-1042 deleted via DELETE /api/invoices/<id> in both pytest teardown and
##       browser script. Zero residual test data.
##
##       Bugs found: none. Both fixes function exactly as designed at API, UI, and integration layers.
##       Success rate: backend 100% (11/11), frontend 100% (2/2 flows)."
