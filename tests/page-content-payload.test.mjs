/**
 * 落地頁區塊的 payload 推導（`src/utils/page-content-payload.ts`）。
 *
 * ## 為什麼用 Node 測而不是測畫面
 * `content.tsx` 是 RN 畫面，這個 repo 沒有 jsdom／RN renderer（見
 * `tests/journeys/j-checkin-state.test.mjs` 檔頭）。所以把「表單 → PATCH body」
 * 這段純推導抽成 util，在那裡釘住——**這正是資料會靜默走鐘的地方**：
 *
 * - 清空輸入框要送 `null` 而不是 `""`（後端 `hasOwn` 語意：送什麼就改什麼）。
 * - `gridColumns` 若變成 4 或 0，後端 `normalizeGridColumns` 直接丟
 *   `EVENT_PAGE_GRID_COLUMNS_INVALID` 400。
 * - body 的欄位集合必須**恰好四個**。多帶一格，就是多改一格。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_SECTION_GRID_COLUMNS,
  SECTION_DESCRIPTION_MAX,
  SECTION_GRID_COLUMN_OPTIONS,
  SECTION_TITLE_MAX,
  toSectionFormState,
  toSectionPayload,
} from "@/utils/page-content-payload";

/** 後端 `GET …/page-sections` 回來的區塊（帶一張卡片，證明會原樣略過）。 */
const SECTION = {
  id: "sec-1",
  title: "關於我們",
  description: "一段說明",
  gridColumns: 3,
  isPublished: true,
  displayOrder: 0,
  cards: [
    {
      id: "card-1",
      title: "卡片",
      description: null,
      badgeText: "限量",
      iconKey: "STAR",
      imageUrl: "https://cdn.example.com/a.png",
      actionLabel: null,
      actionUrl: null,
      isPublished: true,
      displayOrder: 0,
    },
  ],
};

// ---------------------------------------------------------------------------
// 一、伺服器 → 表單
// ---------------------------------------------------------------------------

test("toSectionFormState 把 title／description 的 null 轉成空字串（受控輸入不能吃 null）", () => {
  const form = toSectionFormState({
    ...SECTION,
    title: null,
    description: null,
  });

  assert.equal(form.title, "");
  assert.equal(form.description, "");
});

test("toSectionFormState 保留其餘三欄原值", () => {
  const form = toSectionFormState(SECTION);

  assert.equal(form.title, "關於我們");
  assert.equal(form.description, "一段說明");
  assert.equal(form.gridColumns, 3);
  assert.equal(form.isPublished, true);
});

test("toSectionFormState 對 1／2／3 以外的欄數退回預設 2（否則晶片會全部沒選中）", () => {
  for (const bad of [0, 4, -1, null, undefined]) {
    const form = toSectionFormState({
      ...SECTION,
      gridColumns: bad,
    });
    assert.equal(
      form.gridColumns,
      DEFAULT_SECTION_GRID_COLUMNS,
      `gridColumns=${String(bad)} 應該退回 ${DEFAULT_SECTION_GRID_COLUMNS}`,
    );
  }
});

test("DEFAULT_SECTION_GRID_COLUMNS 是 2（與後端 DEFAULT_SECTION_GRID_COLUMNS 相同）", () => {
  assert.equal(DEFAULT_SECTION_GRID_COLUMNS, 2);
  assert.deepEqual(SECTION_GRID_COLUMN_OPTIONS, [1, 2, 3]);
});

// ---------------------------------------------------------------------------
// 二、表單 → PATCH body
// ---------------------------------------------------------------------------

test("toSectionPayload 清空欄位時送 null，不是空字串", () => {
  const body = toSectionPayload({
    title: "",
    description: "",
    gridColumns: 2,
    isPublished: false,
  });

  assert.equal(body.title, null);
  assert.equal(body.description, null);
  assert.notEqual(body.title, "");
  assert.notEqual(body.description, "");
});

test("toSectionPayload 的欄位集合恰好是四個（多一格就是多改一格）", () => {
  const body = toSectionPayload(toSectionFormState(SECTION));

  assert.deepEqual(Object.keys(body).sort(), [
    "description",
    "gridColumns",
    "isPublished",
    "title",
  ]);
});

test("toSectionPayload 不搬運讀取端才有的欄位（id／displayOrder／cards）", () => {
  const body = toSectionPayload(toSectionFormState(SECTION));

  for (const key of ["id", "displayOrder", "cards"]) {
    assert.equal(Object.hasOwn(body, key), false, `${key} 不該進 PATCH body`);
  }
});

test("toSectionPayload 原樣送出標題與欄數（不 trim、不改寫）", () => {
  const body = toSectionPayload({
    title: "  前後有空白  ",
    description: "說明",
    gridColumns: 1,
    isPublished: true,
  });

  assert.equal(body.title, "  前後有空白  ");
  assert.equal(body.gridColumns, 1);
  assert.equal(body.isPublished, true);
});

test("toSectionPayload 的 gridColumns 永遠落在 1／2／3", () => {
  for (const columns of SECTION_GRID_COLUMN_OPTIONS) {
    const body = toSectionPayload({
      title: "t",
      description: "",
      gridColumns: columns,
      isPublished: false,
    });
    assert.ok([1, 2, 3].includes(body.gridColumns));
  }
});

// ---------------------------------------------------------------------------
// 三、輸入層上限（與後端 DTO 的 @MaxLength 對齊）
// ---------------------------------------------------------------------------

test("區塊字數上限與後端 DTO 相同：標題 80／說明 240", () => {
  // 來源：LinkCard_ExpressJS_Backend/src/events/dtos/event-page-content.dto.ts
  //   CreateEventPageSectionDto.title       @MaxLength(80)
  //   CreateEventPageSectionDto.description @MaxLength(240)
  assert.equal(SECTION_TITLE_MAX, 80);
  assert.equal(SECTION_DESCRIPTION_MAX, 240);
});
