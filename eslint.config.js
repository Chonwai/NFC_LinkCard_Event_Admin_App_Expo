const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

/** @type {import('eslint').Linter.Config[]} */
module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: ["dist/*", "node_modules/*", ".expo/*", "coverage/*"],
  },
  {
    // `tools/nfc-reader-spike` is a standalone Node CLI, not app code. The Expo
    // profile deliberately forbids Node built-ins so they can never leak into
    // the app bundle; this override grants them only inside that tool.
    files: ["tools/nfc-reader-spike/**/*.js"],
    languageOptions: {
      globals: {
        Buffer: "readonly",
        console: "readonly",
        process: "readonly",
        __dirname: "readonly",
        require: "readonly",
        module: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
      },
    },
  },
]);
