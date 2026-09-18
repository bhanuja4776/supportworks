"""Translate ONLY the keys Tamil (ta.json) is missing, then deep-merge into ta.json.
Smaller payload = far less chance of malformed JSON from the model."""
import os, json, asyncio, re
from pathlib import Path
from dotenv import load_dotenv

BACKEND = Path("/app/backend")
load_dotenv(BACKEND / ".env")
from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: E402

KEY = os.environ.get("EMERGENT_LLM_KEY", "")
LOCALES = Path("/app/frontend/src/i18n/locales")
EN = json.loads((LOCALES / "en.json").read_text())
TA = json.loads((LOCALES / "ta.json").read_text())


def missing_subset(en, ta):
    out = {}
    for k, v in en.items():
        if isinstance(v, dict):
            sub = missing_subset(v, ta.get(k, {}) if isinstance(ta.get(k), dict) else {})
            if sub:
                out[k] = sub
        elif k not in (ta if isinstance(ta, dict) else {}):
            out[k] = v
    return out


def deep_merge(dst, src):
    for k, v in src.items():
        if isinstance(v, dict):
            deep_merge(dst.setdefault(k, {}), v)
        else:
            dst[k] = v


SUBSET = missing_subset(EN, TA)
PAYLOAD = json.dumps(SUBSET, ensure_ascii=False, indent=2)

SYSTEM = (
    "You are a professional localisation translator for an Australian NDIS mobile app for disability "
    "support workers. Translate the string VALUES into Tamil. Rules:\n"
    "- Return ONLY a JSON object with the EXACT same structure and keys as the input; translate VALUES only.\n"
    "- Keep it concise for buttons/labels.\n"
    "- Do NOT translate: 'NDIS','PIN','CSV','GST','BAS','ABN','BSB','Google','Woolworths', brand names, INV numbers.\n"
    "- Keep placeholders like {{count}},{{amount}},{{date}},{{number}},{{n}} EXACTLY as-is.\n"
    "- Never put a raw newline/tab inside a value; escape any double quotes. Output strictly valid JSON, no markdown."
)


async def main():
    if not SUBSET:
        print("ta already complete")
        return
    total = PAYLOAD.count(":")
    print(f"ta missing ~{total} leaf values; translating subset ({len(PAYLOAD)} chars)")
    for attempt in range(1, 6):
        try:
            chat = LlmChat(api_key=KEY, session_id=f"ta-sub-{attempt}", system_message=SYSTEM).with_model("openai", "gpt-4o")
            resp = await chat.send_message(UserMessage(text="Translate the VALUES of this JSON, same structure:\n\n" + PAYLOAD))
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
                data = json.loads(re.sub(r"[\x00-\x1f]+", " ", raw), strict=False)
            deep_merge(TA, data)
            (LOCALES / "ta.json").write_text(json.dumps(TA, ensure_ascii=False, indent=2))
            print(f"OK ta subset attempt {attempt} merged")
            return
        except Exception as ex:
            print(f"FAIL ta subset attempt {attempt}: {ex}")
    print("ta subset: all attempts failed")


if __name__ == "__main__":
    asyncio.run(main())
