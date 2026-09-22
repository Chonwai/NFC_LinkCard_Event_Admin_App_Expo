/**
 * `F-06` 的行為鎖定：`API_BASE_URL` 與 service 的絕對路徑串接後
 * **只能出現一次 `/api/`**。
 *
 * 這個 bug 之所以長期隱形，是因為 EAS 每個 profile 都提供了 origin-only 的
 * `EXPO_PUBLIC_API_URL`，把壞掉的預設值遮住；任何缺這個變數的建置會拿到
 * 404，而不是一個看得懂的「設定錯誤」。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import axios from "axios";

const { API_BASE_URL, normalizeApiOrigin } = await import("@/constants/config");

/** 與 `src/services/registration.service.ts` 的 by-code 查詢同型（絕對路徑） */
const SERVICE_PATH = "/api/v1/events/e1/registrations/by-code/ABC";

/** 舊的預設值：正是造成雙 `/api` 的那個字串 */
const OLD_DEFAULT = "https://linkcard.xyz/api";

/** 缺陷的簽名：兩個 `/api` 段疊在一起 */
const DOUBLED = "/api/api";

/** 舊預設值串接後的完整結果，取自 F-06 的實測證據 */
const OLD_DEFAULT_URI =
  "https://linkcard.xyz/api/api/v1/events/e1/registrations/by-code/ABC";

test("F-06：base 接上絕對路徑後不得出現疊在一起的 /api", () => {
  const uri = axios.getUri({ baseURL: API_BASE_URL, url: SERVICE_PATH });

  assert.ok(!uri.includes(DOUBLED), uri);
  assert.ok(uri.endsWith(SERVICE_PATH), uri);
});

test("F-06 負向控制：舊的預設值真的會產生雙 /api（上一條不是恆真）", () => {
  const uri = axios.getUri({ baseURL: OLD_DEFAULT, url: SERVICE_PATH });

  assert.ok(uri.includes(DOUBLED), uri);
  assert.equal(uri, OLD_DEFAULT_URI);
});

test("F-06：normalizeApiOrigin 把舊預設與手誤尾綴都收斂成 origin", () => {
  const staging = "https://staging-api.link-card.xyz";
  const cases = [
    [OLD_DEFAULT, "https://linkcard.xyz"],
    ["https://linkcard.xyz/api/", "https://linkcard.xyz"],
    [`  ${staging}/api `, staging],
    [staging, staging],
  ];

  for (const [raw, expected] of cases) {
    assert.equal(normalizeApiOrigin(raw), expected, raw);
  }
});
