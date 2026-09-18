# Deploying CareWorker Dashboard as a website

This app was built with Expo Router, which already supports the web out of the
box (`react-native-web` is in `frontend/package.json`). The site below is
produced from the **exact same source code** as the mobile app — same
screens, same components, same styling — exported as a static bundle, plus
the existing FastAPI backend.

## What changed to make this deployable outside Emergent

The backend originally imported Emergent's private `emergentintegrations`
package (not on public PyPI) for three things: the AI assistant/scanner
(OpenAI), voice-to-text (OpenAI Whisper), and Stripe checkout. Those call
sites now use the official `openai` and `stripe` SDKs directly — same
features, but driven by your own API keys instead of Emergent's universal
key. `requirements.txt` was trimmed of the now-unused transitive packages
that came along with it (also fixed an unrelated `click`/`huggingface_hub`
version conflict that was in the original pinned list).

"Continue with Google" on **web** now goes through Firebase Authentication
(see setup below) instead of Emergent's OAuth broker. **Native** (iOS/Android
builds) still uses Emergent's broker (`auth.emergentagent.com`) unchanged —
wiring native up to real Google Sign-In needs a native rebuild (Google
Cloud OAuth client + `@react-native-google-signin` or an Expo config plugin)
and wasn't in scope here; email/password sign-in works on every platform
regardless.

## Firebase setup (Google sign-in on web)

Uses your existing Firebase project ("SupportWorks Web" app). Two things to
turn on in the Firebase console if you haven't already:

1. **Authentication → Sign-in method → Google → Enable.**
2. **Authentication → Settings → Authorized domains** — add the domain(s)
   you'll actually serve the site from (`localhost` and `*.firebaseapp.com`
   are there by default, but your production domain needs adding manually).

Then get the web app's config: **Project settings → General → Your apps →
SupportWorks Web → SDK setup and configuration → "Config"** radio button.
Fill those values into `frontend/.env`:

```
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...          # <project-id>.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=57605712273
EXPO_PUBLIC_FIREBASE_APP_ID=1:57605712273:web:c0e933d48273d346731230
```

And on the backend, set `FIREBASE_PROJECT_ID` in `backend/.env` to the same
project ID — it's used to verify the ID token the frontend sends
(`google-auth`'s `verify_firebase_token`, checked against Google's public
certs; no service account file needed).

## Email setup (forgot password)

The "forgot password" flow generates a one-hour reset code regardless of
configuration. Whether that code reaches the user by email depends on
`SMTP_HOST`/`SMTP_FROM` being set in `backend/.env`:

- **Not set** (default): the code is written to the backend log only
  (`[auth/forgot] SMTP not configured — reset token issued for ...`) so you
  can complete the flow manually during local development.
- **Set**: a real email is sent with a clickable reset link (if
  `PUBLIC_WEB_URL` is also set) and the raw code as plain text.

Any standard SMTP provider works — a Gmail account with an
[app password](https://myaccount.google.com/apppasswords), SendGrid,
Postmark, Mailgun, or your own mail server's SMTP credentials:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASSWORD=<app password, not your account password>
SMTP_FROM=you@gmail.com
PUBLIC_WEB_URL=https://your-deployed-site.example.com
```

## Environment variables

**Never create `backend/.env` or `frontend/.env` through GitHub's web
interface ("Add file" / "Create new file").** That bypasses `.gitignore`
entirely and commits real secrets straight into git history — recoverable
by anyone with repo access forever, even after you delete the file in a
later commit. If a real secret (an API key, not a public-by-design value
like a Firebase web `apiKey`) ever ends up in a commit, rotate it — deleting
the file isn't enough. Only ever set these locally (or as environment
variables in whatever platform you deploy to) — never through a commit.

Copy the examples and fill in real values:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

| Variable | Where | Required for |
|---|---|---|
| `MONGO_URL`, `DB_NAME` | backend | everything (core data) |
| `OPENAI_API_KEY` | backend | AI receipt/document scanner, voice-to-text, NDIS Code & App Help chat assistants |
| `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET` | backend | Membership/billing checkout |
| `FIREBASE_PROJECT_ID` | backend | verifying Google sign-in tokens from the web app |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | backend | actually sending the "forgot password" email (without these the reset code is only written to the server log) |
| `PUBLIC_WEB_URL` | backend | builds a clickable link in the reset email (optional — the email always includes the raw code too) |
| `EXPO_PUBLIC_BACKEND_URL` | frontend | pointing the website at your backend (baked in at build time — rebuild after changing it) |
| `EXPO_PUBLIC_FIREBASE_*` | frontend | Google sign-in on web (baked in at build time) |

Any feature whose key is left blank fails gracefully with a clear error
from that one endpoint; the rest of the app keeps working.

## Run it locally with Docker

```bash
cp backend/.env.example backend/.env   # fill in your keys
docker compose up --build
```

- Website: http://localhost:8080
- API: http://localhost:8001
- Mongo: localhost:27017 (persisted in a named volume)

## Deploying for real

Pick any combination — the pieces are independent:

**Backend (FastAPI)**
- Any container host that takes a Dockerfile: Render, Railway, Fly.io, a
  plain VPS with `docker run`. Point `MONGO_URL` at a managed Mongo (e.g.
  MongoDB Atlas free tier) instead of a local container in production.
- `docker build -t careworker-api ./backend`

**Frontend (static site)**
The web export is just static files — host it anywhere that serves static
sites: Vercel, Netlify, Cloudflare Pages, S3+CloudFront, or the bundled
nginx Docker image.
```bash
cd frontend
EXPO_PUBLIC_BACKEND_URL=https://your-backend-domain yarn install && npx expo export -p web
# → static site in frontend/dist/, upload as-is to your static host
```
Remember: `EXPO_PUBLIC_BACKEND_URL` is baked into the JS bundle at build
time, not read at runtime — set it correctly *before* running the export,
and re-run the export whenever it changes.

**Stripe webhook:** once the backend has a public URL, create a webhook
endpoint in the Stripe dashboard pointing at
`https://your-backend-domain/api/webhook/stripe` and put its signing secret
in `STRIPE_WEBHOOK_SECRET`.

## Rebuilding after code changes

```bash
cd frontend && npx expo export -p web   # regenerates dist/
```
or just `docker compose up --build` to rebuild both images.
