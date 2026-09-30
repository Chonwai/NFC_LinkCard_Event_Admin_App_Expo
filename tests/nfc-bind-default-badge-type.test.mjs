/**
 * `X-27`（**已裁定**）— 預設寫卡類型的固化契約。
 *
 * 沿革：`fd3c697`（2026-09-28）把 `nfc-bind.tsx` 的預設寫卡類型由 `WRISTBAND`
 * 改成 `CARD`，並把 `BADGE_TYPES` 的順序改成 `CARD → WRISTBAND → QR_ONLY`；
 * commit message 只寫 `badge postion`，**未申報**這是產品行為變更。本檔最初
 * （`fd2319c`）是為此而寫的 `CHARACTERIZATION` ＋ `it.todo`。
 *
 * **2026-09-30 `X-27` 裁定**（PM 將決定委由工程以工程判斷裁定）：**維持 `CARD`**，
 * 但固化方式被指定為：
 * 1. 值落在 `src/constants/nfc.ts` 的 `DEFAULT_BADGE_TYPE`（單一具名常數）；
 * 2. `nfc-bind.tsx` 的 `useState<BadgeType>()` 必須**引用該常數**，不得寫回字面值；
 * 3. `BADGE_TYPES` 的順序維持 `CARD → WRISTBAND → QR_ONLY`（首選＝預設）。
 *
 * ⇒ 本檔由 characterization 轉為**正式契約**，並依 `02 §2.1 C7`：期望值凍結成字面值，
 * **同時**以 import 進來的常數反向斷言「實作常數 == 凍結值」；常數被誤改、
 * 或畫面寫回字面值，兩者都會讓本檔變紅。
 *
 * 為何既有三條仍是原始碼掃描而不是載入模組：`nfc-bind.tsx` 是 RN 螢幕元件，純 Node
 * 下載不進來（同 `button-focus-ring.test.mjs` / `count-display.test.mjs` 的既有做法）。
 * **但常數本身可以真的 import**（`tests/alias-loader.mjs` 提供 `@/` 別名），
 * 所以「值」不再用文字比對，而是斷言常數本身。
 *
 * 執行（repo 根目錄，需 alias loader 才能 import `@/constants/nfc`）：
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { DEFAULT_BADGE_TYPE } from "@/constants/nfc";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const SOURCE = readFileSync(
  path.join(REPO_ROOT, "src/app/(auth)/[eventId]/nfc-bind.tsx"),
  "utf8",
);
const CONSTANTS_SOURCE = readFileSync(
  path.join(REPO_ROOT, "src/constants/nfc.ts"),
  "utf8",
);

/** 凍結值（`02 §2.1 C7`）：`X-27` 裁定的目標值，不從受測模組推導。 */
const FROZEN_DEFAULT_BADGE_TYPE = "CARD";

/** `BADGE_TYPES` 陣列原文；錨點消失時讓測試自己說出來，不要靜默切出空字串。 */
function badgeTypesSource() {
  const start = SOURCE.indexOf("const BADGE_TYPES");
  assert.ok(start >= 0, "找不到 const BADGE_TYPES");
  const end = SOURCE.indexOf("];", start);
  assert.ok(end > start, "找不到 BADGE_TYPES 的結尾");
  return SOURCE.slice(start, end);
}

test("X-27 已裁定：預設寫卡類型常數 DEFAULT_BADGE_TYPE 為 CARD（常數被誤改 ⇒ 本條變紅）", () => {
  assert.equal(DEFAULT_BADGE_TYPE, FROZEN_DEFAULT_BADGE_TYPE);
});

test("X-27 已裁定：nfc-bind 的 useState 以常數初始化，不寫回字面值", () => {
  assert.match(SOURCE, /useState<BadgeType>\(DEFAULT_BADGE_TYPE\)/);
});

test("X-27 已裁定：預設值不再是硬編字面值（寫死 CARD 或改回 WRISTBAND 皆變紅）", () => {
  assert.equal(/useState<BadgeType>\(\s*"[A-Z_]+"\s*\)/.test(SOURCE), false);
});

test("X-27 已裁定：BADGE_TYPES 的三值集合與順序為 CARD → WRISTBAND → QR_ONLY", () => {
  const keys = [...badgeTypesSource().matchAll(/key:\s*"([A-Z_]+)"/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(keys, ["CARD", "WRISTBAND", "QR_ONLY"]);
});

test("X-27 已裁定：BADGE_TYPES 的首選項＝預設值（順序與預設不得各自漂移）", () => {
  const keys = [...badgeTypesSource().matchAll(/key:\s*"([A-Z_]+)"/g)].map(
    (match) => match[1],
  );
  assert.equal(keys[0], DEFAULT_BADGE_TYPE);
});

test("應然（X-27 已裁定）：預設值只存在於 src/constants/nfc.ts 一處，畫面以 import 引用它", () => {
  assert.match(CONSTANTS_SOURCE, /export const DEFAULT_BADGE_TYPE\b/);
  assert.equal(
    /const\s+DEFAULT_BADGE_TYPE\s*=/.test(SOURCE),
    false,
    "nfc-bind.tsx 不得自行宣告預設值（必須由 @/constants/nfc 提供）",
  );
  assert.match(SOURCE, /from\s+"@\/constants\/nfc"/);
});
