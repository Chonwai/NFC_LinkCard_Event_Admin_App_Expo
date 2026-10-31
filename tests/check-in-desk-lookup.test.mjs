/**
 * 「已報到者回訪」改走**唯讀**的 `desk-lookup`，而不是再打一次 `checkIn`。
 *
 * 為什麼需要這一支：AdminApp 沒有元件層測試（`node:test`，無 jsdom／RN
 * renderer），`check-in.tsx` 只能靠讀原始碼比對字串。所以判定與整形抽到
 * `@/utils/desk-lookup`（純函式、查詢由呼叫端注入），這裡對**行為**下斷言；
 * 剩下「畫面真的接上它」那一半用原始碼鎖住。
 *
 * 反例探針（RED→GREEN 證據，實測方式見交付報告）：
 * - 把 `resolveDuplicateOutcome` 的 `lookupDesk` 呼叫拿掉（只用 by-code）
 *   ⇒ 第 3 條（desk 欄位為準）必紅。
 * - 把 `catch` 改成 rethrow ⇒ 「查詢失敗不翻轉判定」那條必紅。
 * - 把 `toRegistrationView` 的 `{ ...fallback }` 拿掉 ⇒ 「desk-lookup 沒有的
 *   欄位沿用 by-code」那條必紅。
 * - 把 `showAlreadyCheckedIn` 改回直接 `registrationService.checkIn(...)`
 *   ⇒ 「checkIn 只打一次」那條必紅。
 *
 * 誠實邊界：本檔不證明現場裝置上的網路行為（逾時、離線佇列）；那屬裝置層驗收。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mock, test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  resolveDuplicateOutcome,
  toRegistrationView,
} from "@/utils/desk-lookup";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const read = (rel) => readFileSync(path.join(REPO_ROOT, rel), "utf8");
const CHECK_IN = read("src/app/(auth)/[eventId]/check-in.tsx");

/** `desk-lookup` 的實測回應形狀（後端 select 白名單十欄）。 */
const deskResponse = (overrides = {}) => ({
  id: "reg-desk-1",
  registrationCode: "LKC-202611-A1B2C3",
  status: "CHECKED_IN",
  email: "mei@example.com",
  firstName: "Mei",
  lastName: "Yu",
  company: "Acme",
  registrantType: "VISITOR",
  checkedInAt: "2026-11-01T02:00:00.000Z",
  profileUrl: "https://linkcard.xyz/p/mei-yu-a1b2c3",
  ...overrides,
});

/** 同一人的 `by-code` 回應：多了 desk-lookup 沒有的票種／代幣。 */
const byCodeRegistration = (overrides = {}) => ({
  id: "reg-bycode-1",
  registrationCode: "LKC-202611-A1B2C3",
  status: "CHECKED_IN",
  checkedInAt: "2026-11-01T01:00:00.000Z",
  email: "mei@example.com",
  firstName: "Mei",
  lastName: "Yu",
  company: "Acme",
  registrantType: "VISITOR",
  tokenBalance: 12,
  ticketType: { id: "tt-1", displayName: "Early Bird" },
  profileUrl: null,
  ...overrides,
});

test("toRegistrationView：id／checkedInAt／profileUrl 一律以 desk-lookup 為準", () => {
  const view = toRegistrationView(
    deskResponse(),
    byCodeRegistration({ profileUrl: "https://stale.example/p/old" }),
  );

  assert.equal(
    view.id,
    "reg-desk-1",
    "綁卡要用 desk 的 id（by-code 的舊值會被沿用）",
  );
  assert.equal(view.checkedInAt, "2026-11-01T02:00:00.000Z");
  assert.equal(view.profileUrl, "https://linkcard.xyz/p/mei-yu-a1b2c3");
});

test("toRegistrationView：desk-lookup 沒有的欄位沿用 by-code，且不憑空造值", () => {
  const merged = toRegistrationView(deskResponse(), byCodeRegistration());
  assert.equal(merged.tokenBalance, 12, "票種/代幣只在 by-code 有 ⇒ 必須保留");
  assert.deepEqual(merged.ticketType, {
    id: "tt-1",
    displayName: "Early Bird",
  });

  const alone = toRegistrationView(deskResponse());
  assert.equal(
    alone.tokenBalance,
    undefined,
    "沒有 by-code 就沒有代幣：不得預設 0（0 是『有帳戶但沒代幣』的另一個事實）",
  );
  assert.equal(alone.ticketType, undefined);
});

test("resolveDuplicateOutcome：打的是注入的 desk-lookup，回傳 desk 的報到時間", async () => {
  const calls = [];
  const outcome = await resolveDuplicateOutcome(
    "ev-1",
    "LKC-202611-A1B2C3",
    byCodeRegistration(),
    async (eventId, code) => {
      calls.push({ eventId, code });
      return { registration: deskResponse() };
    },
  );

  assert.deepEqual(calls, [{ eventId: "ev-1", code: "LKC-202611-A1B2C3" }]);
  assert.equal(outcome.registration?.id, "reg-desk-1");
  assert.equal(
    outcome.checkedInAt,
    "2026-11-01T02:00:00.000Z",
    "結果卡顯示的『首次報到時間』必須來自 desk-lookup，不是 by-code 的殘值",
  );
});

test("resolveDuplicateOutcome：唯讀查詢失敗時降級，不把『已入場』講成『查無此票』", async () => {
  const outcome = await resolveDuplicateOutcome(
    "ev-1",
    "LKC-202611-A1B2C3",
    byCodeRegistration(),
    async () => {
      throw new Error("403 INSUFFICIENT_PERMISSION");
    },
  );

  assert.equal(outcome.registration?.id, "reg-bycode-1", "沿用 by-code 的資料");
  assert.equal(outcome.checkedInAt, "2026-11-01T01:00:00.000Z");
});

test("resolveDuplicateOutcome：連 by-code 都沒有時不崩，回 undefined/null", async () => {
  const outcome = await resolveDuplicateOutcome(
    "ev-1",
    "LKC-202611-A1B2C3",
    undefined,
    async () => {
      throw new Error("offline");
    },
  );

  assert.equal(outcome.registration, undefined);
  assert.equal(outcome.checkedInAt, null);
});

test("畫面接線：兩處『已入場』都走同一個收斂點，且 checkIn 只打一次（首次報到）", () => {
  const checkInCalls = CHECK_IN.match(/registrationService\.checkIn\(/g) ?? [];
  assert.equal(
    checkInCalls.length,
    1,
    "`checkIn` 只能出現在首次報到那條路徑；多於一處代表已報到分支又去打它了",
  );

  const duplicateBranches =
    CHECK_IN.match(/await showAlreadyCheckedIn\(/g) ?? [];
  assert.equal(
    duplicateBranches.length,
    2,
    "by-code 先行判定與 ALREADY_CHECKED_IN 錯誤都必須收斂到 showAlreadyCheckedIn",
  );

  assert.match(
    CHECK_IN,
    /resolveDuplicateOutcome\(/,
    "已報到分支沒有走 desk-lookup 的整形層",
  );
  assert.match(
    CHECK_IN,
    /registrationService\.lookupRegistrationForDesk\(/,
    "沒有把真正的 desk-lookup 查詢注入進去",
  );
});

// ── 呼叫契約（method + path + query）─────────────────────────────────────────
// `check:contract` 驗的是「這條路徑存在於後端快照」，不驗呼叫端的寫法與 query
// 編碼；這一節補上那一半。
const contractCalls = [];

mock.module("@/services/api", {
  namedExports: {
    apiClient: {
      get: async (url, config) => {
        contractCalls.push({ method: "GET", url, config });
        return {
          data: { data: { registration: deskResponse() } },
        };
      },
      post: async (url) => {
        contractCalls.push({ method: "POST", url });
        return { data: { data: {} } };
      },
    },
  },
});

test("契約：lookupRegistrationForDesk = GET …/registrations/desk-lookup?code=…（照 Web）", async () => {
  const { registrationService } =
    await import("@/services/registration.service");

  const res = await registrationService.lookupRegistrationForDesk(
    "ev-1",
    "LKC 202611/A1B2C3",
  );

  assert.equal(contractCalls.length, 1);
  const [call] = contractCalls;
  assert.equal(call.method, "GET", "唯讀查詢不得用 POST");
  assert.equal(
    call.url,
    `/api/v1/events/ev-1/registrations/desk-lookup?code=${encodeURIComponent(
      "LKC 202611/A1B2C3",
    )}`,
    "路徑與 code 的編碼方式必須逐字照 Web 的 lookupRegistrationForDesk",
  );
  assert.equal(res.registration.id, "reg-desk-1", "回傳必須攤平 envelope");
});
