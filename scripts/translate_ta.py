"""Retry Tamil-only translation (ta.json) with up to 3 attempts."""
import os, json, asyncio
from pathlib import Path
from dotenv import load_dotenv

BACKEND = Path("/app/backend")
load_dotenv(BACKEND / ".env")
from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: E402

KEY = os.environ.get("EMERGENT_LLM_KEY", "")
LOCALES = Path("/app/frontend/src/i18n/locales")
EN = json.loads((LOCALES / "en.json").read_text())
FLAT_EN = json.dumps(EN, ensure_ascii=False, indent=2)

SYSTEM = (
    "You are a professional localisation translator for an Australian NDIS mobile app for disability "
    "support workers. Translate UI strings into Tamil. Rules:\n"
    "- Return ONLY a JSON object with the EXACT same structure and keys as the input; translate the VALUES only.\n"
    "- Keep it natural and concise for buttons/labels.\n"
    "- Do NOT translate: 'NDIS', 'PIN', 'CSV', 'Google', 'Face/Touch ID', brand names.\n"
    "- Keep placeholders like {{count}} and {{date}} and trailing punctuation.\n"
    "- CRITICAL: escape any double quotes inside string values so the JSON is strictly valid.\n"
    "- Output strictly valid JSON, no markdown, no commentary."
)


async def main():
    for attempt in range(1, 4):
        try:
            chat = LlmChat(api_key=KEY, session_id=f"i18n-ta-{attempt}", system_message=SYSTEM).with_model("openai", "gpt-4o")
            resp = await chat.send_message(UserMessage(text="Translate the VALUES of this JSON. Return the same JSON structure:\n\n" + FLAT_EN))
            text = (resp if isinstance(resp, str) else str(resp)).strip()
            if text.startswith("```"):
                text = text.strip("`")
                if text.lower().startswith("json"):
                    text = text[4:]
            s, e = text.find("{"), text.rfind("}")
            data = json.loads(text[s:e + 1])
            (LOCALES / "ta.json").write_text(json.dumps(data, ensure_ascii=False, indent=2))
            print(f"OK ta attempt {attempt} -> {len(json.dumps(data))} bytes")
            return
        except Exception as ex:
            print(f"FAIL ta attempt {attempt}: {ex}")
    print("ta: all attempts failed")


if __name__ == "__main__":
    asyncio.run(main())
