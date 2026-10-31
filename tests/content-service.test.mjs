/**
 * `contentService` 的語意測試（不是只驗路徑有沒有搬家）。
 *
 * ## 為什麼要這一支
 * 落地頁內容的六支寫入有一條**靜默的資料遺失路徑**，TypeScript 完全看不到：
 * 後端 `EventPageContentService.updateCard` 逐欄用 `hasOwn(dto, '<欄位>')`
 * 判斷要不要寫（`LinkCard_ExpressJS_Backend/src/events/services/EventPageContentService.ts:203-226`）。
 * 也就是說「沒送」＝「不動」，「送 null」＝「清空」。
 *
 * 卡片上那三個事件頁改不到的欄位（`badgeText`／`iconKey`／`imageUrl`）因此
 * **絕對不能出現在 PATCH body 裡**：一旦有人為了「型別完整」補上
 * `imageUrl: card.imageUrl ?? null`，Web 後台上傳的卡片圖就會在手機上被
 * 一鍵清成 null，而且沒有任何錯誤訊息、沒有任何測試會紅。
 *
 * 所以下面有兩支測試專門釘住 body 的**欄位集合**（不是只驗其中幾欄）：
 * - 區塊 PATCH：恰好 `title` / `description` / `gridColumns` / `isPublished`
 * - 卡片 PATCH：恰好 `title` / `description` / `actionLabel` / `actionUrl` /
 *   `isPublished`
 *
 * 方法與路徑的逐條契約另有 `tests/content-contract.test.mjs`；這一支管語意。
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

/** 每次呼叫的 (method, url, body) 都記在這裡，供斷言觀察。 */
const calls = [];

/**
 * 讀取端回傳的區塊。刻意帶齊 `PageSectionCard` 的三個「事件頁改不到」欄位，
 * 並且**故意給非 null 的值**——只有這樣，「有沒有把它們寫回去」才驗得出來。
 */
const SECTION = {
  id: "sec-1",
  title: "新區塊",
  description: null,
  gridColumns: 2,
  isPublished: false,
  displayOrder: 0,
  cards: [
    {
      id: "card-1",
      title: "新卡片",
      description: null,
      badgeText: "限量",
      iconKey: "STAR",
      imageUrl: "https://cdn.example.com/card.png",
      actionLabel: null,
      actionUrl: null,
      isPublished: true,
      displayOrder: 0,
    },
  ],
};

mock.module("@/services/api", {
  namedExports: {
    apiClient: {
      get: async (url) => {
        calls.push({ method: "GET", url, body: undefined });
        return { data: { data: { sections: [SECTION] } } };
      },
      post: async (url, body) => {
        calls.push({ method: "POST", url, body });
        return { data: { data: { section: SECTION, card: SECTION.cards[0] } } };
      },
      patch: async (url, body) => {
        calls.push({ method: "PATCH", url, body });
        return { data: { data: { section: SECTION, card: SECTION.cards[0] } } };
      },
      delete: async (url) => {
        calls.push({ method: "DELETE", url, body: undefined });
        return { data: { data: { deletedId: "x" } } };
      },
    },
  },
});

const { contentService } = await import("@/services/content.service");

const SECTIONS = "/api/v1/events/evt-1/page-sections";

/**
 * 七支呼叫（1 讀 6 寫）的期望形狀。
 *
 * `body` 只給「這支呼叫該送的東西」；`undefined` 表示這支不帶 body。
 */
const EXPECTED = [
  {
    name: "listSections",
    method: "GET",
    url: SECTIONS,
    invoke: () => contentService.listSections("evt-1"),
  },
  {
    name: "createSection",
    method: "POST",
    url: SECTIONS,
    body: { title: "新區塊", gridColumns: 2, isPublished: false },
    invoke: () =>
      contentService.createSection("evt-1", {
        title: "新區塊",
        gridColumns: 2,
        isPublished: false,
      }),
  },
  {
    name: "updateSection",
    method: "PATCH",
    url: `${SECTIONS}/sec-1`,
    body: {
      title: "區塊",
      description: null,
      gridColumns: 3,
      isPublished: true,
    },
    invoke: () =>
      contentService.updateSection("evt-1", "sec-1", {
        title: "區塊",
        description: null,
        gridColumns: 3,
        isPublished: true,
      }),
  },
  {
    name: "deleteSection",
    method: "DELETE",
    url: `${SECTIONS}/sec-1`,
    invoke: () => contentService.deleteSection("evt-1", "sec-1"),
  },
  {
    name: "createCard",
    method: "POST",
    url: `${SECTIONS}/sec-1/cards`,
    body: { title: "新卡片", isPublished: true },
    invoke: () =>
      contentService.createCard("evt-1", "sec-1", {
        title: "新卡片",
        isPublished: true,
      }),
  },
  {
    name: "updateCard",
    method: "PATCH",
    url: `${SECTIONS}/sec-1/cards/card-1`,
    body: {
      title: "卡片",
      description: null,
      actionLabel: "看更多",
      actionUrl: "https://example.com",
      isPublished: true,
    },
    invoke: () =>
      contentService.updateCard("evt-1", "sec-1", "card-1", {
        title: "卡片",
        description: null,
        actionLabel: "看更多",
        actionUrl: "https://example.com",
        isPublished: true,
      }),
  },
  {
    name: "deleteCard",
    method: "DELETE",
    url: `${SECTIONS}/sec-1/cards/card-1`,
    invoke: () => contentService.deleteCard("evt-1", "sec-1", "card-1"),
  },
];

// ---------------------------------------------------------------------------
// 一、方法與路徑（每支都恰好打一次，路徑落在 page-sections 之下）
// ---------------------------------------------------------------------------

for (const expected of EXPECTED) {
  test(`${expected.name}: ${expected.method} ${expected.url}`, async () => {
    calls.length = 0;
    await expected.invoke();

    assert.equal(calls.length, 1, `${expected.name} 應該恰好打一次`);
    assert.equal(
      calls[0].method,
      expected.method,
      `${expected.name} 的 method 變了`,
    );
    assert.equal(calls[0].url, expected.url, `${expected.name} 的路徑搬家了`);

    if (expected.body !== undefined) {
      assert.deepEqual(
        calls[0].body,
        expected.body,
        `${expected.name} 的 body 被改寫了`,
      );
    } else {
      assert.equal(calls[0].body, undefined, `${expected.name} 不該帶 body`);
    }
  });
}

test("七支呼叫都在 /api/v1/events/{eventId}/page-sections 之下（沒有掉版本前綴）", async () => {
  for (const expected of EXPECTED) {
    calls.length = 0;
    await expected.invoke();
    assert.ok(
      calls[0].url.startsWith(SECTIONS),
      `${expected.name} 的 URL 是 ${calls[0].url}`,
    );
  }
});

test("id 進到路徑前有 encodeURIComponent（id 含斜線也不會多切一層）", async () => {
  calls.length = 0;
  await contentService.deleteCard("evt-1", "sec/1", "card/1");
  assert.equal(
    calls[0].url,
    "/api/v1/events/evt-1/page-sections/sec%2F1/cards/card%2F1",
  );
});

// ---------------------------------------------------------------------------
// 二、資料保全：PATCH body 的欄位集合必須恰好是 Web 送的那幾個
// ---------------------------------------------------------------------------

test("updateSection 的 body 欄位恰好是 title／description／gridColumns／isPublished", async () => {
  calls.length = 0;
  await contentService.updateSection("evt-1", "sec-1", {
    title: "區塊",
    description: null,
    gridColumns: 2,
    isPublished: true,
  });

  assert.deepEqual(Object.keys(calls[0].body).sort(), [
    "description",
    "gridColumns",
    "isPublished",
    "title",
  ]);
});

test("updateCard 的 body 欄位恰好是五個，且不含 badgeText／iconKey／imageUrl", async () => {
  calls.length = 0;
  await contentService.updateCard("evt-1", "sec-1", "card-1", {
    title: "卡片",
    description: null,
    actionLabel: null,
    actionUrl: null,
    isPublished: true,
  });

  assert.deepEqual(
    Object.keys(calls[0].body).sort(),
    ["actionLabel", "actionUrl", "description", "isPublished", "title"],
    "卡片 PATCH 的欄位集合變了——新增 badgeText／iconKey／imageUrl 會把 Web 上設定的值清成 null（後端 hasOwn 語意）",
  );

  for (const forbidden of ["badgeText", "iconKey", "imageUrl"]) {
    assert.equal(
      Object.hasOwn(calls[0].body, forbidden),
      false,
      `${forbidden} 不該出現在卡片 PATCH body——後端 hasOwn 會把它寫成 null`,
    );
  }
});

test("updateCard 沒有把讀取到的 imageUrl 原樣回送（即使呼叫端手上有整張卡）", async () => {
  calls.length = 0;
  // 模擬「呼叫端從 STATE 拿到整張卡，只挑五欄送」的正確寫法。
  const card = SECTION.cards[0];
  await contentService.updateCard("evt-1", "sec-1", card.id, {
    title: card.title,
    description: card.description ?? null,
    actionLabel: card.actionLabel ?? null,
    actionUrl: card.actionUrl ?? null,
    isPublished: card.isPublished,
  });

  assert.equal(Object.hasOwn(calls[0].body, "imageUrl"), false);
  assert.equal(
    calls[0].body.imageUrl,
    undefined,
    "imageUrl 一旦進 body（即使是原值）都代表未來的 null 會直接清掉圖",
  );
});

// ---------------------------------------------------------------------------
// 三、信封解包與回傳形狀
// ---------------------------------------------------------------------------

test("listSections 解開 envelopes，回傳 data.data.sections", async () => {
  const result = await contentService.listSections("evt-1");
  assert.deepEqual(result.sections, [SECTION]);
});

test("createSection／updateSection 回傳 data.data.section（含 cards）", async () => {
  const created = await contentService.createSection("evt-1", {
    title: "新區塊",
  });
  assert.deepEqual(created.section, SECTION);

  const updated = await contentService.updateSection("evt-1", "sec-1", {
    title: "新區塊",
  });
  assert.deepEqual(updated.section, SECTION);
});

test("createCard／updateCard 回傳 data.data.card", async () => {
  const created = await contentService.createCard("evt-1", "sec-1", {
    title: "新卡片",
  });
  assert.deepEqual(created.card, SECTION.cards[0]);

  const updated = await contentService.updateCard("evt-1", "sec-1", "card-1", {
    title: "新卡片",
  });
  assert.deepEqual(updated.card, SECTION.cards[0]);
});

test("deleteSection／deleteCard 回傳 undefined（與 Web 的 Promise<void> 一致）", async () => {
  assert.equal(await contentService.deleteSection("evt-1", "sec-1"), undefined);
  assert.equal(
    await contentService.deleteCard("evt-1", "sec-1", "card-1"),
    undefined,
  );
});
