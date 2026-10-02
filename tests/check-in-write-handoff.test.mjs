/**
 * `WP-18` 的接線鎖：報到結果卡 → 寫卡頁，交棒真的接上了。
 *
 * 為什麼需要這一支：AdminApp 沒有元件層測試（`node:test`，無 jsdom／RN renderer），
 * 所以「畫面真的多了一列 Profile、真的多了一顆把報名碼帶過去的 CTA」只能靠讀原始碼
 * 鎖住——同 `walk-in-wiring.test.mjs` / `button-focus-ring.test.mjs` 的既有做法。
 *
 * 規格依據：`93-plan-desk-nfc-pack.md` §2.1 `WP-18`（落點 #4／#5、AC-18-5）。
 * 現場痛點：沒有這個交棒，操作者每張卡要多花 30-60 秒重輸報名碼（排隊風險）。
 *
 * 反例探針（RED→GREEN 證據，實測方式見交付報告 §6）：
 * - 拿掉 `check-in.tsx` 的 Profile 列／CTA ⇒ 前兩條必紅。
 * - 把 `nfc-bind.tsx` 的 `useState(prefilledCode)` 改回 `useState("")` ⇒ 第三條必紅。
 * - 讓自動查詢沒被 ref 守衛包住 ⇒ 「只查一次」那條必紅。
 *
 * 已知界線：本檔不證明「3 秒自動重置前按得到 CTA」——那是裝置上的時間行為，屬
 * 交付報告 §8 的殘留風險，不是靜態掃描能斷言的東西。
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
const read = (rel) => readFileSync(path.join(REPO_ROOT, rel), "utf8");

const CHECK_IN = read("src/app/(auth)/[eventId]/check-in.tsx");
const NFC_BIND = read("src/app/(auth)/[eventId]/nfc-bind.tsx");
const COPY = read("src/constants/copy.zh-TW.ts");

test("WP-18：報到結果卡顯示公開檔案路徑，沒有 profile 時說的是原因而不是破折號", () => {
  assert.match(
    CHECK_IN,
    /function profilePathLabel\(/,
    "缺 profilePathLabel：無法把絕對 profileUrl 收斂成 /p/{slug}",
  );
  assert.match(
    CHECK_IN,
    /label=\{copy\.checkIn\.profileLabel\}/,
    "結果卡沒有 Profile 列",
  );
  assert.match(
    CHECK_IN,
    /profilePathLabel\(outcome\.registration\.profileUrl\)/,
    "Profile 列沒有讀後端回傳的 profileUrl",
  );
  assert.match(
    CHECK_IN,
    /copy\.checkIn\.noPublicProfile/,
    "孤兒報名（profileUrl === null）沒有顯示原因",
  );
});

test("WP-18：主 CTA 帶著報名碼推進 nfc-bind（不必再手輸一次）", () => {
  assert.match(CHECK_IN, /label=\{copy\.checkIn\.gotoWriteCard\}/);

  // 取 CTA 自己的區塊（label → 下一個 Button 的 label）再斷言。
  // 對整個檔案做 regex 會把 prettier 的斷行誤判成「沒指向寫卡頁」；
  // 用固定字元數切片則會在行寬改變時切到句子中間——兩種都真的踩過（見交付報告 §6）。
  const ctaStart = CHECK_IN.indexOf("label={copy.checkIn.gotoWriteCard}");
  const ctaEnd = CHECK_IN.indexOf("label={copy.roster.viewDetail}");
  assert.ok(ctaStart >= 0, "找不到主 CTA");
  assert.ok(ctaEnd > ctaStart, "寫卡 CTA 必須是主動作（排在 viewDetail 之前）");
  const ctaBlock = CHECK_IN.slice(ctaStart, ctaEnd);
  assert.match(
    ctaBlock,
    /"\/\(auth\)\/\[eventId\]\/nfc-bind"/,
    "CTA 沒有指向寫卡頁",
  );
  assert.match(
    ctaBlock,
    /params: \{ eventId, code \}/,
    "CTA 沒有把報名碼帶過去（那正是本包要解的重輸痛點）",
  );
});

test("WP-18：nfc-bind 以 ?code= 作欄位初值，且只自動查一次、不自動送出", () => {
  assert.match(
    NFC_BIND,
    /const \{ eventId, code: codeParam \} = useLocalSearchParams</,
    "nfc-bind 沒有讀 ?code=",
  );
  assert.match(
    NFC_BIND,
    /const prefilledCode = \(codeParam \?\? ""\)\.trim\(\)\.toUpperCase\(\);/,
  );
  assert.match(
    NFC_BIND,
    /const \[code, setCode\] = useState\(prefilledCode\)/,
    "欄位初值不是帶進來的報名碼 ⇒ prefill 沒生效",
  );
  assert.match(
    NFC_BIND,
    /if \(!eventId \|\| !prefilledCode\) return;/,
    "參數尚未到齊就消費掉自動查詢名額（會靜默不查）",
  );
  assert.match(
    NFC_BIND,
    /prefilledLookupDone\.current = true;/,
    "自動查詢沒有一次性守衛：操作者每次打字都會重查一次",
  );
  // 一次性查詢不得順手寫卡／綁卡：進場語意是「查這個人是誰」，不是「開始寫」。
  const effectStart = NFC_BIND.indexOf(
    "const prefilledLookupDone = useRef(false);",
  );
  const effectEnd = NFC_BIND.indexOf("const fail = useCallback(");
  assert.ok(
    effectStart >= 0 && effectEnd > effectStart,
    "找不到自動查詢區塊（切片端點失效會讓這條變成空轉）",
  );
  const effect = NFC_BIND.slice(effectStart, effectEnd);
  assert.equal(
    /writeAndBind|bindOnly|nfcService\.bind/.test(effect),
    false,
    "自動查詢區塊不得觸發寫卡／綁卡（AC-18-7 的 ADM 對應面）",
  );
  // 打字不得觸發查詢
  assert.equal(
    /onChangeText=\{[^}]*lookup/.test(NFC_BIND),
    false,
    "onChangeText 不得接上 lookup",
  );
});

test("WP-18：三個新文案 key 存在且有值（不得硬編中文，見 copy-routing.test.mjs）", () => {
  for (const key of ["profileLabel", "noPublicProfile", "gotoWriteCard"]) {
    assert.match(COPY, new RegExp(`${key}: "`), `copy.checkIn.${key} 缺 key`);
    assert.equal(
      new RegExp(`${key}: ""`).test(COPY),
      false,
      `copy.checkIn.${key} 是空字串`,
    );
  }
  assert.match(COPY, /profileLabel: "Profile"/);
});
