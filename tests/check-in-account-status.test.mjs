/**
 * `WP-R2`（Loop AF R2）：報到結果卡的「LinkCard 帳號」列——三態＋缺欄降級。
 *
 * 為什麼需要這一支：PM 裁定（`OQ-2`）現場要看得出「有沒有激活 LinkCard 帳號」；
 * `02-plan-loop-af.md` §A-2(3) 指定 `checkIn` 回 `isActivated: boolean|null`
 * （`null`＝無 user），ADM 端欄位缺省（舊 BE 未部署）時**自動降級為二態**。
 * AdminApp 沒有渲染層測試（`node:test`，無 jsdom／RN renderer），因此以兩層鎖住
 * （同 `check-in-valid-hold.test.mjs`／`lookup-timeout.test.mjs` 的既有做法）：
 * 1) 行為層——`getCheckInAccountStatusLabel` 的三態＋降級直接在 Node 下執行。
 * 2) 接線層——`check-in.tsx` 真的把該列接上（讀 `outcome.registration.isActivated`、
 *    以 `copy.checkIn.accountLabel` 當標籤、`null` 時不渲染）。
 *
 * 反例探針（RED→GREEN 實測見 `06-execute-r2-isactivated.md`）：
 * - 把 `undefined` 併進 `null`（降級失效、舊 BE 誤顯「未建檔」）⇒ 第 1 條必紅。
 * - 把降級 guard 反轉（`!= null` → `== null`）⇒ 接線條必紅。
 * - 把接線改成讀別的欄位 ⇒ 接線條必紅。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { copy } from "@/constants/copy.zh-TW";
import { getCheckInAccountStatusLabel } from "@/utils/check-in-display";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const CHECK_IN = readFileSync(
  path.join(REPO_ROOT, "src/app/(auth)/[eventId]/check-in.tsx"),
  "utf8",
);

test("WP-R2 三態：undefined＝降級不渲染；null＝未建檔；false＝已建檔（未激活）；true＝已激活", () => {
  // 缺欄（舊 BE 未部署此欄位）⇒ null＝整列不渲染。
  // 不得把「未知」畫成任一種狀態（同 count-display 的「未知 ≠ 零」）。
  assert.equal(getCheckInAccountStatusLabel(undefined), null);
  // 無 user ⇒「未建檔」。
  assert.equal(
    getCheckInAccountStatusLabel(null),
    copy.checkIn.accountNotRegistered,
  );
  // 有 user、未驗證 ⇒「已建檔（未激活）」。
  assert.equal(
    getCheckInAccountStatusLabel(false),
    copy.checkIn.accountRegisteredNotActivated,
  );
  // 已驗證 ⇒「已激活」。
  assert.equal(
    getCheckInAccountStatusLabel(true),
    copy.checkIn.accountActivated,
  );

  // 三態文案互異、非空：同一個值不得看起來像兩種狀態。
  const labels = new Set([
    copy.checkIn.accountNotRegistered,
    copy.checkIn.accountRegisteredNotActivated,
    copy.checkIn.accountActivated,
  ]);
  assert.equal(labels.size, 3, "三態文案有重複——現場無法分辨狀態");
  for (const label of labels) {
    assert.ok(label.trim().length > 0, "三態文案不得為空");
  }
  // 「未建檔」與「未激活」不得同字串（語意不同的處置）。
  assert.notEqual(
    copy.checkIn.accountNotRegistered,
    copy.checkIn.accountRegisteredNotActivated,
  );
});

test("WP-R2 文案：標籤與三態值逐字鎖定（用語對齊平台既有文案）", () => {
  assert.equal(copy.checkIn.accountLabel, "LinkCard 帳號");
  assert.equal(copy.checkIn.accountNotRegistered, "未建檔");
  assert.equal(copy.checkIn.accountRegisteredNotActivated, "已建檔（未激活）");
  assert.equal(copy.checkIn.accountActivated, "已激活");
});

test("WP-R2 接線：帳號列讀 isActivated、以 accountLabel 當標籤、null 時不渲染", () => {
  // 讀取來源必須是 outcome.registration.isActivated（checkIn 回應欄位）。
  assert.match(
    CHECK_IN,
    /getCheckInAccountStatusLabel\(outcome\.registration\.isActivated\)/,
    "帳號列沒有讀 checkIn 回應的 isActivated（讀錯來源＝顯示別的狀態）",
  );

  // 標籤與值真的上了畫面；且只渲染一次（不得有第二條未受控路徑）。
  assert.match(
    CHECK_IN,
    /label=\{copy\.checkIn\.accountLabel\}/,
    "帳號列標籤未接上",
  );
  assert.match(CHECK_IN, /value=\{accountStatusLabel\}/, "帳號列值未接上");
  const labelUses = CHECK_IN.match(/copy\.checkIn\.accountLabel/g) ?? [];
  assert.equal(labelUses.length, 1, "accountLabel 只允許一處渲染");

  // 降級 guard：label 為 null（缺欄）時整列不渲染。
  const rowStart = CHECK_IN.indexOf("accountStatusLabel != null");
  assert.ok(
    rowStart >= 0,
    "帳號列缺 `accountStatusLabel != null` guard——舊 BE 缺欄時會渲染空列（降級失效）",
  );
  const rowBlock = CHECK_IN.slice(rowStart, rowStart + 260);
  assert.match(
    rowBlock,
    /copy\.checkIn\.accountLabel/,
    "guard 區塊內找不到帳號列",
  );

  // 緊鄰「名片」列（§A-2(2)：成功態資訊列的既定順序——名片之後）。
  const profileAt = CHECK_IN.indexOf("label={copy.checkIn.profileLabel}");
  const accountAt = CHECK_IN.indexOf("label={copy.checkIn.accountLabel}");
  assert.ok(profileAt >= 0, "找不到名片列（切片端點失效會讓本條空轉）");
  assert.ok(
    accountAt > profileAt,
    "帳號列必須緊鄰名片列（名片之後）；不在同一資訊面板＝現場掃視順序走樣",
  );
});
