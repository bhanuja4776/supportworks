"""Translate the English locale catalog into all target languages using GPT-4o
via the Emergent LLM key. Produces src/i18n/locales/<code>.json.

Run from backend venv:  python /app/scripts/translate_locales.py
Idempotent: re-run to refresh. Existing files are overwritten.
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
EN = json.loads((LOCALES / "en.json").read_text())

# language code -> (English name, native name)
TARGETS = {
    "th": ("Thai", "ไทย"),
    "hi": ("Hindi", "हिन्दी"),
    "pa": ("Punjabi", "ਪੰਜਾਬੀ"),
    "ta": ("Tamil", "தமிழ்"),
    "zh": ("Mandarin Chinese (Simplified)", "中文"),
    "vi": ("Vietnamese", "Tiếng Việt"),
    "ar": ("Arabic", "العربية"),
    "tl": ("Tagalog / Filipino", "Tagalog"),
}

FLAT_EN = json.dumps(EN, ensure_ascii=False, indent=2)


async def translate(code: str, eng_name: str) -> dict:
    system = (
        "You are a professional localisation translator for an Australian NDIS (National Disability "
        "Insurance Scheme) mobile app used by disability support workers. Translate UI strings into "
        f"{eng_name}. Rules:\n"
        "- Return ONLY a JSON object with the EXACT same structure and keys as the input; translate the VALUES only.\n"
        "- Keep it natural, concise and appropriate for buttons/labels in a professional app.\n"
        "- Do NOT translate: 'NDIS', 'PIN', 'CSV', 'Google', 'Face/Touch ID', brand names.\n"
        "- Keep placeholders, punctuation like '?' and trailing spaces where present.\n"
        "- Keep 'NDIS COMMAND CENTER' recognisable (you may transliterate but keep NDIS in Latin letters).\n"
        "- Output strictly valid JSON, no markdown, no commentary."
    )
    chat = LlmChat(api_key=KEY, session_id=f"i18n-{code}", system_message=system).with_model("openai", "gpt-4o")
    prompt = "Translate the VALUES of this JSON. Return the same JSON structure:\n\n" + FLAT_EN
    resp = await chat.send_message(UserMessage(text=prompt))
    text = (resp if isinstance(resp, str) else str(resp)).strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
    s, e = text.find("{"), text.rfind("}")
    return json.loads(text[s:e + 1])


async def main():
    for code, (eng, native) in TARGETS.items():
        try:
            data = await translate(code, eng)
            (LOCALES / f"{code}.json").write_text(json.dumps(data, ensure_ascii=False, indent=2))
            print(f"OK {code} ({native}) -> {len(json.dumps(data))} bytes")
        except Exception as ex:
            print(f"FAIL {code}: {ex}")


if __name__ == "__main__":
    asyncio.run(main())
