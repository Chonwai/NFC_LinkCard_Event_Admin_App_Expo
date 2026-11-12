/**
 * 排行榜**單列渲染**的測試（設計 §8.3）。
 *
 * ## 這一支要防的四個具體缺陷
 *
 * 1. **`rank: null` 被直接渲染**。React Native 會把 `null` 當成「什麼都不畫」，
 *    所以設計 §8.3 的警告（「會渲染出空白或字串 `null`」）在型別與執行期都
 *    不會報錯——只有測試抓得到。
 * 2. **below-threshold 被畫上比較條**。門檻可調到 50，於是會出現 `uv = 42` 但
 *    `rank === null`；此時畫條會讓那一列看起來「有排名但比較短」。
 * 3. **並列裁決序到處顯示**。裁決序只對「同一個 rank 有好幾個人」有意義，
 *    對無名次的列更是毫無意義。
 * 4. **文案禁令被寫回去**。「被 N 人拍過」這類措辭是本功能最重要的一條禁令，
 *    它不是程式邏輯，沒有編譯器會擋，只能靠斷言。
 *
 * 狀態矩陣（S1–S14）在 `tests/leaderboard-states.test.mjs`；呼叫契約與原始碼
 * 禁令在 `tests/leaderboard-contract.test.mjs`。三支都要綠才算這個能力完整。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { copy } from "@/constants/copy.zh-TW";
import {
  barPercent,
  buildBelowThresholdRows,
  buildLeaderboardQuery,
  buildLeaderboardRows,
  excludedGroups,
  excludedItemViews,
  excludedRegistrantTypeLabels,
  formatAsOf,
  methodologyNotes,
  rankAccessibilityLabel,
  rankBadgeLabel,
} from "@/utils/leaderboard-display";

import { entry, response } from "./support/leaderboard-fixtures.mjs";

const EM_DASH = "\u2014";

// ---------------------------------------------------------------------------
// 一、`rank: null` —— 整個功能最貴的一行
// ---------------------------------------------------------------------------

test("`rank: null` 一律顯示 U+2014 的 `—`，不是空字串、不是 `null`、不是 hyphen", () => {
  assert.equal(rankBadgeLabel(null), EM_DASH);
  assert.equal(rankBadgeLabel(null).length, 1);
  assert.notEqual(rankBadgeLabel(null), "");
  assert.notEqual(rankBadgeLabel(null), "null");
  assert.notEqual(rankBadgeLabel(null), "-");
  assert.equal(rankBadgeLabel(null).codePointAt(0), 0x2014);
});

test("有名次時名次文字就是那個數字（dense rank，並列者顯示同一個數字）", () => {
  assert.equal(rankBadgeLabel(1), "1");
  assert.equal(rankBadgeLabel(2), "2");
  assert.equal(rankBadgeLabel(17), "17");
});

test("讀屏標籤：無名次不得唸成「第 null 名」", () => {
  assert.equal(
    rankAccessibilityLabel(null),
    copy.leaderboard.rankBelowThresholdA11y,
  );
  assert.ok(!rankAccessibilityLabel(null).includes("null"));
  assert.equal(rankAccessibilityLabel(3), copy.leaderboard.rankLabel(3));
});

test("`sampleQuality` 不參與名次分流：uv = 42 但 rank null 仍是 below-threshold", () => {
  const built = buildBelowThresholdRows(
    response({
      belowThreshold: [
        entry({
          rank: null,
          rankExclusionReason: "BELOW_THRESHOLD",
          eligible: false,
          uniqueVisitors: 42,
          sampleQuality: "sufficient",
        }),
      ],
    }),
  );

  assert.equal(built.length, 1);
  assert.equal(built[0].belowThreshold, true);
  assert.equal(built[0].rankLabel, EM_DASH);
  assert.equal(built[0].sampleQuality, "sufficient", "band 仍然是 sufficient");
  assert.equal(built[0].bar, null, "沒有名次就不畫比較條");
});

// ---------------------------------------------------------------------------
// 二、below-threshold 的四個必守差異（設計 §8.3 的四列表）
// ---------------------------------------------------------------------------

test("below-threshold：名次 `—`、無裁決序、無比較條、樣本標籤「資料累積中」", () => {
  const built = buildBelowThresholdRows(
    response({
      belowThreshold: [
        entry({
          rank: null,
          tieBreakOrder: null,
          rankExclusionReason: "BELOW_THRESHOLD",
          eligible: false,
          uniqueVisitors: 2,
          sampleQuality: "small",
        }),
      ],
    }),
  );
  const row = built[0];

  assert.equal(row.rankLabel, EM_DASH);
  assert.equal(row.rankTone, "placeholder");
  assert.equal(row.tieBreakLabel, null);
  assert.equal(row.bar, null);
  assert.equal(row.sampleQualityLabel, copy.leaderboard.sampleAccumulating);
  assert.equal(row.visitorAsterisk, false);
});

test("below-threshold：uv = 0（accumulating）也不畫條", () => {
  const built = buildBelowThresholdRows(
    response({
      belowThreshold: [
        entry({ rank: null, uniqueVisitors: 0, sampleQuality: "accumulating" }),
      ],
    }),
  );

  assert.equal(built[0].bar, null);
  assert.equal(
    built[0].sampleQualityLabel,
    copy.leaderboard.sampleAccumulating,
  );
});

test("below-threshold 若不是 `rank === null` 就不會被排進那個區塊（分流唯一判準）", () => {
  // 後端契約保證 belowThreshold[] 的 rank 恆為 null；萬一不是，畫面仍然照
  // `rank` 顯示而**不是**照「它在哪個陣列」顯示——避免兩套真相。
  const built = buildBelowThresholdRows(
    response({ belowThreshold: [entry({ rank: 7 })] }),
  );

  assert.equal(built[0].rankLabel, "7");
  assert.equal(
    built[0].belowThreshold,
    true,
    "旗標仍標示它來自 belowThreshold",
  );
});

// ---------------------------------------------------------------------------
// 三、有名次的列：比較條、虛線、並列裁決序
// ---------------------------------------------------------------------------

test("比較條分母是 entries[0]（首列即最大值），首列 100%", () => {
  const rows = buildLeaderboardRows(
    response({
      entries: [
        entry({ rank: 1, profileId: "a", uniqueVisitors: 30 }),
        entry({
          rank: 2,
          profileId: "b",
          uniqueVisitors: 15,
          tieBreakOrder: 2,
        }),
      ],
    }),
  );

  assert.equal(rows[0].bar.percent, 100);
  assert.equal(rows[1].bar.percent, 50);
});

test("`sampleQuality === 'small'` 的實心條改成虛線，且主指標加星號", () => {
  const rows = buildLeaderboardRows(
    response({
      entries: [
        entry({
          rank: 1,
          profileId: "a",
          uniqueVisitors: 8,
          sampleQuality: "small",
        }),
      ],
    }),
  );

  assert.equal(rows[0].bar.dashed, true);
  assert.equal(rows[0].visitorAsterisk, true);
  assert.equal(
    rows[0].sampleQualityLabel,
    null,
    "有名次的列用星號表達小樣本，不再疊一句標籤",
  );
});

test("並列裁決序只在「同 rank 群組人數 > 1」時出現", () => {
  const rows = buildLeaderboardRows(
    response({
      entries: [
        entry({ rank: 1, profileId: "a", tieBreakOrder: 1 }),
        entry({ rank: 2, profileId: "b", tieBreakOrder: 2 }),
        entry({ rank: 2, profileId: "c", tieBreakOrder: 3 }),
        entry({ rank: 3, profileId: "d", tieBreakOrder: 4 }),
      ],
    }),
  );

  assert.equal(rows[0].tieBreakLabel, null, "rank 1 只有一個人");
  assert.equal(rows[1].tieBreakLabel, copy.leaderboard.tieBreakLabel(2));
  assert.equal(rows[2].tieBreakLabel, copy.leaderboard.tieBreakLabel(3));
  assert.equal(rows[3].tieBreakLabel, null);
});

test("並列的讀屏標籤唸「並列第 N 名」", () => {
  const rows = buildLeaderboardRows(
    response({
      entries: [
        entry({ rank: 2, profileId: "a", tieBreakOrder: 1 }),
        entry({ rank: 2, profileId: "b", tieBreakOrder: 2 }),
      ],
    }),
  );

  assert.equal(rows[0].rankAccessibilityLabel, copy.leaderboard.tiedLabel(2));
});

// ---------------------------------------------------------------------------
// 二之二、並列群組大小必須取「截斷前」的計數（L-06）
// ---------------------------------------------------------------------------

/**
 * `?limit=` 會切掉 `entries` 的尾巴。若前端從 `entries` 自己數群組大小，一個
 * 跨過截斷邊界的並列群組就會被低估——名次是對的（後端決定），但畫面會說
 * 「並列 2 位」而實際上是 5 位。那是一個**確定錯誤的事實**。
 *
 * 因此後端在回應裡帶 `rankGroupSizes`（截斷前算好），顯示層必須優先採用。
 */
test("後端帶 rankGroupSizes 時，群組大小以它為準（不是數 entries）", () => {
  // `?limit=1` 之後 `entries` 只剩一列，但後端說第 1 名其實有 5 人。
  // 只數 entries 會得到 1 ⇒ 不會出現並列標籤，那就是一個錯的事實。
  const rows = buildLeaderboardRows(
    response({
      entries: [entry({ rank: 1, profileId: "a", tieBreakOrder: 1 })],
      rankGroupSizes: [{ rank: 1, size: 5 }],
    }),
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].tieBreakLabel, copy.leaderboard.tieBreakLabel(1));
  assert.equal(rows[0].rankAccessibilityLabel, copy.leaderboard.tiedLabel(1));
});

test("沒有 rankGroupSizes 時退回數 entries（已知會低估的降級路徑）", () => {
  // 同樣的截斷後輸入、少了後端計數 ⇒ 只能得到「不是並列」。這條測試把降級行為
  // 明寫下來，避免有人以為兩條路徑等價。
  const rows = buildLeaderboardRows(
    response({
      entries: [entry({ rank: 1, profileId: "a", tieBreakOrder: 1 })],
    }),
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].tieBreakLabel, null);
});

test("前 3 名走強調色階，其餘走一般色階", () => {
  const rows = buildLeaderboardRows(
    response({
      entries: [
        entry({ rank: 1, profileId: "a" }),
        entry({ rank: 3, profileId: "b" }),
        entry({ rank: 4, profileId: "c" }),
      ],
    }),
  );

  assert.equal(rows[0].rankTone, "top");
  assert.equal(rows[1].rankTone, "top");
  assert.equal(rows[2].rankTone, "default");
});

test("key 必須唯一：同一使用者可有兩筆有效報名（同一個 profileId 出現兩次）", () => {
  const rows = buildLeaderboardRows(
    response({
      entries: [
        entry({ rank: 1, profileId: "same" }),
        entry({ rank: 2, profileId: "same" }),
      ],
    }),
  );

  assert.notEqual(rows[0].key, rows[1].key);
  assert.equal(new Set(rows.map((row) => row.key)).size, 2);
});

test("`barPercent`：top 為 0 不產生 NaN，超出範圍會夾住", () => {
  assert.equal(barPercent(5, 0), 0);
  assert.ok(!Number.isNaN(barPercent(5, 0)));
  assert.equal(barPercent(10, 10), 100);
  assert.equal(barPercent(30, 10), 100);
  assert.equal(barPercent(-3, 10), 0);
});

// ---------------------------------------------------------------------------
// 四、excluded 分組與方法論
// ---------------------------------------------------------------------------

test("excluded 依後端固定優先序分組，且不列出 0 位", () => {
  const groups = excludedGroups(
    response({
      excluded: {
        total: 5,
        byReason: {
          REGISTRATION_INACTIVE: 1,
          ROLE_EXCLUDED: 3,
          NO_ACCOUNT: 1,
          NO_PUBLIC_DEFAULT_PROFILE: 0,
        },
        items: [],
        truncated: false,
      },
    }),
  );

  assert.deepEqual(
    groups.map((group) => group.reason),
    ["REGISTRATION_INACTIVE", "ROLE_EXCLUDED", "NO_ACCOUNT"],
  );
  assert.deepEqual(
    groups.map((group) => group.count),
    [1, 3, 1],
  );
});

test("excluded.items 的顯示列不含 email（刻意不顯示敏感資料）", () => {
  const views = excludedItemViews(
    response({
      excluded: {
        total: 1,
        byReason: {
          REGISTRATION_INACTIVE: 0,
          ROLE_EXCLUDED: 1,
          NO_ACCOUNT: 0,
          NO_PUBLIC_DEFAULT_PROFILE: 0,
        },
        items: [
          {
            displayName: "Someone",
            email: "someone@example.com",
            reason: "ROLE_EXCLUDED",
            registrantType: "EXHIBITOR_REP",
          },
        ],
        truncated: false,
      },
    }),
  );

  assert.equal(views[0].displayName, "Someone");
  assert.equal(
    views[0].reasonLabel,
    copy.leaderboard.excludedRoleExcluded(
      excludedRegistrantTypeLabels(["ATTENDEE", "GUEST", "MEDIA"]),
    ),
  );
  assert.ok(
    views[0].reasonLabel.includes("參展代表"),
    "預設口徑下被排除的身分類別是展商代表等，不是「參展商」",
  );
  assert.equal(views[0].email, undefined, "不得把 email 帶進可渲染的列");
  assert.ok(!JSON.stringify(views).includes("@"));
});

test("方法論註記含「按日去重加總」與「共用 email 合併」，且 S13 不重複放在陣列裡", () => {
  const notes = methodologyNotes(["ATTENDEE", "GUEST", "MEDIA"]);
  const joined = notes.join("\n");

  assert.ok(joined.includes(copy.leaderboard.methodologyDedupe));
  assert.ok(joined.includes(copy.leaderboard.methodologyLead));
  assert.ok(
    joined.includes(
      copy.leaderboard.methodologyExcluded("參展代表、講者、贊助商、志工"),
    ),
  );
  assert.ok(
    !notes.includes(copy.leaderboard.riskFlagsInactive),
    "riskFlagsInactive 只由 showRiskFlagsInactive 驅動，不得同時放在陣列裡",
  );
});

test("方法論排除句由後端回報的 registrantTypesIncluded 推導（展商口徑不得說「不含參展代表」）", () => {
  const exhibitorNotes = methodologyNotes(["EXHIBITOR_REP"]).join("\n");

  assert.ok(!exhibitorNotes.includes("參展代表"), "展商口徑自己就在榜上");
  assert.ok(exhibitorNotes.includes("不含："));
  assert.ok(exhibitorNotes.includes("參加者"));

  const allNotes = methodologyNotes([
    "ATTENDEE",
    "EXHIBITOR_REP",
    "SPEAKER",
    "SPONSOR",
    "MEDIA",
    "GUEST",
    "VOLUNTEER",
  ]).join("\n");

  assert.ok(allNotes.includes("未排除任何身分類別"));
  assert.ok(!allNotes.includes("不含："), "全 7 類納入時不得再說「不含」");
});

test("excludedRegistrantTypeLabels 依後端 enum 順序翻中文；全包時回空字串", () => {
  assert.equal(
    excludedRegistrantTypeLabels(["ATTENDEE", "GUEST", "MEDIA"]),
    "參展代表、講者、贊助商、志工",
  );
  assert.equal(
    excludedRegistrantTypeLabels([]),
    "參加者、參展代表、講者、贊助商、媒體、貴賓、志工",
  );
  assert.equal(
    excludedRegistrantTypeLabels([
      "ATTENDEE",
      "EXHIBITOR_REP",
      "SPEAKER",
      "SPONSOR",
      "MEDIA",
      "GUEST",
      "VOLUNTEER",
    ]),
    "",
  );
});

test("registrantTypesIncluded 缺失或非陣列時回 null，不得把 7 類全列為排除", () => {
  assert.equal(excludedRegistrantTypeLabels(undefined), null);
  assert.equal(excludedRegistrantTypeLabels(null), null);
  assert.equal(excludedRegistrantTypeLabels("ATTENDEE,GUEST,MEDIA"), null);

  const notes = methodologyNotes(undefined).join("\n");
  assert.ok(notes.includes(copy.leaderboard.methodologyExcluded(null)));
  assert.ok(notes.includes("未取得本次的身分類別口徑"));
  assert.ok(!notes.includes("未排除任何身分類別"), "未知不等於「全包」");
  assert.ok(!notes.includes("參加者、參展代表、講者"), "未知不得捏造排除名單");

  const malformed = response();
  malformed.methodology.registrantTypesIncluded = undefined;
  malformed.excluded.byReason.ROLE_EXCLUDED = 1;
  const label = excludedGroups(malformed)[0].label;
  assert.equal(label, copy.leaderboard.excludedRoleExcluded(null));
  assert.ok(!label.includes("null"));
  assert.ok(!label.includes("參加者、參展代表"));
});

test("buildLeaderboardQuery：只有展商口徑放寬 limit 100／minUniqueVisitors 1", () => {
  const cases = [
    {
      scope: "attendees",
      registrantTypes: "ATTENDEE,GUEST,MEDIA",
      limit: undefined,
      minUniqueVisitors: undefined,
    },
    {
      scope: "all",
      registrantTypes:
        "ATTENDEE,EXHIBITOR_REP,SPEAKER,SPONSOR,MEDIA,GUEST,VOLUNTEER",
      limit: undefined,
      minUniqueVisitors: undefined,
    },
    {
      scope: "exhibitors",
      registrantTypes: "EXHIBITOR_REP",
      limit: 100,
      minUniqueVisitors: 1,
    },
  ];

  for (const { scope, ...expected } of cases) {
    const query = buildLeaderboardQuery(scope);
    assert.deepEqual(
      query,
      {
        registrantTypes: expected.registrantTypes,
        ...(expected.limit === undefined
          ? {}
          : {
              limit: expected.limit,
              minUniqueVisitors: expected.minUniqueVisitors,
            }),
      },
      `口徑 ${scope} 的查詢參數不對`,
    );
  }
});

test("formatAsOf 一律以 UTC 呈現；無法解析回 null（交由呼叫端落回 staleWarning）", () => {
  assert.equal(formatAsOf("2026-11-07T14:15:03.412Z"), "2026-11-07 14:15 UTC");
  assert.equal(formatAsOf(null), null);
  assert.equal(formatAsOf("not-a-date"), null);
});

// ---------------------------------------------------------------------------
// 五、文案禁令（沒有編譯器會擋的另一半）
// ---------------------------------------------------------------------------

test("媒體指標刻意不出現「被 N 人拍過」與評價性字眼", () => {
  const serialized = JSON.stringify(copy.leaderboard);

  for (const banned of ["拍過", "被拍", "影響力", "人氣", "熱門", "後段班"]) {
    assert.ok(!serialized.includes(banned), `禁用詞出現在文案：${banned}`);
  }

  // 「打敗」「作弊」只允許出現在否認句裡（riskBannerHint）。
  const withoutHint = serialized.replace(
    JSON.stringify(copy.leaderboard.riskBannerHint),
    "",
  );
  assert.ok(!withoutHint.includes("打敗"));
  assert.ok(!withoutHint.includes("作弊"));
});

test("主指標的定義句必須是「N 位不同訪客開啟過名片（同日同裝置算一位）」", () => {
  const definition = copy.leaderboard.visitorDefinition(34);

  assert.ok(definition.includes("34"));
  assert.ok(definition.includes("不同訪客"));
  assert.ok(definition.includes("同日同裝置算一位"));
  assert.ok(!definition.includes("拍"));
});

test("門檻相關文案吃參數，不把 5 寫死（minUniqueVisitors 是查詢參數）", () => {
  assert.ok(copy.leaderboard.belowThresholdHint(12).includes("12"));
  assert.ok(copy.leaderboard.emptyBelowThreshold(12, 40).includes("12"));
  assert.ok(copy.leaderboard.emptyBelowThreshold(12, 40).includes("40"));
});
