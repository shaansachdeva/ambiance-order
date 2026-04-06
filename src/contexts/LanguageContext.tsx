"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Language, t as translate, TranslationKey, tStatus, tProduct, tRole } from "@/lib/translations";

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
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    const saved = localStorage.getItem("lang") as Language;
    if (saved === "hi" || saved === "en") {
      setLangState(saved);
    }
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("lang", newLang);
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
