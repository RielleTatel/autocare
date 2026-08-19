import type { Config } from "tailwindcss";
import { tailwindPreset } from "@autocare/design-tokens";

export default {
  presets: [tailwindPreset as Partial<Config>],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Bind the token font roles to the next/font CSS variables set in layout.tsx.
      fontFamily: {
        display: ["var(--font-display)", "SF Pro Display", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "SF Pro Text", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "Menlo", "monospace"],
      },
    },
  },
} satisfies Config;
