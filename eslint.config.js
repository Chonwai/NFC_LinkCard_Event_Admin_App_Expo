const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

/** @type {import('eslint').Linter.Config[]} */
module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: ["dist/*", "node_modules/*", ".expo/*", "coverage/*"],
  },
]);
