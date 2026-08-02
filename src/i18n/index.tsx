import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { lt, type Messages } from './lt';
import { en } from './en';
import type { Language } from '../domain/models';

const bundles: Record<Language, Messages> = { lt, en };

/** Deep lookup with Lithuanian fallback for missing keys. */
export function translate(lang: Language, path: string): string {
  const walk = (obj: unknown, parts: string[]): unknown =>
    parts.reduce<unknown>((acc, p) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[p] : undefined), obj);
  const parts = path.split('.');
  const val = walk(bundles[lang], parts) ?? walk(bundles.lt, parts);
  return typeof val === 'string' ? val : path;
}

export function translateList(lang: Language, path: string): string[] {
  const walk = (obj: unknown, parts: string[]): unknown =>
    parts.reduce<unknown>((acc, p) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[p] : undefined), obj);
  const val = walk(bundles[lang], path.split('.')) ?? walk(bundles.lt, path.split('.'));
  return Array.isArray(val) ? (val as string[]) : [];
}

interface I18nCtx {
  lang: Language;
  t: (path: string) => string;
  tl: (path: string) => string[];
}

const Ctx = createContext<I18nCtx>({ lang: 'lt', t: (p) => translate('lt', p), tl: (p) => translateList('lt', p) });

export function I18nProvider({ lang, children }: { lang: Language; children: ReactNode }) {
  const value = useMemo<I18nCtx>(
    () => ({ lang, t: (p) => translate(lang, p), tl: (p) => translateList(lang, p) }),
    [lang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  return useContext(Ctx);
}
