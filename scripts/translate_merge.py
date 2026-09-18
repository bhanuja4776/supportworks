"""Translate ONLY a subset of NEW English keys into every locale and deep-merge
them into the existing locale files (does NOT retranslate everything — budget friendly).

Edit NEW_KEYS below to the fragment of en.json you added, then run:
  cd /app/backend && python /app/scripts/translate_merge.py
"""
import os
import json
import asyncio
from pathlib import Path
from dotenv import load_dotenv

BACKEND = Path("/app/backend")
load_dotenv(BACKEND / ".env")
from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: E402

KEY = os.environ.get("EMERGENT_LLM_KEY", "")
LOCALES = Path("/app/frontend/src/i18n/locales")

TARGETS = {
    "th": "Thai", "hi": "Hindi", "pa": "Punjabi", "ta": "Tamil",
    "zh": "Mandarin Chinese (Simplified)", "vi": "Vietnamese",
    "ar": "Arabic", "tl": "Tagalog / Filipino",
}

# Only the newly-added keys (must mirror the structure added to en.json).
NEW_KEYS = {
    "invoiceDetail": {
        "sendAndMark": "Send & mark unpaid",
        "invoiceSent": "Invoice sent · status set to Unpaid",
        "statusPickTitle": "Change invoice status",
        "statusPickSub": "Set the status for {{number}}",
        "statusCurrent": "current",
        "statusDraft": "DRAFT — add items & finalise",
        "statusUnpaid": "UNPAID — awaiting payment",
        "statusPaid": "PAID — settled",
        "statusVoid": "VOID — cancelled",
        "statusUpdated": "Status updated ✓"
    }
}


def deep_merge(base: dict, extra: dict) -> dict:
    for k, v in extra.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            deep_merge(base[k], v)
        else:
            base[k] = v
    return base


async def translate(code: str, eng_name: str) -> dict:
    system = (
        "You are a professional localisation translator for an Australian NDIS mobile app used by "
        f"disability support workers. Translate UI strings into {eng_name}. Rules:\n"
        "- Return ONLY a JSON object with the EXACT same structure and keys as the input; translate VALUES only.\n"
        "- Keep it natural and concise for buttons/labels.\n"
        "- Do NOT translate: 'NDIS', 'PIN', 'CSV', 'Google', brand names.\n"
        "- Keep placeholders like {{name}}, {{done}}, {{total}} EXACTLY as-is.\n"
        "- Output strictly valid JSON, no markdown, no commentary."
    )
    chat = LlmChat(api_key=KEY, session_id=f"i18n-merge-{code}", system_message=system).with_model("openai", "gpt-4o")
    prompt = "Translate the VALUES of this JSON, keep structure:\n\n" + json.dumps(NEW_KEYS, ensure_ascii=False, indent=2)
    resp = await chat.send_message(UserMessage(text=prompt))
    text = (resp if isinstance(resp, str) else str(resp)).strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
    s, e = text.find("{"), text.rfind("}")
    return json.loads(text[s:e + 1])


async def main():
    # English first (source of truth)
    en_path = LOCALES / "en.json"
    en = json.loads(en_path.read_text())
    deep_merge(en, NEW_KEYS)
    en_path.write_text(json.dumps(en, ensure_ascii=False, indent=2))
    print("OK en (merged)")

    for code, eng in TARGETS.items():
        try:
            tr = await translate(code, eng)
            p = LOCALES / f"{code}.json"
            data = json.loads(p.read_text())
            deep_merge(data, tr)
            p.write_text(json.dumps(data, ensure_ascii=False, indent=2))
            print(f"OK {code} (merged)")
        except Exception as ex:
            print(f"FAIL {code}: {ex}")


if __name__ == "__main__":
    asyncio.run(main())
