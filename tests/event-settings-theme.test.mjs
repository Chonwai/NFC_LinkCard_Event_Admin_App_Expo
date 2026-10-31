/**
 * `configJson.theme` 的讀寫鎖——**以 Web `settings/page.tsx` 的行為為基準**，
 * 除了兩處已記錄的刻意差異。
 *
 * ## 最重要的一條：`theme.backgroundColor` / `theme.textColor` 不能掉
 * Web 的 `handleSaveTheme` 是把整個 `theme` 換掉：
 *
 * ```ts
 * theme: { primaryColor, primaryHoverColor, darkMode }
 * ```
 *
 * 但 `EventTheme` 還有 `backgroundColor` 與 `textColor`，而
 * `LinkCard_Frontend/components/event/EventThemeProvider.tsx:26,35` **真的在用**
 * 它們（`--brand-bg`、品牌文字色 → 公開報名頁的外觀）。
 *
 * 也就是說：在 Web 設定頁改一次主色，這兩個值就沒了，而且是靜默的。
 * App 改成 `{ ...existingTheme, ... }`。下面有測試專門釘住這件事——
 * 沒有這條，改回「整個換掉」也不會有人發現。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildConfigWithTheme,
  isValidHexColor,
  THEME_DEFAULT_HOVER,
  THEME_DEFAULT_PRIMARY,
  toThemeForm,
} from "@/utils/event-settings-config";

// ---------------------------------------------------------------------------
// 讀：configJson → 表單
// ---------------------------------------------------------------------------

test("沒有 theme 時填 Web 的預設色（不是留空白）", () => {
  assert.deepEqual(toThemeForm(null), {
    primaryColor: THEME_DEFAULT_PRIMARY,
    primaryHoverColor: THEME_DEFAULT_HOVER,
    darkMode: false,
  });
  assert.equal(THEME_DEFAULT_PRIMARY, "#7c3aed");
  assert.equal(THEME_DEFAULT_HOVER, "#6d28d9");
});

test("有 theme 時原樣讀出三個值", () => {
  const form = toThemeForm({
    theme: {
      primaryColor: "#123456",
      primaryHoverColor: "#654321",
      darkMode: true,
    },
  });
  assert.deepEqual(form, {
    primaryColor: "#123456",
    primaryHoverColor: "#654321",
    darkMode: true,
  });
});

test("theme 只設了主色時，其餘兩項各自走預設", () => {
  const form = toThemeForm({ theme: { primaryColor: "#abcdef" } });
  assert.deepEqual(form, {
    primaryColor: "#abcdef",
    primaryHoverColor: THEME_DEFAULT_HOVER,
    darkMode: false,
  });
});

// ---------------------------------------------------------------------------
// 寫：表單 → configJson
// ---------------------------------------------------------------------------

test("⚠️ 存主題時 theme.backgroundColor / textColor 必須還在", () => {
  // 這是 Web 的缺陷所在：它把整個 theme 換掉，這兩個值會消失。
  const config = {
    theme: {
      primaryColor: "#111111",
      primaryHoverColor: "#222222",
      darkMode: false,
      backgroundColor: "#fafafa",
      textColor: "#101010",
    },
  };
  const next = buildConfigWithTheme(config, {
    primaryColor: "#7c3aed",
    primaryHoverColor: "#6d28d9",
    darkMode: true,
  });

  assert.equal(next.theme.backgroundColor, "#fafafa");
  assert.equal(next.theme.textColor, "#101010");
  // 被編輯的三個照樣更新
  assert.equal(next.theme.primaryColor, "#7c3aed");
  assert.equal(next.theme.darkMode, true);
});

test("存主題時 bankDetails 不得被清掉（後端整包覆蓋 configJson）", () => {
  const config = {
    bankDetails: { accountName: "LinkCard Ltd", bankName: "HSBC" },
  };
  const next = buildConfigWithTheme(config, {
    primaryColor: "#7c3aed",
    primaryHoverColor: "#6d28d9",
    darkMode: false,
  });

  assert.deepEqual(next.bankDetails, config.bankDetails);
});

test("清空顏色欄位＝移除該鍵（Web 的 || undefined 語意）", () => {
  const next = buildConfigWithTheme(
    { theme: { primaryColor: "#111111" } },
    { primaryColor: "", primaryHoverColor: "", darkMode: false },
  );

  // 送出去時 JSON.stringify 會丟掉 undefined，等於把鍵移除，
  // EventThemeProvider 於是回到推導值。
  assert.equal(next.theme.primaryColor, undefined);
  assert.equal(next.theme.primaryHoverColor, undefined);
  assert.equal(next.theme.darkMode, false);
});

test("darkMode 即使關閉也要明確寫入（不能靠缺席）", () => {
  const next = buildConfigWithTheme(null, {
    primaryColor: THEME_DEFAULT_PRIMARY,
    primaryHoverColor: THEME_DEFAULT_HOVER,
    darkMode: false,
  });

  assert.equal(next.theme.darkMode, false);
  assert.ok("darkMode" in next.theme);
});

test("不會就地改動傳入的 config", () => {
  const config = { theme: { primaryColor: "#111111" } };
  const snapshot = JSON.stringify(config);

  buildConfigWithTheme(config, {
    primaryColor: "#222222",
    primaryHoverColor: "#333333",
    darkMode: true,
  });

  assert.equal(JSON.stringify(config), snapshot);
});

// ---------------------------------------------------------------------------
// 色碼護欄（只供預覽使用，不是存檔閘門）
// ---------------------------------------------------------------------------

test("isValidHexColor 認 #rgb 與 #rrggbb，大小寫都收", () => {
  for (const value of ["#abc", "#ABC", "#7c3aed", "#7C3AED", " #7c3aed "]) {
    assert.equal(isValidHexColor(value), true, `${value} 應該被接受`);
  }
});

test("isValidHexColor 拒絕其他寫法——它們會讓 RN 的 backgroundColor 爆掉", () => {
  for (const value of [
    "",
    "7c3aed",
    "#7c3a",
    "#gggggg",
    "purple",
    "rgb(124,58,237)",
    "#7c3aed80",
  ]) {
    assert.equal(
      isValidHexColor(value),
      false,
      `${value} 不該被當成可預覽的色碼`,
    );
  }
});
