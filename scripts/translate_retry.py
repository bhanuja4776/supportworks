"""Retry translation for specific locales with lenient JSON parsing (strict=False)."""
import os, json, asyncio, re
from pathlib import Path
from dotenv import load_dotenv

BACKEND = Path("/app/backend")
load_dotenv(BACKEND / ".env")
from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: E402

KEY = os.environ.get("EMERGENT_LLM_KEY", "")
LOCALES = Path("/app/frontend/src/i18n/locales")
EN = json.loads((LOCALES / "en.json").read_text())
FLAT_EN = json.dumps(EN, ensure_ascii=False, indent=2)

TARGETS = {"ta": "Tamil", "ar": "Arabic", "tl": "Tagalog"}


def system_for(name):
    return (
        "You are a professional localisation translator for an Australian NDIS mobile app for disability "
        f"support workers. Translate UI string VALUES into {name}. Rules:\n"
        "- Return ONLY a JSON object with the EXACT same structure and keys as the input; translate VALUES only.\n"
        "- Keep it natural and concise for buttons/labels.\n"
        "- Do NOT translate: 'NDIS', 'PIN', 'CSV', 'Google', 'Face/Touch ID', 'BAS', 'GST', 'ABN', 'BSB', brand names.\n"
        "- Keep placeholders like {{count}}, {{days}}, {{date}}, {{name}}, {{amount}} EXACTLY as-is.\n"
        "- CRITICAL: output must be strictly valid single-line JSON strings; never put a raw newline or tab inside a value.\n"
        "- Escape any double quotes inside values. No markdown, no commentary."
    )


async def run(code, name):
    for attempt in range(1, 5):
        try:
            chat = LlmChat(api_key=KEY, session_id=f"i18n-{code}-{attempt}", system_message=system_for(name)).with_model("openai", "gpt-4o")
            resp = await chat.send_message(UserMessage(text="Translate the VALUES of this JSON. Return the same JSON structure:\n\n" + FLAT_EN))
            text = (resp if isinstance(resp, str) else str(resp)).strip()
            if text.startswith("```"):
                text = text.strip("`")
                if text.lower().startswith("json"):
                    text = text[4:]
            s, e = text.find("{"), text.rfind("}")
            raw = text[s:e + 1]
            try:
                data = json.loads(raw, strict=False)
            except Exception:
                # last resort: collapse raw control chars inside the blob
                data = json.loads(re.sub(r"[\x00-\x1f]+", " ", raw), strict=False)
            (LOCALES / f"{code}.json").write_text(json.dumps(data, ensure_ascii=False, indent=2))
            print(f"OK {code} attempt {attempt} -> {len(json.dumps(data))} bytes")
            return
        except Exception as ex:
            print(f"FAIL {code} attempt {attempt}: {ex}")
    print(f"{code}: all attempts failed")


async def main():
    for code, name in TARGETS.items():
        await run(code, name)


if __name__ == "__main__":
    asyncio.run(main())
