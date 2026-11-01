/**
 * 票種 payload 的**錢與資料**守門測試。
 *
 * ## 為什麼這一支最重要
 *
 * 這個能力的寫入路徑有兩件事「錯了不會有任何錯誤訊息」：
 *
 * 1. **`price` 的單位**。後端是 `Decimal(10, 2)`，單位是**幣別金額**
 *    （預設 MOP），不是分。任何 `* 100` / `Math.round` / 補零都會讓
 *    一千五百元變成一萬五千元，而後端照收、畫面照顯示、報表照算。
 *    所以這裡逐字釘住「輸入什麼、送出什麼」。
 * 2. **payload 的鍵集合**。Web 送 13 個鍵（完整 payload，不是部分更新）。
 *    少一個＝那個欄位存不進去（例如少送 `capacity: null` 就永遠清不掉上限）；
 *    多一個＝App 送得出 Web 從未送過的值。
 *
 * ## 它刻意不驗什麼（誠實邊界）
 * - **不驗**後端收不收（那是 `npm run check:contract` 與後端自己的 DTO 測試）。
 * - **不驗**畫面（`ticket-types.tsx` 跑不了 node）。
 * - **不驗** `formFieldsJson` 的語意綁定——那是 `ticket-type-form-contract`
 *   與後端 save guard 的事。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const {
  buildTicketTypePayload,
  emptyTicketTypeForm,
  normalizeAllowedPaymentMethods,
  payloadContextFrom,
  resolveTicketCapabilities,
  summarizeTicketTypeChanges,
  ticketTypeFormFrom,
  toggleTicketCapability,
  validateTicketTypeForm,
} = await import("@/utils/ticket-type-form");

/** 一個「什麼都沒填」的表單。 */
function form(overrides = {}) {
  return { ...emptyTicketTypeForm(), ...overrides };
}

/** 空的表單 context：報名表欄位空。 */
const FRESH_CONTEXT = { formFieldsJson: { fields: [] } };

// ---------------------------------------------------------------------------
// 一、price 的單位：全程不換算
// ---------------------------------------------------------------------------

test("price 原樣送出：不乘 100、不四捨五入、不去尾零", () => {
  const payload = buildTicketTypePayload(
    form({ price: "1500.50" }),
    FRESH_CONTEXT,
  );

  assert.equal(
    payload.price,
    "1500.50",
    "1500.50 就是 1500.50（MOP）。若變成 150050 或 1500.5，代表有人加了換算",
  );
  assert.equal(typeof payload.price, "string", "Decimal 走字串，不轉 number");
});

test("price 的邊界值全部原樣通過：0 / 0.01 / 0.10 / 99999999.99", () => {
  for (const price of ["0", "0.01", "0.10", "99999999.99"]) {
    assert.equal(
      buildTicketTypePayload(form({ price }), FRESH_CONTEXT).price,
      price,
      `${price} 被改寫了`,
    );
  }
});

test("price 前後的空白被 trim，其餘不動", () => {
  assert.equal(
    buildTicketTypePayload(form({ price: "  1500.50  " }), FRESH_CONTEXT).price,
    "1500.50",
  );
});

test("後端回的字串帶尾零時，表單回填不經 Number()（否則 1500.50 變 1500.5）", () => {
  const filled = ticketTypeFormFrom({
    id: "tt-1",
    eventId: "evt-1",
    name: "standard",
    displayName: "標準票",
    price: "1500.50",
    currency: "MOP",
    capacity: null,
    soldCount: 0,
    registrantType: "ATTENDEE",
    isHidden: false,
    initialTokens: 0,
    allowedPaymentMethods: ["FREE"],
    isActive: true,
  });

  assert.equal(filled.price, "1500.50");
  // 再送回後端時仍然是同一個字串（round-trip 不漂移）。
  assert.equal(buildTicketTypePayload(filled, FRESH_CONTEXT).price, "1500.50");
});

// ---------------------------------------------------------------------------
// 二、payload 的鍵集合：恰好 13 個（description 有值時）
// ---------------------------------------------------------------------------

test("payload 的鍵集合固定，順序也固定", () => {
  const payload = buildTicketTypePayload(
    form({ description: "含午餐" }),
    FRESH_CONTEXT,
  );

  assert.deepEqual(Object.keys(payload), [
    "name",
    "displayName",
    "price",
    "currency",
    "registrantType",
    "description",
    "capacity",
    "isHidden",
    "accessCode",
    "initialTokens",
    "allowedPaymentMethods",
    "formFieldsJson",
    "capabilities",
  ]);
});

test("description 空的時候整個鍵省略（照抄 Web 的 `值 || undefined`）", () => {
  for (const description of ["", "   "]) {
    const payload = buildTicketTypePayload(
      form({ description }),
      FRESH_CONTEXT,
    );
    assert.equal(
      Object.hasOwn(payload, "description"),
      false,
      "空說明必須省略鍵：後端用 `!== undefined` 判斷，送了才會寫入",
    );
    assert.equal(Object.keys(payload).length, 12);
  }
});

test("description 有值時 trim 後送出", () => {
  assert.equal(
    buildTicketTypePayload(form({ description: "  含午餐  " }), FRESH_CONTEXT)
      .description,
    "含午餐",
  );
});

test("capacity 空＝null（顯式送出，不是省略）——否則「清空上限」會失效", () => {
  const payload = buildTicketTypePayload(form({ capacity: "" }), FRESH_CONTEXT);

  assert.equal(
    Object.hasOwn(payload, "capacity"),
    true,
    "必須有這個鍵：省略＝後端不動，等於清不掉上限",
  );
  assert.equal(payload.capacity, null);
});

test("capacity 有值＝整數", () => {
  assert.equal(
    buildTicketTypePayload(form({ capacity: "120" }), FRESH_CONTEXT).capacity,
    120,
  );
});

test("accessCode 一律大寫；空＝null", () => {
  assert.equal(
    buildTicketTypePayload(form({ accessCode: "vip2026" }), FRESH_CONTEXT)
      .accessCode,
    "VIP2026",
    "後端 normalizeAccessCode 會 toUpperCase，Web 在輸入時就大寫——兩邊都得對",
  );
  assert.equal(
    buildTicketTypePayload(form({ accessCode: "   " }), FRESH_CONTEXT)
      .accessCode,
    null,
  );
});

test("initialTokens 空＝0（後端 @IsInt() @Min(0)）", () => {
  assert.equal(
    buildTicketTypePayload(form({ initialTokens: "" }), FRESH_CONTEXT)
      .initialTokens,
    0,
  );
  assert.equal(
    buildTicketTypePayload(form({ initialTokens: "5" }), FRESH_CONTEXT)
      .initialTokens,
    5,
  );
});

test("currency 一律大寫（後端 currency.toUpperCase()）", () => {
  assert.equal(
    buildTicketTypePayload(form({ currency: "mop" }), FRESH_CONTEXT).currency,
    "MOP",
  );
});

// ---------------------------------------------------------------------------
// 三、capabilities 與 formFieldsJson 必須原值帶回
// ---------------------------------------------------------------------------

test("新建票種：capabilities 是 null（＝繼承），不是空陣列", () => {
  assert.equal(
    buildTicketTypePayload(form(), FRESH_CONTEXT).capabilities,
    null,
    "空陣列是「明確不給任何權益」，與「繼承預設」是完全不同的語意",
  );
});

test("編輯票種：capabilities 帶回既有的 capabilitiesOverride", () => {
  const existing = {
    id: "tt-1",
    eventId: "evt-1",
    name: "vip",
    displayName: "VIP",
    price: "3000",
    currency: "MOP",
    capacity: null,
    soldCount: 3,
    registrantType: "GUEST",
    isHidden: false,
    initialTokens: 0,
    allowedPaymentMethods: ["FREE"],
    isActive: true,
    // 後端解析後的「實際生效值」——**不可以**拿這個寫回去。
    capabilities: ["NETWORKING", "WALLET"],
    capabilitiesOverride: null,
  };

  assert.equal(
    ticketTypeFormFrom(existing).capabilities,
    null,
    "override 是 null（繼承）；若拿 capabilities 寫回去，繼承會被固化成覆寫",
  );
  assert.equal(
    buildTicketTypePayload(ticketTypeFormFrom(existing), FRESH_CONTEXT)
      .capabilities,
    null,
  );

  // override 有值時才原樣帶回。
  const overridden = { ...existing, capabilitiesOverride: ["WALLET"] };
  assert.deepEqual(
    buildTicketTypePayload(ticketTypeFormFrom(overridden), FRESH_CONTEXT)
      .capabilities,
    ["WALLET"],
  );
});

test("編輯票種：formFieldsJson 原值帶回，不會被清成空表", () => {
  const existing = {
    id: "tt-1",
    eventId: "evt-1",
    name: "vip",
    displayName: "VIP",
    price: "3000",
    currency: "MOP",
    registrantType: "GUEST",
    isHidden: false,
    initialTokens: 0,
    allowedPaymentMethods: ["FREE"],
    isActive: true,
    formFieldsJson: { fields: [{ key: "company", type: "text" }] },
  };

  const payload = buildTicketTypePayload(form(), payloadContextFrom(existing));
  assert.deepEqual(payload.formFieldsJson, existing.formFieldsJson);
});

// ---------------------------------------------------------------------------
// 四、付款方式：逐字照抄 Web 的正規化
// ---------------------------------------------------------------------------

test("空 → FREE；單一值原樣；BANK_TRANSFER 優先於 FREE", () => {
  assert.deepEqual(normalizeAllowedPaymentMethods([]), ["FREE"]);
  assert.deepEqual(normalizeAllowedPaymentMethods(null), ["FREE"]);
  assert.deepEqual(normalizeAllowedPaymentMethods(["BANK_TRANSFER"]), [
    "BANK_TRANSFER",
  ]);
  assert.deepEqual(normalizeAllowedPaymentMethods(["FREE", "BANK_TRANSFER"]), [
    "BANK_TRANSFER",
  ]);
});

test("不在 ENABLED_PAYMENT_METHODS 裡的值被濾掉（Web 的三個 disabled 選項）", () => {
  assert.deepEqual(
    normalizeAllowedPaymentMethods(["STRIPE", "TOKEN", "OFFLINE_CASH"]),
    ["FREE"],
    "這三種付款方式 Web 的勾選框是 disabled，App 也不能送出去",
  );
});

// ---------------------------------------------------------------------------
// 四之二、票種權益：null-inherit，不是聯集
// ---------------------------------------------------------------------------

test("resolveTicketCapabilities: null ＝ 繼承該 registrantType 的預設", () => {
  assert.deepEqual(
    resolveTicketCapabilities({
      registrantType: "ATTENDEE",
      capabilities: null,
    }),
    ["EXHIBITOR_DIRECTORY", "WALLET", "SESSIONS", "POLLS"],
  );
  assert.deepEqual(
    resolveTicketCapabilities({
      registrantType: "EXHIBITOR_REP",
      capabilities: null,
    }),
    [
      "NETWORKING",
      "EXHIBITOR_DIRECTORY",
      "LEADS",
      "WALLET",
      "SESSIONS",
      "POLLS",
    ],
  );
});

test("resolveTicketCapabilities: 空陣列 ＝ 明確不給任何權益（不是繼承）", () => {
  assert.deepEqual(
    resolveTicketCapabilities({ registrantType: "ATTENDEE", capabilities: [] }),
    [],
    "空陣列是最容易寫錯的一格：它與 null 完全相反",
  );
});

test("resolveTicketCapabilities: 有覆寫值時**完全取代**，不是聯集", () => {
  assert.deepEqual(
    resolveTicketCapabilities({
      registrantType: "EXHIBITOR_REP",
      capabilities: ["WALLET"],
    }),
    ["WALLET"],
    "EXHIBITOR_REP 的預設有六項；覆寫只有 WALLET 時，結果就只有 WALLET",
  );
});

test("toggleTicketCapability: 第一次勾選從「目前實際生效」開始加，不是從空集合", () => {
  const next = toggleTicketCapability({
    registrantType: "ATTENDEE",
    current: null,
    capability: "NETWORKING",
  });

  assert.deepEqual(
    next,
    ["NETWORKING", "EXHIBITOR_DIRECTORY", "WALLET", "SESSIONS", "POLLS"],
    "從空集合開始的話，取消一項就會讓其他四項一起消失",
  );
});

test("toggleTicketCapability: 取消一項只少那一項", () => {
  const next = toggleTicketCapability({
    registrantType: "ATTENDEE",
    current: null,
    capability: "WALLET",
  });

  assert.deepEqual(next, ["EXHIBITOR_DIRECTORY", "SESSIONS", "POLLS"]);
});

test("toggleTicketCapability: 回傳值依 TICKET_CAPABILITIES 的順序排序", () => {
  const next = toggleTicketCapability({
    registrantType: "GUEST",
    current: [],
    capability: "POLLS",
  });
  assert.deepEqual(next, ["POLLS"]);

  const withEarly = toggleTicketCapability({
    registrantType: "GUEST",
    current: ["WALLET"],
    capability: "NETWORKING",
  });
  assert.deepEqual(
    withEarly,
    ["NETWORKING", "WALLET"],
    "後端 normalizeCapabilities 也照這個順序排；不排會讓 diff 看起來像改了東西",
  );
});

test("toggleTicketCapability: 取消到一項不剩時是空陣列（明確不給），不是 null", () => {
  let current = null;
  for (const capability of [
    "EXHIBITOR_DIRECTORY",
    "WALLET",
    "SESSIONS",
    "POLLS",
  ]) {
    current = toggleTicketCapability({
      registrantType: "ATTENDEE",
      current,
      capability,
    });
  }

  assert.deepEqual(current, []);
});

// ---------------------------------------------------------------------------
// 五、驗證：與 Web 的 validate() 逐條對齊
// ---------------------------------------------------------------------------
test("空的表單：名稱、顯示名稱、價格都必填", () => {
  const codes = validateTicketTypeForm(form({ price: "" }));
  assert.ok(codes.includes("name_required"));
  assert.ok(codes.includes("display_name_required"));
  assert.ok(codes.includes("price_required"));
});

test("價格非數字或負數 → price_invalid（與 Web 的 isNaN / < 0 相同）", () => {
  assert.ok(
    validateTicketTypeForm(form({ price: "abc" })).includes("price_invalid"),
  );
  assert.ok(
    validateTicketTypeForm(form({ price: "-1" })).includes("price_invalid"),
  );
  assert.equal(
    validateTicketTypeForm(form({ price: "0" })).includes("price_invalid"),
    false,
    "0 是合法價格（免費票）",
  );
});

test("價格三位小數**不在前端擋**——留給後端 400，與 Web 一致", () => {
  assert.equal(
    validateTicketTypeForm(form({ price: "1.234" })).includes("price_invalid"),
    false,
    "Web 不驗小數位數；若 App 搶先擋就變成「Web 放行、App 不放行」",
  );
});

test("隱藏票沒有訪問碼 → access_code_required（Web 同一條）", () => {
  assert.ok(
    validateTicketTypeForm(form({ isHidden: true, accessCode: "" })).includes(
      "access_code_required",
    ),
  );
  assert.equal(
    validateTicketTypeForm(
      form({ isHidden: true, accessCode: "VIP" }),
    ).includes("access_code_required"),
    false,
  );
});

test("初始 Token 非整數在**前端**就擋（Web 會送 NaN → 後端 400 沒有線索）", () => {
  assert.ok(
    validateTicketTypeForm(form({ initialTokens: "abc" })).includes(
      "tokens_invalid",
    ),
  );
  assert.equal(
    validateTicketTypeForm(form({ initialTokens: "" })).includes(
      "tokens_invalid",
    ),
    false,
    "留空是合法的——`buildTicketTypePayload` 會補 0",
  );
});

test("容量非數字被擋，但 0 不被擋（後端 @Min(1) 會 400，與 Web 同一個失敗點）", () => {
  assert.ok(
    validateTicketTypeForm(form({ capacity: "abc" })).includes(
      "capacity_invalid",
    ),
  );
  assert.equal(
    validateTicketTypeForm(form({ capacity: "0" })).includes(
      "capacity_invalid",
    ),
    false,
  );
});

// ---------------------------------------------------------------------------
// 六、二次確認的變動摘要
// ---------------------------------------------------------------------------

test("新建：價格與名額都算「變了」（沒有舊值）", () => {
  const summary = summarizeTicketTypeChanges(
    form({ price: "1500", capacity: "" }),
    null,
  );

  assert.equal(summary.priceChanged, true);
  assert.equal(summary.priceFrom, null);
  assert.equal(summary.priceTo, "1500");
  assert.equal(summary.capacityChanged, true);
  assert.equal(summary.capacityFrom, null);
  assert.equal(summary.capacityTo, null);
});

test("編輯：價格沒改 → 不問；改了 → 帶舊值", () => {
  const existing = {
    id: "tt-1",
    eventId: "evt-1",
    name: "standard",
    displayName: "標準票",
    price: "1500.50",
    currency: "MOP",
    capacity: 100,
    soldCount: 12,
    registrantType: "ATTENDEE",
    isHidden: false,
    initialTokens: 0,
    allowedPaymentMethods: ["FREE"],
    isActive: true,
  };

  const unchanged = summarizeTicketTypeChanges(
    form({ price: "1500.50", capacity: "100" }),
    existing,
  );
  assert.equal(unchanged.priceChanged, false);
  assert.equal(unchanged.capacityChanged, false);

  const changed = summarizeTicketTypeChanges(
    form({ price: "1800", capacity: "80" }),
    existing,
  );
  assert.equal(changed.priceChanged, true);
  assert.equal(changed.priceFrom, "1500.50");
  assert.equal(changed.priceTo, "1800");
  assert.equal(changed.capacityChanged, true);
  assert.equal(changed.capacityFrom, 100);
  assert.equal(changed.capacityTo, 80);
});

test("編輯：名額由「有上限」改成「無限制」也會被問", () => {
  const existing = {
    id: "tt-1",
    eventId: "evt-1",
    name: "standard",
    displayName: "標準票",
    price: "0",
    currency: "MOP",
    capacity: 100,
    soldCount: 0,
    registrantType: "ATTENDEE",
    isHidden: false,
    initialTokens: 0,
    allowedPaymentMethods: ["FREE"],
    isActive: true,
  };

  const summary = summarizeTicketTypeChanges(
    form({ price: "0", capacity: "" }),
    existing,
  );
  assert.equal(summary.capacityChanged, true);
  assert.equal(summary.capacityTo, null);
});

test("編輯：尾零不同（1500.5 vs 1500.50）算「有變動」——寧可多問一次", () => {
  const existing = {
    id: "tt-1",
    eventId: "evt-1",
    name: "standard",
    displayName: "標準票",
    price: "1500.50",
    currency: "MOP",
    capacity: null,
    soldCount: 0,
    registrantType: "ATTENDEE",
    isHidden: false,
    initialTokens: 0,
    allowedPaymentMethods: ["FREE"],
    isActive: true,
  };

  assert.equal(
    summarizeTicketTypeChanges(
      form({ price: "1500.5", capacity: "" }),
      existing,
    ).priceChanged,
    true,
  );
});
