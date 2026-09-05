const { withAppBuildGradle } = require("expo/config-plugins");

/**
 * Enable per-ABI APK splits (arm64-v8a, armeabi-v7a, x86, x86_64)
 * so release builds produce one APK per architecture instead of a
 * single 230MB+ universal APK (~60MB each).
 *
 * NOTE: for Google Play multi-APK uploads each ABI needs a distinct
 * versionCode — add an abiCodes/versionCodeOverride mapping if you
 * ever publish splits to Play (AAB is preferred there).
 */
module.exports = function withApkSplits(config) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.contents.includes("splits {")) {
      return mod;
    }
    const anchor = "\n    defaultConfig {";
    if (!mod.modResults.contents.includes(anchor)) {
      return mod;
    }
    mod.modResults.contents = mod.modResults.contents.replace(
      anchor,
      `
    splits {
        abi {
            enable true
            reset()
            include "armeabi-v7a", "arm64-v8a", "x86", "x86_64"
            universalApk false
        }
    }
    defaultConfig {`
    );
    return mod;
  });
};
