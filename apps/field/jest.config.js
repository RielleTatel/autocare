/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    "^@autocare/design-tokens$": "<rootDir>/../../packages/design-tokens/src/index.ts",
    "^@autocare/api-client$": "<rootDir>/../../packages/api-client/src/index.ts",
    "^@autocare/contracts$": "<rootDir>/../../packages/contracts/src/index.ts",
  },
  // pnpm stores deps under node_modules/.pnpm/<name>@<ver>; transform any RN/Expo
  // package (which ship untranspiled ESM) wherever it appears in that store.
  transformIgnorePatterns: [
    "/node_modules/.pnpm/(?!.*(react-native|@react-native|expo|@expo|react-navigation)).*",
  ],
  // @react-native/jest-preset's react-native-env sets customExportConditions
  // to ['require', 'react-native'], which has no match in firebase's (and
  // @firebase/*'s) conditional "exports" map, so resolution falls through to
  // the "default" condition — an untranspiled ESM build babel isn't set up
  // for. Adding "node" makes those packages' "node" condition (which points
  // at their CJS build) match instead.
  testEnvironmentOptions: {
    customExportConditions: ["require", "react-native", "node"],
  },
};
