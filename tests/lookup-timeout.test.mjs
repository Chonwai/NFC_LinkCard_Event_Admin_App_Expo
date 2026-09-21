/**
 * `WP-ADM-02` 的行為鎖定：by-code 查詢的逾時上限。
 *
 * 分成兩半：
 * - **runtime**：讀真正的常數模組，確認查詢逾時 ≤ 3s，且全域逾時沒有被動到。
 * - **static**：讀 `registration.service.ts` 原始碼，確認覆寫真的掛在 `getByCode`
 *   那一支請求上（否則常數只是一個沒有讀者的宣告）。這半是原始碼層級的斷言，
 *   不是行為斷言——`registration.service` 需要 axios 與 React Native，
 *   在純 Node 下無法載入，強行 mock 會讓測試比被測程式更難懂。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const { API_TIMEOUT_MS, LOOKUP_TIMEOUT_MS } = await import("@/constants/config");

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

test("LOOKUP_TIMEOUT_MS 存在且 ≤ 3000 ms（H0-1 的 gate）", () => {
  assert.equal(typeof LOOKUP_TIMEOUT_MS, "number");
  assert.ok(
    LOOKUP_TIMEOUT_MS <= 3000,
    `查詢逾時必須 ≤ 3000 ms，實測 ${LOOKUP_TIMEOUT_MS}`,
  );
  assert.equal(LOOKUP_TIMEOUT_MS, 3000);
});

test("全域 API_TIMEOUT_MS 未被改動（仍為 15000）", () => {
  assert.equal(API_TIMEOUT_MS, 15000);
});

test("查詢逾時必須短於全域逾時", () => {
  assert.ok(LOOKUP_TIMEOUT_MS < API_TIMEOUT_MS);
});

test("[static] getByCode 的請求帶上 timeout: LOOKUP_TIMEOUT_MS", () => {
  const source = readFileSync(
    path.join(REPO_ROOT, "src/services/registration.service.ts"),
    "utf8",
  );

  const getByCodeBody = source.slice(source.indexOf("async getByCode("));
  assert.ok(getByCodeBody.length > 0, "找不到 async getByCode(");
  assert.match(getByCodeBody, /by-code\//, "getByCode 應打 by-code 端點");
  assert.match(
    getByCodeBody,
    /timeout:\s*LOOKUP_TIMEOUT_MS/,
    "getByCode 必須覆寫 timeout 為 LOOKUP_TIMEOUT_MS",
  );
});

test("[static] 沒有其他請求被這次覆寫波及", () => {
  const source = readFileSync(
    path.join(REPO_ROOT, "src/services/registration.service.ts"),
    "utf8",
  );

  assert.doesNotMatch(source, /timeout:\s*API_TIMEOUT_MS/);
  const overrides = source.match(/timeout:\s*LOOKUP_TIMEOUT_MS/g) ?? [];
  assert.equal(overrides.length, 1, "只允許一處（getByCode）覆寫逾時");
});
