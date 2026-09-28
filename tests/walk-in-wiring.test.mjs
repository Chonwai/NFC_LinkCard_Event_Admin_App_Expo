/**
 * ADM-F02 的接線鎖：`walk-in.tsx` 真的呼叫了那兩個純模組。
 *
 * 為什麼需要這一支：AdminApp 沒有元件層測試（`node:test`，無 jsdom／RN renderer），
 * `submit()` 的 `catch` 在純 Node 下**永遠跑不到**。純函式測試
 * （`tests/journeys/j-walkin-register.test.mjs`）證明「函式是對的」，但證明不了
 * 「畫面真的呼叫它」——把 `catch` 改回舊的三元式，那一支仍然全綠。
 *
 * 這不是假想的風險：S4 的原始缺陷就是「ADM 完全沒有 `CONSENT_*` 分支」，而它的
 * 可觀察面在畫面檔裡。因此這裡讀原始碼鎖住接線
 * （同 `button-focus-ring.test.mjs` / `reveal-focus-ring.test.mjs` 的既有做法）。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const SOURCE = readFileSync(
  path.join(REPO_ROOT, "src/app/(auth)/[eventId]/walk-in.tsx"),
  "utf8",
);

test("S4：walk-in.tsx 的 catch 必須經過 mapWalkInError（不得留第二套 inline 映射）", () => {
  assert.match(
    SOURCE,
    /import \{ mapWalkInError \} from "@\/utils\/walk-in-error-map";/,
  );
  assert.match(
    SOURCE,
    /setError\(mapWalkInError\(err, copy\.checkIn\.walkInFailed\)\)/,
  );
});

test("S4：walk-in.tsx 不得再自行讀取錯誤碼（移除後就沒有第二條映射路徑）", () => {
  assert.equal(/getApiErrorCode/.test(SOURCE), false);
  assert.equal(/getApiErrorMessage/.test(SOURCE), false);
});

test("S4：送出 payload 必須由 buildWalkInRegistrationBody 產生（consent 不得只存在於畫面檔）", () => {
  assert.match(
    SOURCE,
    /import \{ buildWalkInRegistrationBody \} from "@\/utils\/walk-in-payload";/,
  );
  assert.match(SOURCE, /buildWalkInRegistrationBody\(\{/);
});

test("ADM-02：本地守衛仍是送出前的最後一關（順序 ticketId → email → consent 不得改）", () => {
  const guard = SOURCE.indexOf("validateWalkInConsent({");
  const submitting = SOURCE.indexOf("setSubmitting(true)");
  assert.ok(guard >= 0, "validateWalkInConsent 呼叫不存在");
  assert.ok(submitting > guard, "守衛必須在 setSubmitting(true) 之前");
});
