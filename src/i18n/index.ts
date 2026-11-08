/**
 * Message formatting for the Progression Lab. The engine returns language-neutral messages
 * ({ k: key, p: params }); the UI renders them with `fmt(lang, msg)`. English strings returned by the
 * engine (e.g. `explanation`) are `fmt("en", …)` of the same messages, so both languages share one source.
 */
import { en, type MsgKey } from "./en";
import { ko } from "./ko";

export type Lang = "en" | "ko";
export type { MsgKey };

export type Param = string | number | Msg | Msg[];
export interface Msg {
  k: MsgKey;
  p?: Record<string, Param>;
}

export const DICTS: Record<Lang, Record<MsgKey, string>> = { en, ko };

export function m(k: MsgKey, p?: Record<string, Param>): Msg {
  return p ? { k, p } : { k };
}

function isMsg(x: unknown): x is Msg {
  return typeof x === "object" && x !== null && "k" in x;
}

function fmtParam(lang: Lang, v: Param): string {
  if (Array.isArray(v)) return v.map((x) => fmt(lang, x)).join(" + ");
  if (isMsg(v)) return fmt(lang, v);
  return String(v);
}

/** Render a message (or pass a plain string through). Unknown placeholders are left visible. */
export function fmt(lang: Lang, msg: Msg | string): string {
  if (typeof msg === "string") return msg;
  const template = DICTS[lang][msg.k];
  return template.replace(/\{([\w]+)\}/g, (whole, name: string) => {
    const v = msg.p?.[name];
    return v === undefined ? whole : fmtParam(lang, v);
  });
}

export const fmtEn = (msg: Msg | string) => fmt("en", msg);

/** Translate a dictionary key directly. */
export function tr(lang: Lang, k: MsgKey, p?: Record<string, Param>): string {
  return fmt(lang, m(k, p));
}
