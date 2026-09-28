/**
 * ADM 票種 `Pressable` 群組的迴歸鎖（S6②）。
 *
 * 規格逐字禁止：`10-admin-app-engineering-spec.md:362` § 2.2 ④#5
 * 「❌ 不要改 `walk-in.tsx:196-205` 的票種 `Pressable` 群組（那是 `ticketId`，
 * 與 consent 無關）」。`35fdc42` 仍把它改寫（`type.label`→`type.caption`、加
 * `numberOfLines={1}`、`brandSoft`→`brandSoftStrong`、票種變成小尺寸 chip），
 * 而 D1 於 09-28 複查時發現它**仍在**——原因就是沒有任何可執行的鎖。
 *
 * 本檔把該規則變成斷言，同時鎖住**必須保留**的那一半：根 `View` 不再自己套
 * `insets.top`（改由 `ScreenHeader` 處理）；舊碼是雙重 inset。
 *
 * 為何是原始碼掃描：`walk-in.tsx` 是 RN 螢幕元件，純 Node 下載不進來
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

/** 以兩個穩定錨點夾出票種區塊；錨點消失時讓測試自己說出來，不要靜默切片。 */
function region(startAnchor, endAnchor) {
  const start = SOURCE.indexOf(startAnchor);
  const end = SOURCE.indexOf(endAnchor);
  assert.ok(start >= 0, `錨點不存在：${startAnchor}`);
  assert.ok(end > start, `錨點順序不對：${endAnchor}`);
  return SOURCE.slice(start, end);
}

const TICKET_GROUP = region(
  "copy.checkIn.walkInTicket",
  "copy.checkIn.walkInEmail",
);
const STYLES = SOURCE.slice(SOURCE.indexOf("const styles = StyleSheet.create"));

test("S6②：票種 Pressable 群組不得使用 numberOfLines（截斷會讓長票種名看不全）", () => {
  assert.equal(/numberOfLines/.test(TICKET_GROUP), false);
});

test("S6②：票種標籤使用 type.label（不得被改成較小的 type.caption）", () => {
  assert.match(TICKET_GROUP, /<Text style=\{type\.label\}>\{label\}<\/Text>/);
  assert.equal(/type\.caption/.test(TICKET_GROUP), false);
});

test("S6②：票種選中態的背景是 brandSoft（不得被改成 brandSoftStrong）", () => {
  assert.match(
    STYLES,
    /ticketOn:\s*\{[^}]*backgroundColor:\s*semantic\.bg\.brandSoft,/,
  );
  assert.equal(/brandSoftStrong/.test(SOURCE), false);
});

test("S6②：改寫時新增的 ticketBlock／ticketLabelOn 樣式必須不存在", () => {
  assert.equal(/\bticketBlock:/.test(SOURCE), false);
  assert.equal(/\bticketLabelOn:/.test(SOURCE), false);
});

test("ScreenHeader inset 修正必須保留：根 View 不再自己套 insets.top", () => {
  assert.match(SOURCE, /<View style=\{styles\.screen\}>/);
  assert.equal(/paddingTop:\s*insets\.top/.test(SOURCE), false);
});
