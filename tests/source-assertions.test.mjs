/**
 * `tests/support/source-assertions.mjs` 的自我測試（R6）。
 *
 * ## 為什麼 helper 自己也要有測試
 *
 * 這個 helper 的用途是「讓原始碼掃描測試不要再假紅」。但一個為了少假紅而放寬的
 * 比對器，最可能的失敗方式剛好相反——**假綠**：放寬到連不該命中的都命中，於是
 * 測試從「偶爾誤報」變成「永遠不報」。
 *
 * 所以下面兩組同樣重要：
 *
 * 1. **必須命中**（排版變了、語意沒變）：`label={a}` vs `label={ a }`、單行 vs
 *    折行、`,` 後面多一個空白。
 * 2. **必須不命中**（真的不一樣）：內容不同、以及「識別字之間的空白」——後者
 *    是一般「把所有空白刪掉」的做法會踩的坑（`a b` 命中 `ab`）。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FILES_STILL_USING_RAW_SOURCE_ASSERTIONS,
  matchesIgnoringWhitespace,
  normalizeSource,
} from "./support/source-assertions.mjs";

test("JSX 邊界：`label={a}` 與 `label={ a }` 都要命中", () => {
  // 這一條就是 R6 的最小重現：prettier 一動行寬就會產生第二種形狀。
  assert.equal(
    matchesIgnoringWhitespace("<Text label={a} />", "label={a}"),
    true,
  );
  assert.equal(
    matchesIgnoringWhitespace("<Text label={ a } />", "label={a}"),
    true,
  );
  // 反向也要成立（snippet 寬、原始碼窄）。
  assert.equal(
    matchesIgnoringWhitespace("<Text label={a} />", "label={ a }"),
    true,
  );
});

test("折行與縮排不影響命中（prettier 把一行拆成三行）", () => {
  const formatted = [
    "  assert.ok(",
    "    matches(",
    "      <Text label={ copy.checkIn.profileLabel } numberOfLines={1} />,",
    "    ),",
  ].join("\n");

  assert.equal(
    matchesIgnoringWhitespace(
      formatted,
      "label={copy.checkIn.profileLabel} numberOfLines={1}",
    ),
    true,
  );
});

test("呼叫與解構的空白不影響命中", () => {
  assert.equal(
    matchesIgnoringWhitespace(
      "const { eventId, code: codeParam } = useLocalSearchParams();",
      "const { eventId, code: codeParam } = useLocalSearchParams<",
    ),
    false,
    "結尾不同就不該命中（helper 不是模糊比對）",
  );
  assert.equal(
    matchesIgnoringWhitespace(
      "const { eventId, code: codeParam } = useLocalSearchParams<{ a: string }>();",
      "const { eventId, code: codeParam } = useLocalSearchParams<",
    ),
    true,
  );
  assert.equal(matchesIgnoringWhitespace("f( a,  b )", "f(a,b)"), true);
});

test("prettier 的 trailing comma 不算差異（是 token 不是空白）", () => {
  // R6 的反例探針抓到的真實形狀：printWidth 改窄後，一行的呼叫被拆成三行並
  // 在參數後面多了一個逗號。只忽略空白的話這種假紅照樣會發生。
  const reformatted = [
    "            {profilePathLabel(",
    "              outcome.registration.profileUrl,",
    "            )}",
  ].join("\n");

  assert.equal(
    matchesIgnoringWhitespace(
      reformatted,
      "profilePathLabel(outcome.registration.profileUrl)",
    ),
    true,
  );
  assert.equal(matchesIgnoringWhitespace("f(a,)", "f(a)"), true);
  assert.equal(
    matchesIgnoringWhitespace("const { a, } = x", "const { a } = x"),
    true,
  );
  // `]` 前的逗號不是 no-op（`[1,,]` 是兩個元素），必須維持可分辨。
  assert.equal(
    matchesIgnoringWhitespace("const a = [1,]", "const a = [1]"),
    false,
  );
});

test("真的不一樣就不命中（避免放寬成永遠為真）", () => {
  assert.equal(
    matchesIgnoringWhitespace("<Text label={a} />", "label={b}"),
    false,
  );
  assert.equal(
    matchesIgnoringWhitespace("<Text label={a} />", "numberOfLines={1}"),
    false,
  );
});

test("識別字之間的空白仍然有意義（不做全空白刪除）", () => {
  // 「把所有空白都刪掉再比對」會讓這條命中——那是假通過。
  assert.equal(matchesIgnoringWhitespace("const a = 1;", "consta=1;"), false);
  assert.equal(matchesIgnoringWhitespace("const a = 1;", "const a = 1"), true);
});

test('空 snippet 直接丟錯（`"".includes("")` 恆真 = 靜默空轉）', () => {
  assert.throws(() => matchesIgnoringWhitespace("anything", ""), TypeError);
  assert.throws(() => matchesIgnoringWhitespace("anything", "   "), TypeError);
});

test("normalizeSource：空白壓成一個、邊界字元兩側不留空白", () => {
  assert.equal(normalizeSource("a  \n  b"), "a b");
  assert.equal(normalizeSource("label={ x }"), "label={x}");
  assert.equal(normalizeSource("f( a , b );"), "f(a,b);");
  assert.equal(normalizeSource("f(a,)"), "f(a)");
});

test("待辦清單是資料，不是宣稱已改完（R6 只改了兩個檔）", () => {
  assert.ok(
    FILES_STILL_USING_RAW_SOURCE_ASSERTIONS.length > 0,
    "清單不該是空的——本次只改了兩個檔，其餘仍有債",
  );
  for (const file of FILES_STILL_USING_RAW_SOURCE_ASSERTIONS) {
    assert.match(file, /^tests\/.+\.test\.mjs$/);
  }
  // 已經改用 helper 的兩個檔不得留在待辦清單裡。
  assert.equal(
    FILES_STILL_USING_RAW_SOURCE_ASSERTIONS.includes(
      "tests/check-in-write-handoff.test.mjs",
    ),
    false,
  );
  assert.equal(
    FILES_STILL_USING_RAW_SOURCE_ASSERTIONS.includes(
      "tests/nfc-lock-after-write.test.mjs",
    ),
    false,
  );
});
