/**
 * `F-07`（2026-10-15）：非開發建置缺少 `EXPO_PUBLIC_API_URL` 時必須**拒絕**，
 * 而不是靜默 fallback 到 production。
 *
 * 缺陷原貌：`config.ts` 的 `API_BASE_URL` 是
 * `normalizeApiOrigin(EXPO_PUBLIC_API_URL || "https://linkcard.xyz")`——
 * 一個漏設變數的 preview／staging build 會把報到、walk-in、NFC 綁卡等**寫入**
 * 操作送去 production。
 *
 * 為什麼長期隱形：EAS 三個 profile 都提供了 `EXPO_PUBLIC_API_URL`（見 `eas.json`），
 * 把這條路徑完全遮住；只有「有人拿掉變數」時才會踩到。`F-06` 修掉了雙 `/api`，
 * 卻讓這條 fallback 從「回 404」變成「打到 production」——更安靜、更危險。
 *
 * 本檔同時鎖住 `.env.example` 早就宣稱、但程式碼裡從不存在的 guard。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const {
  API_CONFIG,
  APP_CONFIG_INVALID_CODE,
  normalizeApiOrigin,
  resolveApiConfig,
} = await import("@/constants/config");

const STAGING = "https://staging-api.link-card.xyz";
const PRODUCTION = "https://linkcard.xyz";
const LOCAL_DEV = "http://127.0.0.1:3020";

/** 舊行為的簽名——修好之後不該再有任何路徑產生這個值。 */
function legacyOutcomeFor(envUrl) {
  return normalizeApiOrigin(envUrl?.trim() || PRODUCTION);
}

test("F-07：非開發建置缺少 env ⇒ 拒絕設定，不猜測環境", () => {
  const config = resolveApiConfig(undefined, true);

  assert.equal(config.ok, false);
  assert.equal(config.reason, "missing-api-url");
  // 關鍵：不得回傳任何 origin
  assert.equal(config.apiBaseUrl, undefined);
});

test("F-07：空白／純空格 env 與缺少 env 同義", () => {
  for (const value of [undefined, "", "   ", "\n"]) {
    const config = resolveApiConfig(value, true);
    assert.equal(config.ok, false, JSON.stringify(value));
  }
});

test("F-07 負向控制：舊運算式真的會把缺變數的建置送去 production（上一條不是恆真）", () => {
  assert.equal(legacyOutcomeFor(undefined), PRODUCTION);
  assert.equal(legacyOutcomeFor(""), PRODUCTION);
  // 修正後：同一情境不再得到 production
  assert.notEqual(resolveApiConfig(undefined, true).apiBaseUrl, PRODUCTION);
});

test("F-07：dev fallback 指向本機後端，且仍走 origin 正規化", () => {
  const config = resolveApiConfig(undefined, false);

  assert.equal(config.ok, true);
  assert.equal(config.source, "dev-fallback");
  assert.equal(config.apiBaseUrl, LOCAL_DEV);
  assert.equal(config.apiBaseUrl.includes("/api/"), false);
});

test("F-07：有 env 時一律採用 env，並收斂尾綴與誤填的 /api", () => {
  const cases = [
    [STAGING, STAGING],
    [`${STAGING}/api`, STAGING],
    [`  ${STAGING}/api/ `, STAGING],
    [`${PRODUCTION}/api/`, PRODUCTION],
  ];

  for (const [raw, expected] of cases) {
    const config = resolveApiConfig(raw, true);
    assert.equal(config.ok, true, raw);
    assert.equal(config.source, "env", raw);
    assert.equal(config.apiBaseUrl, expected, raw);
  }
});

test("F-07：dev 建置有 env 時仍用 env（不覆寫成 localhost）", () => {
  const config = resolveApiConfig(STAGING, false);

  assert.equal(config.ok, true);
  assert.equal(config.source, "env");
  assert.equal(config.apiBaseUrl, STAGING);
});

test("F-07：錯誤碼是穩定的常數契約", () => {
  assert.equal(APP_CONFIG_INVALID_CODE, "APP_CONFIG_INVALID");
});

test("F-07：Node 測試環境（__DEV__ 未定義）不得被誤判成 missing-api-url", () => {
  // 這是 Promoter `W-24` 刻意保留的條件：`__DEV__` 未定義時允許 fallback，
  // 否則測試環境會把所有請求誤拒。
  assert.equal(typeof globalThis.__DEV__, "undefined");

  const config = resolveApiConfig(undefined, false);
  assert.equal(config.ok, true);
  assert.equal(config.source, "dev-fallback");
});

test("F-07：模組層 API_CONFIG 與當前 runtime 相符", () => {
  // 本測試在 Node 下執行 ⇒ __DEV__ 未定義 ⇒ 非 missing-api-url。
  assert.equal(API_CONFIG.ok, true);
  assert.equal(API_CONFIG.source, "dev-fallback");
});
