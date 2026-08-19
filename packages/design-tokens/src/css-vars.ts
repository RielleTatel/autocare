import { colors, vhsBands } from "./tokens";
export function toCssVars(): string {
  const base = Object.entries(colors).map(([k, v]) => `--ac-${k}: ${v};`);
  const bands = Object.entries(vhsBands).map(([k, v]) => `--ac-band-${k.toLowerCase()}: ${v.fill};`);
  return `:root {\n  ${[...base, ...bands].join("\n  ")}\n}`;
}
