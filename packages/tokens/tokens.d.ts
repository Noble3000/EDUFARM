import type tokens from "./tokens.json";

export type Tokens = typeof tokens;
export { default as tokens } from "./tokens.json";

// CSS custom-property generator (used by apps + Storybook later).
export function tokensToCssVars(t: Tokens): string {
  const c = t.color;
  return `:root{--brand-primary:${c.brand.primary};--brand-accent:${c.brand.accent};--ink-900:${c.ink["900"]};--ink-500:${c.ink["500"]};--paper:${c.paper.default};--official:${c.semantic.official};--urgent:${c.semantic.urgent};}`;
}
