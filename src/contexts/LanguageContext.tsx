"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Language, t as translate, TranslationKey, tStatus, tProduct, tRole } from "@/lib/translations";
import { fetchPreferences, setPreference, getCachedPreference } from "@/lib/userPreferences";

const PREF_LANG = "lang";

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  tStatus: (status: string) => string;
  tProduct: (category: string) => string;
  tRole: (role: string) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Initial state MUST match server render (en). Local cache is applied in
  // useEffect — anything client-only here breaks hydration.
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    // Apply cached lang synchronously on mount (client-only) to avoid the
    // English-flash if the user previously selected Hindi.
    const cached = getCachedPreference<Language>(PREF_LANG, "en");
    if (cached === "hi" || cached === "en") setLangState(cached);

    fetchPreferences().then((prefs) => {
      let v = prefs[PREF_LANG] as Language | undefined;
      if (v !== "en" && v !== "hi") {
        // Legacy migration: pick up the old localStorage value if present
        try {
          const legacy = localStorage.getItem("lang") as Language | null;
          if (legacy === "en" || legacy === "hi") {
            v = legacy;
            setPreference(PREF_LANG, legacy);
          }
        } catch {}
      }
      if (v === "en" || v === "hi") setLangState(v);
    });
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    setPreference(PREF_LANG, newLang);
  };

  return (
    <LanguageContext.Provider
      value={{
        lang,
        setLang,
        t: (key) => translate(key, lang),
        tStatus: (status) => tStatus(status, lang),
        tProduct: (category) => tProduct(category, lang),
        tRole: (role) => tRole(role, lang),
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}
