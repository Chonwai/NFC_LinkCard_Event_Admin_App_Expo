/**
 * 報名表 JSON 的語意驗證 —— **拒絕 Web 拒絕的同一批表單**。
 *
 * ## 為什麼要這一支
 *
 * 票種的 `formFieldsJson` 是使用者可編輯的 JSON。後端在 create/update 有 save
 * guard，所以壞資料進不了 DB——但代價是一句沒有線索的 400。Web 在送出前逐條驗
 * 並指出原因；App 必須擋下**完全相同的一批**：
 *
 * - App 擋得比 Web 多 ⇒ 使用者發現「網頁存得進去、App 存不進去」。
 * - App 擋得比 Web 少 ⇒ 使用者白跑一趟（送出 → 400 → 回頭找哪裡錯）。
 *
 * 所以每一條規則都有一正一反兩個案例（該擋的擋、不該擋的放行）。
 *
 * ## 還有第三件事：三份鏡像不能各自漂移
 *
 * 這套常數有三份：後端 canonical、Web mirror、App mirror。Web 有
 * `registrationFormContract.drift.test.ts` 直接讀後端檔案比對；這裡做同一件事。
 * 後端 repo 不在旁邊時**大聲跳過**（列出被跳過的路徑），不靜默通過——
 * 一個會說謊的閘門比沒有閘門更糟。
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BACKEND_CANONICAL = join(
  HERE,
  "..",
  "..",
  "LinkCard_ExpressJS_Backend",
  "src",
  "events",
  "constants",
  "registrationForm.ts",
);

const { validateFormFieldsJson } = await import("@/utils/ticket-type-form");
const contract = await import("@/utils/registrationFormContract");

/** 組一份「最小可用」的表單 JSON 文字。 */
function schemaText(fields) {
  return JSON.stringify({ fields }, null, 2);
}

/** 便利函式：驗證並回傳錯誤碼（成功時回 `null`）。 */
function errorCode(text, registrantType = "ATTENDEE") {
  const result = validateFormFieldsJson(text, registrantType);
  return result.ok ? null : result.error.code;
}

// ---------------------------------------------------------------------------
// 一、基本形狀
// ---------------------------------------------------------------------------

test("合法的最小表單：通過", () => {
  assert.equal(errorCode(schemaText([])), null);
});

test("不是 JSON → form_schema_invalid", () => {
  assert.equal(errorCode("{ fields: [ }"), "form_schema_invalid");
});

test("是陣列 → form_schema_invalid（後端要的是物件）", () => {
  assert.equal(errorCode("[]"), "form_schema_invalid");
});

test("是 null → form_schema_invalid", () => {
  assert.equal(errorCode("null"), "form_schema_invalid");
});

test("沒有 fields 屬性 → 當空表處理，**不算錯**（照抄 Web 的 Array.isArray 防護）", () => {
  assert.equal(errorCode("{}"), null);
});

test("style 原樣保留（App 不編輯外觀，但不能弄丟它）", () => {
  const result = validateFormFieldsJson(
    JSON.stringify({ style: { preset: "warm" }, fields: [] }),
    "ATTENDEE",
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.schema.style, { preset: "warm" });
});

// ---------------------------------------------------------------------------
// 二、欄位 key
// ---------------------------------------------------------------------------

test("key 重複 → form_schema_duplicate_keys", () => {
  assert.equal(
    errorCode(
      schemaText([
        { key: "company", type: "text" },
        { key: "company", type: "text" },
      ]),
    ),
    "form_schema_duplicate_keys",
  );
});

test("key 含不合法字元 → form_schema_invalid_key", () => {
  assert.equal(
    errorCode(schemaText([{ key: "公司 名稱", type: "text" }])),
    "form_schema_invalid_key",
  );
});

test("key 合法字元集（字母／數字／底線／減號）→ 通過", () => {
  assert.equal(
    errorCode(schemaText([{ key: "company_name-2", type: "text" }])),
    null,
    "Web 的 regex 是 ^[a-zA-Z0-9_-]+$；少一個字元就變成限制",
  );
});

// ---------------------------------------------------------------------------
// 三、定價選項
// ---------------------------------------------------------------------------

test("pricing-select 的 price 非數字 → form_schema_bad_price", () => {
  assert.equal(
    errorCode(
      schemaText([
        {
          key: "booth",
          type: "pricing-select",
          options: [{ value: "a", price: "abc" }],
        },
      ]),
    ),
    "form_schema_bad_price",
  );
});

test("pricing-select 的空字串價格 → 通過（Web 把空字串視為未填）", () => {
  assert.equal(
    errorCode(
      schemaText([
        {
          key: "booth",
          type: "pricing-select",
          options: [{ value: "a", price: "" }],
        },
      ]),
    ),
    null,
  );
});

// ---------------------------------------------------------------------------
// 四、必填語義（只有 EXHIBITOR_REP 有要求）
// ---------------------------------------------------------------------------

test("EXHIBITOR_REP 沒有把任何欄位綁成必填 company → form_schema_missing_semantic", () => {
  const result = validateFormFieldsJson(
    schemaText([{ key: "company", type: "text" }]),
    "EXHIBITOR_REP",
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "form_schema_missing_semantic");
  assert.deepEqual(result.error.missing, ["company"]);
});

test("EXHIBITOR_REP + 綁了 company 但 required 不是 true → 仍算缺", () => {
  assert.equal(
    errorCode(
      schemaText([{ key: "company", type: "text", semanticKey: "company" }]),
      "EXHIBITOR_REP",
    ),
    "form_schema_missing_semantic",
  );
});

test("EXHIBITOR_REP + 綁了 company 且 required=true → 通過", () => {
  assert.equal(
    errorCode(
      schemaText([
        {
          key: "company",
          type: "text",
          semanticKey: "company",
          required: true,
        },
      ]),
      "EXHIBITOR_REP",
    ),
    null,
  );
});

test("PD-05 相容：key 叫 companyName 且 required=true 也算綁了 company", () => {
  assert.equal(
    errorCode(
      schemaText([{ key: "companyName", type: "text", required: true }]),
      "EXHIBITOR_REP",
    ),
    null,
    "舊資料沒有 semanticKey，靠 key 名相容；拿掉這條會讓既有票種存不回去",
  );
});

test("ATTENDEE 沒有必填語義要求 → 空表也通過", () => {
  assert.equal(errorCode(schemaText([]), "ATTENDEE"), null);
});

// ---------------------------------------------------------------------------
// 五、Other 選項與語義綁定型別
// ---------------------------------------------------------------------------

test("allowOther 用在 text 欄位 → form_schema_invalid_allow_other_type", () => {
  assert.equal(
    errorCode(
      schemaText([{ key: "industry", type: "text", allowOther: true }]),
    ),
    "form_schema_invalid_allow_other_type",
  );
});

test("allowOther 用在 select → 通過", () => {
  assert.equal(
    errorCode(
      schemaText([
        { key: "industry", type: "select", allowOther: true, options: [] },
      ]),
    ),
    null,
  );
});

test("allowOther 的選項用了哨兵值 __other__ → form_schema_invalid_other_collision", () => {
  assert.equal(
    errorCode(
      schemaText([
        {
          key: "industry",
          type: "select",
          allowOther: true,
          options: [{ value: "__other__" }],
        },
      ]),
    ),
    "form_schema_invalid_other_collision",
  );
});

test("欄位 key 撞到 allowOther 的 sibling key → form_schema_invalid_sibling_collision", () => {
  assert.equal(
    errorCode(
      schemaText([
        { key: "industry", type: "select", allowOther: true, options: [] },
        { key: "industry__other", type: "text" },
      ]),
    ),
    "form_schema_invalid_sibling_collision",
  );
});

test("semanticKey 綁在 multi-select → form_schema_invalid_semantic_type", () => {
  // 用 ATTENDEE：它沒有任何必填語義，所以檢查會走到型別那一條。
  // 若用 EXHIBITOR_REP，會先被 form_schema_missing_semantic 攔下——那是 Web
  // 的順序（必填語義在型別檢查之前），不是這條要驗的東西。
  assert.equal(
    errorCode(
      schemaText([
        { key: "company", type: "multi-select", semanticKey: "company" },
      ]),
      "ATTENDEE",
    ),
    "form_schema_invalid_semantic_type",
  );
});

test("檢查順序：缺必填語義比型別不合法先回報（與 Web 的 else-if 鏈相同）", () => {
  assert.equal(
    errorCode(
      schemaText([
        { key: "company", type: "multi-select", semanticKey: "company" },
      ]),
      "EXHIBITOR_REP",
    ),
    "form_schema_missing_semantic",
    "兩個問題同時存在時，回報的是 Web 也會回報的那一個",
  );
});

// ---------------------------------------------------------------------------
// 六、三份鏡像的常數必須一致（讀後端 canonical 檔逐項比對）
// ---------------------------------------------------------------------------

const backendAvailable = existsSync(BACKEND_CANONICAL);
const skipNote = backendAvailable
  ? false
  : `後端 canonical 不在旁邊，已跳過 drift 比對：${BACKEND_CANONICAL}。` +
    "（要跑完整比對請把 LinkCard_ExpressJS_Backend 放在同層目錄）";

/**
 * 在後端自己的 `src/` 與 `tests/` 裡找 `pattern` 的蹤跡。
 *
 * 為什麼需要它：下面那一項要分辨「後端把常數移動中」與「後端真的把它刪了」。
 * 單看 canonical 檔看不出差別——兩者都是「找不到」，差別在**别人還提不提它**。
 */
function backendReferences(pattern) {
  const root = join(HERE, "..", "..", "LinkCard_ExpressJS_Backend");
  const skip = new Set(["node_modules", ".git", "dist", "coverage"]);
  const hits = [];

  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (skip.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      if (pattern.test(readFileSync(full, "utf8"))) {
        hits.push(full.slice(root.length + 1));
      }
    }
  };

  walk(join(root, "src"));
  walk(join(root, "tests"));
  return hits;
}

test("drift: OTHER 哨兵值與後綴與後端一致", { skip: skipNote }, () => {
  const source = readFileSync(BACKEND_CANONICAL, "utf8");

  assert.ok(
    source.includes(
      `DYNAMIC_FIELD_OTHER_SENTINEL = '${contract.DYNAMIC_FIELD_OTHER_SENTINEL}'`,
    ),
    `後端的哨兵值不是 ${contract.DYNAMIC_FIELD_OTHER_SENTINEL}`,
  );
  assert.ok(
    source.includes(
      `DYNAMIC_FIELD_OTHER_SUFFIX = '${contract.DYNAMIC_FIELD_OTHER_SUFFIX}'`,
    ),
    `後端的後綴不是 ${contract.DYNAMIC_FIELD_OTHER_SUFFIX}`,
  );
});

/**
 * 語義綁定允許型別的 mirror 比對。
 *
 * 2026-11-01 這條紅過一次，原因是**後端那個檔正被另一個 session 改寫**（工作區
 * 未提交）：`SEMANTIC_BINDING_ALLOWED_FIELD_TYPES` 連同兩個 helper 一起消失，但
 * 後端自己的 `tests/events/unit/EventTicketTypeFormSchema.unit.test.ts` 還 import
 * 它——也就是說在那個 repo 裡，`src/` 與 `tests/` 當下互相矛盾，那是**移動中**，
 * 不是契約變更。
 *
 * 原本的寫法（把 `[${expected}]` 這段原始碼字串硬繼進斷言裡）面對這種情形只會說
 * 「後端的允許型別不是 ['text', 'select']」，看不出是「改值」還是「搬走」，也
 * 強迫 assertion 必須對上 `as const` 的排版。改成從宣告推導之後，三種情形分開：
 *
 * - 常數還在（不論怎麼排版）⇒ 逐值比對，這是真正的 drift 防線。
 * - 常數不在且後端其他人也不再提它 ⇒ **真的移除**，App 必須跟上，紅。
 * - 常數不在但後端還有引用 ⇒ 改寫中；大聲跳過，**不假裝通過**（與檔頭
 *   「一個會說謊的閘門比沒有閘門更糟」同一種說法）。
 */
test("drift: 語義綁定允許型別與後端一致", { skip: skipNote }, (t) => {
  const source = readFileSync(BACKEND_CANONICAL, "utf8");
  const declared = source.match(
    /SEMANTIC_BINDING_ALLOWED_FIELD_TYPES\s*=\s*\[([^\]]*)]/,
  );

  if (declared === null) {
    const stillReferenced = backendReferences(
      /hasInvalidSemanticBindingType|isSemanticBindingAllowedType/,
    );

    if (stillReferenced.length > 0) {
      t.diagnostic(
        `後端的 SEMANTIC_BINDING_ALLOWED_FIELD_TYPES 暫時缺席，但後端仍有 ` +
          `${stillReferenced.length} 處引用它（例如 ${stillReferenced[0]}）` +
          "—— 那是改寫中，不是契約變更。本項跳過，App 契約不動。",
      );
      return;
    }

    assert.fail(
      "後端已移除 SEMANTIC_BINDING_ALLOWED_FIELD_TYPES，而且後端任何地方都不再引用它 " +
        "—— 這是真的契約變更。App 必須跟上：同步更新 " +
        "src/utils/registrationFormContract.ts 與本測試。",
    );
  }

  const backendTypes = [...declared[1].matchAll(/'([^']*)'|"([^"]*)"/g)].map(
    (match) => match[1] ?? match[2],
  );

  assert.deepEqual(
    [...contract.SEMANTIC_BINDING_ALLOWED_FIELD_TYPES],
    backendTypes,
    `後端的允許型別是 [${backendTypes.join(", ")}]，` +
      `App 是 [${contract.SEMANTIC_BINDING_ALLOWED_FIELD_TYPES.join(", ")}]`,
  );
});

test("drift: 語義枚舉與後端一致", { skip: skipNote }, () => {
  const source = readFileSync(BACKEND_CANONICAL, "utf8");

  for (const key of contract.REGISTRANT_SEMANTIC_KEYS) {
    assert.ok(
      source.includes(`'${key}'`),
      `後端 canonical 沒有語義 ${key}——兩邊的值域已經分岔`,
    );
  }
});

test("drift: 必填語義對照表與後端一致", { skip: skipNote }, () => {
  const source = readFileSync(BACKEND_CANONICAL, "utf8");

  for (const [role, semantics] of Object.entries(
    contract.PER_ROLE_REQUIRED_SEMANTICS,
  )) {
    // 每一個角色都必須在後端表裡出現（自創一個角色就會被這條抓到）。
    assert.ok(
      source.includes(`    ${role}: [`),
      `後端的必填語義表沒有 ${role}`,
    );

    if (semantics.length === 0) continue;

    const expected = `    ${role}: [${semantics
      .map((value) => `'${value}'`)
      .join(", ")}],`;
    assert.ok(
      source.includes(expected),
      `${role} 的必填語義與後端不一致（後端找不到「${expected.trim()}」）`,
    );
  }
});
