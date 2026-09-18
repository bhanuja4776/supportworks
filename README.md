# CareWorker Dashboard — NDIS Business Management App

> © 2026 Drew Kindermann. All Rights Reserved. **Proprietary & Confidential** — see [LICENSE](./LICENSE).

An all-in-one business management app for sole-trader **Disability Support Workers** in
Victoria, Australia (NDIS compliant). Built with Expo (React Native), FastAPI and MongoDB.

## Features
- Secure multi-tenant auth (email/password + optional 2FA, Google sign-in)
- Dashboard with earnings, outstanding invoices, upcoming costs & "Getting Started" checklist
- Clients (care profile, NDIS budget tracking, documents, reminders, saved notes)
- Planner / Shifts (start-shift + plan-ahead)
- Invoices (multi-participant, plan-ahead, PDF export)
- Expenses, receipts & Bank CSV reconciliation
- Today's Notes with voice-to-text, savable to a client's profile
- AI NDIS Code Assistant + App Help chatbot
- Localised into 9 languages
- 14-day free trial on signup

## Tech
- **Frontend:** Expo Router (React Native), i18next
- **Backend:** FastAPI + MongoDB (multi-tenant `org_id` isolation)
- **AI:** GPT-4o via Emergent LLM (Universal) key

## Privacy
This is a private, closed-source project. Do not share, copy, or distribute.
