/**
 * 註冊 `tests/alias-loader.mjs`（Node ESM 的 `register()` 需要一支獨立模組）。
 *
 * 用法（於 repo 根目錄；`--experimental-test-module-mocks` 供 `mock.module` 使用）：
 *
 *   node --import ./tests/register-alias-loader.mjs --experimental-test-module-mocks \
 *     --test tests/*.test.mjs
 *
 * 說明：本 repo 沒有 jest／vitest，且不得引入新依賴 → 全部使用 Node 內建能力。
 * 逐字移植自 `LinkCard_Promoter_App_Expo/tests/register-alias-loader.mjs`。
 */
import { register } from "node:module";

register("./alias-loader.mjs", import.meta.url);
