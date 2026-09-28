/**
 * CHARACTERIZATION — pins CURRENT behaviour; see FINDING-S6-4.
 *
 * `fd3c697`（2026-09-28）把 `nfc-bind.tsx` 的預設寫卡類型由 `WRISTBAND` 改成 `CARD`，
 * 並把 `BADGE_TYPES` 的順序由 `WRISTBAND → CARD → QR_ONLY` 改成
 * `CARD → WRISTBAND → QR_ONLY`。commit message 只寫 `badge postion`，**未申報**。
 *
 * 依 R-12：
 * - 預設值**不得自行回改**（`CARD` 可能是早間談定的），標 `[NEEDS-PM]`；
 * - 但必須為它寫 characterization，鎖住現狀，使「若 PM 決定改回，測試會提醒」。
 *
 * ⇒ `src/app/(auth)/[eventId]/nfc-bind.tsx` **product code 零改動**；本檔只描述現狀。
 * 有現場寫錯卡型的風險（工作人員照預設值寫卡 ⇒ 卡型與實物不符），已列
 * `[NEEDS-PM]`／`ESC-D1-003`。
 *
 * 為何是原始碼掃描而不是載入模組：`nfc-bind.tsx` 是 RN 螢幕元件，純 Node 下載不進來
 * （同 `button-focus-ring.test.mjs` / `count-display.test.mjs` 的既有做法），
 * 且本檔的目的正是「不改產品碼也能鎖住現狀」。
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
  path.join(REPO_ROOT, "src/app/(auth)/[eventId]/nfc-bind.tsx"),
  "utf8",
);

/** `BADGE_TYPES` 陣列原文；錨點消失時讓測試自己說出來，不要靜默切出空字串。 */
function badgeTypesSource() {
  const start = SOURCE.indexOf("const BADGE_TYPES");
  assert.ok(start >= 0, "找不到 const BADGE_TYPES");
  const end = SOURCE.indexOf("];", start);
  assert.ok(end > start, "找不到 BADGE_TYPES 的結尾");
  return SOURCE.slice(start, end);
}

test("CHARACTERIZATION（S6④）：預設寫卡類型為 CARD（fd3c697 改的；未經 PM 裁定）", () => {
  assert.match(SOURCE, /useState<BadgeType>\("CARD"\)/);
});

test("CHARACTERIZATION（S6④）：預設值不得同時是 WRISTBAND（改回時本檔必紅）", () => {
  assert.equal(/useState<BadgeType>\("WRISTBAND"\)/.test(SOURCE), false);
});

test("CHARACTERIZATION（S6④）：BADGE_TYPES 的三值集合與順序為 CARD → WRISTBAND → QR_ONLY", () => {
  const keys = [...badgeTypesSource().matchAll(/key:\s*"([A-Z_]+)"/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(keys, ["CARD", "WRISTBAND", "QR_ONLY"]);
});

test(
  "應然：預設寫卡類型由 PM 裁定（維持 CARD 或改回 WRISTBAND）後再固化",
  { todo: true },
  () => {},
);
