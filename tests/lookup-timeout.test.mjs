/**
 * `WP-ADM-02` 的行為鎖定：查詢（唯讀）請求的逾時上限。
 *
 * 分成兩半：
 * - **runtime**：讀真正的常數模組，確認查詢逾時 ≤ 3s，且全域逾時沒有被動到。
 * - **static**：讀 `registration.service.ts` 原始碼，確認覆寫真的掛在**唯讀查詢**
 *   那一支請求上（否則常數只是一個沒有讀者的宣告）。這半是原始碼層級的斷言，
 *   不是行為斷言——`registration.service` 需要 axios 與 React Native，
 *   在純 Node 下無法載入，強行 mock 會讓測試比被測程式更難懂。
 *
 * ⚠️ 2026-11-01（`desk-lookup` 接線）：允許的覆寫點由一處改為**兩處**，
 * 兩者都是 `GET` 唯讀查詢——`getByCode`（公開 by-code）與
 * `lookupRegistrationForDesk`（簽到台唯讀）。現場掃碼的等待時間同樣不該是全域的
 * 15 秒；差別是後者失敗會降級（見 `@/utils/desk-lookup` 的 `resolveDuplicateOutcome`）。
 * 這道鎖的用意仍然是「**寫入類**請求不得被縮短」，所以逐支驗證而不是數數量。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const { API_TIMEOUT_MS, LOOKUP_TIMEOUT_MS } =
  await import("@/constants/config");

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/**
 * 取某個 service 方法從簽名到下一個 `async xxx(` 之間的段落（靜態掃描用）。
 * 找不到簽名時回空字串，讓呼叫端的 `assert.ok(length > 0)` 負責報錯。
 */
function methodBody(source, signature) {
  const start = source.indexOf(signature);
  if (start < 0) return "";
  const rest = source.slice(start + signature.length);
  const next = rest.search(/\n  async [a-zA-Z]+\(/);
  return next < 0 ? rest : rest.slice(0, next);
}

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

  const getByCodeBody = methodBody(source, "async getByCode(");
  assert.ok(getByCodeBody.length > 0, "找不到 async getByCode(");
  assert.match(getByCodeBody, /by-code\//, "getByCode 應打 by-code 端點");
  assert.match(
    getByCodeBody,
    /timeout:\s*LOOKUP_TIMEOUT_MS/,
    "getByCode 必須覆寫 timeout 為 LOOKUP_TIMEOUT_MS",
  );
});

test("[static] lookupRegistrationForDesk 的請求帶上 timeout: LOOKUP_TIMEOUT_MS", () => {
  const source = readFileSync(
    path.join(REPO_ROOT, "src/services/registration.service.ts"),
    "utf8",
  );

  const body = methodBody(source, "async lookupRegistrationForDesk(");
  assert.ok(body.length > 0, "找不到 async lookupRegistrationForDesk(");
  assert.match(body, /desk-lookup\?code=/, "應打 desk-lookup 端點");
  assert.match(
    body,
    /timeout:\s*LOOKUP_TIMEOUT_MS/,
    "desk-lookup 必須覆寫 timeout 為 LOOKUP_TIMEOUT_MS",
  );
});

test("[static] 覆寫逾時的只有這兩支唯讀查詢，寫入類請求未被波及", () => {
  const source = readFileSync(
    path.join(REPO_ROOT, "src/services/registration.service.ts"),
    "utf8",
  );

  assert.doesNotMatch(source, /timeout:\s*API_TIMEOUT_MS/);
  const overrides = source.match(/timeout:\s*LOOKUP_TIMEOUT_MS/g) ?? [];
  assert.equal(
    overrides.length,
    2,
    "只允許 getByCode 與 lookupRegistrationForDesk 兩處覆寫逾時",
  );
});
