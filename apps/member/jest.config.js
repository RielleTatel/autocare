const expoPreset = require("jest-expo/jest-preset");

/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  // The preset only transforms `\.[jt]sx?$`, so `.mjs` sources fall through
  // untransformed and blow up on their first `export` — which is how
  // lucide-react-native ships (its package `exports` resolves the react-native
  // condition to dist/esm/*.mjs). Reuse the preset's own babel-jest config for
  // .mjs rather than replacing the transform map wholesale.
  transform: {
    ...expoPreset.transform,
    "\\.mjs$": expoPreset.transform["\\.[jt]sx?$"],
  },
  moduleNameMapper: {
    "^@autocare/design-tokens$": "<rootDir>/../../packages/design-tokens/src/index.ts",
    "^@autocare/api-client$": "<rootDir>/../../packages/api-client/src/index.ts",
    "^@autocare/contracts$": "<rootDir>/../../packages/contracts/src/index.ts",
    "^@autocare/scoring$": "<rootDir>/../../packages/scoring/src/index.ts",
    // Never load real @react-native-firebase/* or google-signin native modules
    // in unit tests — anything importing "./firebaseAuth" gets the manual mock.
    "^\\./firebaseAuth$": "<rootDir>/src/features/auth/__mocks__/firebaseAuth.ts",
  },
  // pnpm stores deps under node_modules/.pnpm/<name>@<ver>; transform any RN/Expo
  // package (which ship untranspiled ESM) wherever it appears in that store.
  transformIgnorePatterns: [
    "/node_modules/.pnpm/(?!.*(react-native|@react-native|expo|@expo|react-navigation)).*",
  ],
};
