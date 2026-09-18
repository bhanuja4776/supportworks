import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";

import en from "./locales/en.json";
import th from "./locales/th.json";
import hi from "./locales/hi.json";
import pa from "./locales/pa.json";
import ta from "./locales/ta.json";
import zh from "./locales/zh.json";
import vi from "./locales/vi.json";
import ar from "./locales/ar.json";
import tl from "./locales/tl.json";

export const STORAGE_KEY = "ndis_lang";

export type LangCode = "en" | "th" | "hi" | "pa" | "ta" | "zh" | "vi" | "ar" | "tl";

export const LANGUAGES: { code: LangCode; label: string; native: string; rtl?: boolean; community?: boolean }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "th", label: "Thai", native: "ไทย", community: true },
  { code: "hi", label: "Hindi", native: "हिन्दी", community: true },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ", community: true },
  { code: "ta", label: "Tamil", native: "தமிழ்", community: true },
  { code: "zh", label: "Mandarin", native: "中文", community: true },
  { code: "vi", label: "Vietnamese", native: "Tiếng Việt", community: true },
  { code: "ar", label: "Arabic", native: "العربية", rtl: true, community: true },
  { code: "tl", label: "Tagalog", native: "Tagalog", community: true },
];

const resources = {
  en: { translation: en },
  th: { translation: th },
  hi: { translation: hi },
  pa: { translation: pa },
  ta: { translation: ta },
  zh: { translation: zh },
  vi: { translation: vi },
  ar: { translation: ar },
  tl: { translation: tl },
};

function deviceLang(): LangCode {
  try {
    const codes = getLocales().map((l) => l.languageCode || "");
    const supported = LANGUAGES.map((l) => l.code);
    // Chinese variants (zh-Hans, zh-Hant, cmn) → zh
    for (const c of codes) {
      const base = c.toLowerCase().split("-")[0];
      if (base === "fil") return "tl";
      if (supported.includes(base as LangCode)) return base as LangCode;
    }
  } catch {}
  return "en";
}

i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** Load the saved language (or device default) and apply it. Call once at startup. */
export async function initLanguage() {
  try {
    const saved = (await AsyncStorage.getItem(STORAGE_KEY)) as LangCode | null;
    const lang = saved || deviceLang();
    if (lang && lang !== i18n.language) await i18n.changeLanguage(lang);
  } catch {}
}

/** Change and persist the app language. */
export async function setLanguage(code: LangCode) {
  await i18n.changeLanguage(code);
  try { await AsyncStorage.setItem(STORAGE_KEY, code); } catch {}
}

export function isRTL(code = i18n.language): boolean {
  return LANGUAGES.find((l) => l.code === code)?.rtl === true;
}

export default i18n;
