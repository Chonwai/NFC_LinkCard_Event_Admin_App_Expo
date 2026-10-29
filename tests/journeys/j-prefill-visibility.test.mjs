/**
 * J-PREFILL-VISIBILITY — 現場代填在「建帳預填鏈」上的 **AdminApp 端契約**。
 *
 * 層級：unit（Node 內建 test runner；純函式 ＋ 原始碼不變式）。Persona：`staff-onsite`
 * （阿聰，已授權現場工作人員）。
 *
 * 規格依據：
 * - `event-visitor-flow-v1/14-…md § 2.1`（三條 prefill 路徑）＋ `§ 5.1`（builder 的輸入面）。
 * - `BE-13`／`BE-14`：`buildPrefillLinks(input)` 的 `input` **只**由「報名時實際送出的欄位」
 *   決定 ⇒ **ADM 送什麼，BE 就只可能預填什麼**。本檔釘住 ADM 這一半。
 * - `X-23`：名片連結一律取 BE 回傳的完整 `profileUrl`，App 不以自己的 origin 重組
 *   （`nfc-bind.tsx` 的寫卡 payload 是 `ctx.profileUrl?.trim() ?? ""`）。
 *
 * 反例探針（哪條會紅）：
 * - `P-1`：`buildWalkInRegistrationBody` 若開始夾帶 prefill 專屬欄位
 *   （`website`／`includePhone`／`links`）⇒ 第 1 條紅。
 * - `P-2`：選填欄位若由 `undefined` 改成 `""` ⇒ 第 2 條紅（空字串讓「有沒有填」失去可判別性）。
 * - `P-3`：`nfc-bind.tsx` 若改回在 App 內組 origin ⇒ 第 4 條紅。
 *
 * **已知界線（`02-test-design-and-research.md §1.3`）**：AdminApp 沒有 jsdom／RN renderer，
 * 本檔只能覆蓋純邏輯與原始碼不變式；NFC 讀寫、相機、導航仍為 E2E-only 缺口。
 *
 * **計畫與現實的差異（本輪實測，已於交付報告申報）**：計畫 §4.5 的 `T-ADM-01` 假設
 * 「profile 回應含 `profileUrl` 與 **`links` 摘要**，走純函式映射成顯示清單」。實測
 * `grep -rn links src` ＝ **0 命中**，且 BE `EventRegistrationService.getRegistrationByCode`
 * 的回應只有 `profileUrl`（`:1197`）、**沒有** `links` ⇒ **ADM 沒有這個介面、BE 也沒有這個欄位**。
 * 本檔因此改為釘住**實際存在**的那條契約：ADM 送出的報名 payload 就是 BE 預填的全部輸入，
 * 且 ADM 不得自行夾帶 prefill 專屬欄位（第 1 條）與不得自行組名片 origin（第 4 條）。
 *
 * 執行：`npm test`（glob 已含 `tests/journeys/*.test.mjs`；需 Node ≥ 22.3）。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { buildWalkInRegistrationBody } from "@/utils/walk-in-payload";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

function sourceOf(relativePath) {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

const NFC_BIND_SOURCE = sourceOf("src/app/(auth)/[eventId]/nfc-bind.tsx");
const DESK_HANDOFF_SOURCE = sourceOf("src/utils/desk-handoff.ts");
const API_TYPES_SOURCE = sourceOf("src/types/api.types.ts");

/**
 * `buildWalkInRegistrationBody` 的欄位集合（**凍結字面值**，`02 §2.1 C7`）。
 * ADM 的 walk-in payload 是 BE prefill 的輸入面；多一個欄位就是 ADM 替 BE 決定了
 * 一件它不該決定的事（例如 `includePhone`／`links`）。
 */
const FROZEN_WALK_IN_PAYLOAD_KEYS = [
  "company",
  "consent",
  "email",
  "firstName",
  "lastName",
  "phone",
  "ticketTypeId",
];

describe("J-PREFILL-VISIBILITY 建帳後名片連結可見 [persona:staff-onsite]", () => {
  it("given 現場代填已填必填與選填欄位, when 組出送出 payload, then 欄位集合與凍結清單逐字相等（ADM 不夾帶 prefill 專屬欄位）", () => {
    const body = buildWalkInRegistrationBody({
      ticketId: "t1",
      email: "a@b.co",
      firstName: "阿",
      lastName: "聰",
      phone: "+85360000000",
      company: "LinkCard",
    });

    assert.deepEqual(Object.keys(body).sort(), FROZEN_WALK_IN_PAYLOAD_KEYS);
  });

  it("given 選填欄位留空, when 組出送出 payload, then 以 undefined 帶出（BE 端 ?.trim() || null 才判得出「沒填」）", () => {
    const body = buildWalkInRegistrationBody({
      ticketId: "t1",
      email: "a@b.co",
      firstName: "阿",
      lastName: "聰",
      phone: "   ",
      company: "   ",
    });

    assert.deepEqual([body.phone, body.company], [undefined, undefined]);
    assert.equal("phone" in body, true);
    assert.equal("company" in body, true);
  });

  it("given 必填 email 有前後空白, when 組出送出 payload, then email 為 trim 後的值（BE 建 EMAIL link 的唯一來源）", () => {
    const body = buildWalkInRegistrationBody({
      ticketId: "t1",
      email: "  a@b.co  ",
      firstName: "阿",
      lastName: "聰",
      phone: "",
      company: "",
    });

    assert.equal(body.email, "a@b.co");
  });

  it("given nfc-bind 螢幕, when 讀原始碼, then 卡面 URL 只由 buildCardPayloadUrl 單一來源組裝（X-23 書面例外；INC-3）", () => {
    // X-23 的實作落點自 Loop AB · Batch A REPAIR R1 起移到 `@/utils/desk-handoff`
    // （畫面檔只剩接線，見 `M-03`）。
    assert.match(DESK_HANDOFF_SOURCE, /registration\.profileUrl/);
    assert.match(
      NFC_BIND_SOURCE,
      /from "@\/utils\/desk-handoff"/,
      "nfc-bind 沒有接上交棒純邏輯模組",
    );
    // `INC-3`（Loop AF）書面例外：卡面 URL 由 `nfc-utils` 以 config 的
    // WEB_BASE_URL 單一來源組裝——BE 沒有「已知 UID 就能回卡面 URL」的服務端點，
    // tagUid 必須感應當下讀取。X-23 的精神（不在畫面散落多份 origin）不變：畫面
    // 只呼叫這一個 builder。
    //
    // 2026-10-30：builder 是 `chooseCardPayloadUrl`——有公開名片就寫
    // `/p/{slug}?e={eventId}`，沒有的話才退回 `/t/{eventId}/{tagUid}`。守的仍然是
    // 「畫面不得自己拼網址」，只是嫩法多了主／保底兩種。
    assert.match(
      NFC_BIND_SOURCE,
      /chooseCardPayloadUrl\(\{/,
      "nfc-bind 未使用 chooseCardPayloadUrl 單一來源",
    );
    assert.equal(
      /buildRegistrationProfileUrl\s*\(/.test(
        NFC_BIND_SOURCE + DESK_HANDOFF_SOURCE,
      ),
      false,
      "不得自行組裝名片 origin（X-23）",
    );
  });

  it("given ADM 的 by-code 回應型別, when 讀原始碼, then 有 profileUrl 而無 links 摘要（計畫 T-ADM-01 的前提不成立，據實釘住）", () => {
    assert.match(API_TYPES_SOURCE, /profileUrl\?: string \| null;/);
    assert.equal(
      /\blinks\b/.test(API_TYPES_SOURCE),
      false,
      "BE 的 by-code 回應沒有 links 摘要；ADM 端不應出現 links 欄",
    );
  });
});
