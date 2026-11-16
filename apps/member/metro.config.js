const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const config = getDefaultConfig(__dirname);
// Preserve Expo's asset defaults while making the bundled vehicle model resolvable.
for (const extension of ["glb", "gltf"]) {
  if (!config.resolver.assetExts.includes(extension)) {
    config.resolver.assetExts.push(extension);
  }
}

// Fiber's native entry patches Three's FileLoader for Expo registry assets.
// Keep ESM addons (GLTFLoader) and Fiber's CJS entry on the same constructors;
// otherwise package exports can load two Three instances on native platforms.
// Three r187's CJS shim also calls Node's process.emitWarning. Metro can expose
// the ESM namespace to Fiber's require(), avoiding that Node-only wrapper.
const nativeThree = path.join(path.dirname(require.resolve("three")), "three.module.js");
const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "three" && (platform === "android" || platform === "ios")) {
    return { type: "sourceFile", filePath: nativeThree };
  }
  return resolveRequest
    ? resolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
