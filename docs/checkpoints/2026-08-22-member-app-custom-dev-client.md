# Member app: switching from Expo Go to a custom dev client

## Status: build succeeded, install on phone pending (picking this up later)

## Why

Running `apps/member` in **Expo Go** throws:

```
[runtime not ready]: Error: Native module RNFBAppModule not found. Re-check module
install, linking, configuration, build and install steps.
```

Expo Go is a generic, pre-built app that only ships Expo's own built-in native
modules. `apps/member` depends on `@react-native-firebase/app` and
`@react-native-firebase/auth`, which require custom native code — so Expo Go
can never run this app correctly. The fix is to build a **custom development
build** (aka "dev client") — a native build of this specific project, built
with the `expo-dev-client` package, that includes those native modules but
otherwise behaves exactly like Expo Go (same QR-code connect to Metro, same
hot reload, same red-box JS errors printed to the Metro terminal).

You only need to rebuild the dev client when **native** code changes:
- adding/removing/upgrading a native module (e.g. another `@react-native-firebase/*` package)
- changing native config in `app.json` / `app.config.js` (permissions, plugins, bundle id, `googleServicesFile`, etc.)
- upgrading the Expo SDK

Day-to-day JS/TS work hot-reloads through Metro like normal — no rebuild needed.

## What was already in place

- `expo-dev-client` already in `apps/member/package.json`
- `app.json` already had the Firebase + Google Sign-In plugins configured
- `apps/member/google-services.json` exists locally but is gitignored
  (`apps/member/.gitignore:45`) since it's a Firebase secret

## What we did

1. **Installed EAS CLI** (via `npx eas-cli`, no global install needed)
2. **Logged into Expo** (`npx eas-cli login`, account: `srielle`)
3. **Configured the project for EAS Build**: `npx eas-cli build:configure`
   → created `apps/member/eas.json` with `development` / `preview` / `production` profiles
   → linked to https://expo.dev/accounts/srielle/projects/member
4. **First build attempt failed**: EAS Build only uploads git-tracked files,
   and `google-services.json` is gitignored, so the build server couldn't find it.
5. **Fixed it** by uploading the file as a secure EAS file-type environment variable
   (stored on Expo's servers, not in git):
   ```
   cd apps/member && npx eas-cli env:set \
     --scope project \
     --name GOOGLE_SERVICES_JSON \
     --type file \
     --value ./google-services.json \
     --environment development \
     --visibility secret \
     --non-interactive
   ```
6. **Converted `app.json` → added `apps/member/app.config.js`** (app.json is
   static JSON and can't read `process.env`, so a dynamic config file is
   needed to point `android.googleServicesFile` at the EAS-provided path when
   building in the cloud, falling back to the local file otherwise):
   ```js
   module.exports = ({ config }) => ({
     ...config,
     android: {
       ...config.android,
       googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? config.android.googleServicesFile,
     },
   });
   ```
7. **Re-ran the build**: `npx eas-cli build --profile development --platform android --non-interactive`
   → succeeded.

## Build result

- Build page: https://expo.dev/accounts/srielle/projects/member/builds/899f5ac1-0492-4c1b-8bf9-1199d4493226
- This is an **internal distribution** APK — install directly on an Android
  device, no Play Store needed (Android will warn about "unknown sources";
  that's expected, allow it).

## Remaining steps (pick up here later)

1. Open the build link above on the Android phone (or scan its QR code) and install the APK.
   - It will appear as its own app icon ("AutoCare+"), replacing the need for Expo Go on this project.
2. On the laptop: `cd apps/member && pnpm start` (or `pnpm --filter member start`)
3. Open the installed dev client app on the phone and connect to Metro the
   same way Expo Go connected (scan QR / same Wi-Fi network).
4. Confirm the `RNFBAppModule not found` error is gone and Firebase auth flows work.

## Notes for next time a rebuild is needed

- Re-run: `cd apps/member && npx eas-cli build --profile development --platform android --non-interactive`
- The `GOOGLE_SERVICES_JSON` EAS env var is already set for the `development`
  environment — no need to re-upload it unless the Firebase config file itself changes.
- If Firebase config changes, re-upload with the same `env:set` command above
  (it will overwrite the existing value).

## Related: terminal error visibility

Metro (`pnpm start` / `expo start`) mirrors every JS error/warning shown on
the phone's red-box screen to the terminal it's running in automatically —
no extra setup needed, just keep that terminal window visible while testing.
