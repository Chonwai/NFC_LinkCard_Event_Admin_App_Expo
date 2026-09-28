/**
 * J-NFC-WRITE-QUEUE — 寫卡流程的狀態機（寫入 → 讀回 → 綁定）。
 *
 * 層級：unit（Node 內建 test runner；NFC 裝置互動以模組替身驅動，受測模組本身
 * **不被**替身取代，所以 `NfcFlowError` 是真的類別）。
 * Persona：`staff-onsite`（阿聰，已授權現場工作人員）。
 *
 * ⚠️ **本 journey 的名稱與實作現況不一致，必須揭露**（`RN1`：ID 一經發佈不得改名）：
 * 計畫 §3.4 命名為「寫卡**佇列**狀態機」並宣稱覆蓋「佇列重入被拒」，但
 * `src/` 內**沒有任何佇列實作**——寫卡是單次前景流程
 * （`writeUriToCard` → `nfcService.bind`），沒有排隊、沒有重試佇列、
 * 沒有離線排水。因此本檔覆蓋的是**已實作**的狀態機：寫入 → 讀回驗證 → 綁定，
 * 加上失敗分類與讀取器釋放；「佇列」本身列為 `T-ANQ-C1` 的 `todo`
 * 並在報告 §3 揭露（不得以測試假裝它存在）。
 *
 * **已知界線（`20-remediation-and-test-plan.md` §10.1）**：真機 NFC 感應、相機、
 * 導航、離線切換是 E2E-only。模組替身驅動的讀回值**不等於**真機讀回
 * （`Ndef.uri.decodePayload` 的 byte 解碼在真機才跑得到）⇒ 列 `[UNVERIFIED]`；
 * 本檔不得被描述為「ADM 全鏈已驗證」。
 *
 * 命名依計畫 §5.3（`RN1`–`RN5`）：`describe` 第 1 段＝journey ID、第 3 段＝persona；
 * `it` 名稱同時寫出觸發條件與可觀察後果。`T-ANQ-*` 前綴對應計畫 §4.3 的 test ID。
 *
 * **CHARACTERIZATION 範圍（`K32`／計畫 §7.4）**：本檔在受測實作已存在且綠之後撰寫，
 * 因此各條記載的是**現狀**。逐條登錄於
 * `docs/review/visitorflow-remediation-tdd-20260929/characterization-register-adm.md`。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, mock } from "node:test";
import { fileURLToPath } from "node:url";

mock.module("react-native", {
  namedExports: { Platform: { OS: "android" } },
});

/** 測試控制的讀回值（`Ndef.uri.decodePayload` 的回傳）。 */
let readBackUri = "";
/** 非 null 時，寫入階段以此錯誤收尾（重現「卡片離開感應區」）。 */
let writeFailure = null;
/** 讀取器被釋放的次數（`F-01`）。 */
let cancelCalls = 0;

mock.module("react-native-nfc-manager", {
  defaultExport: {
    requestTechnology: () => Promise.resolve("Ndef"),
    cancelTechnologyRequest: () => {
      cancelCalls += 1;
      return Promise.resolve();
    },
    getTag: async () => ({ id: "04A1B2C3" }),
    ndefHandler: {
      writeNdefMessage: async () => {
        if (writeFailure) throw writeFailure;
      },
      getNdefMessage: async () => ({ ndefMessage: [{ payload: [1, 2, 3] }] }),
    },
  },
  namedExports: {
    NfcTech: { Ndef: "Ndef" },
    Ndef: {
      encodeMessage: () => [1, 2, 3],
      uriRecord: (uri) => uri,
      uri: { decodePayload: () => readBackUri },
    },
  },
});

const { buildRegistrationProfileUrl, NfcFlowError, writeUriToCard } =
  await import("@/utils/nfc-utils");
const { classifyNfcBindError } = await import("@/utils/nfc-bind-errors");
const { copy } = await import("@/constants/copy.zh-TW");

// `tests/journeys/` 在 repo 根之下兩層（`tests/*.test.mjs` 只差一層，不可照抄）。
const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const NFC_BIND_SCREEN = readFileSync(
  path.join(REPO_ROOT, "src/app/(auth)/[eventId]/nfc-bind.tsx"),
  "utf8",
);

function resetNfc() {
  readBackUri = "";
  writeFailure = null;
  cancelCalls = 0;
}

describe("J-NFC-WRITE-QUEUE 寫卡流程狀態機 [persona:staff-onsite]", () => {
  it("T-ANQ-H1 given 卡片可寫且讀回值與寫入值相符, when 寫入後立即讀回, then 回傳卡片編號與讀回網址（寫入成功）", async () => {
    resetNfc();
    const url = buildRegistrationProfileUrl("abc-123");
    readBackUri = url;

    const result = await writeUriToCard(url, { timeoutMs: 1000 });

    assert.deepEqual(result, { tagUid: "04A1B2C3", writtenUri: url });
  });

  it("T-ANQ-S1 given 讀回的網址是另一個人的名片, when 寫入後讀回, then 以 uri-mismatch 中止綁定且放掉讀取器", async () => {
    resetNfc();
    const url = buildRegistrationProfileUrl("abc-123");
    readBackUri = buildRegistrationProfileUrl("abd-123");
    assert.notEqual(readBackUri, url);

    await assert.rejects(
      () => writeUriToCard(url, { timeoutMs: 1000 }),
      (error) => error instanceof NfcFlowError && error.kind === "uri-mismatch",
    );

    // 讀取器不得留在開啟狀態（`F-01`／`CRA-V1-009`）：留在開啟狀態會讓同一場次
    // 之後的每一次寫卡都失敗。
    assert.ok(cancelCalls >= 1, `讀取器未被釋放（cancel=${cancelCalls}）`);
  });

  it("T-ANQ-S2 given 寫入階段卡片離開感應區, when 寫入, then 以寫卡失敗收尾（不是綁定失敗、也不是成功）", async () => {
    resetNfc();
    const url = buildRegistrationProfileUrl("abc-123");
    writeFailure = new Error("Tag was lost");

    const error = await writeUriToCard(url, { timeoutMs: 1000 }).then(
      () => null,
      (thrown) => thrown,
    );

    assert.ok(
      error instanceof NfcFlowError,
      "寫入失敗必須以 NfcFlowError 收尾",
    );
    assert.equal(error.kind, "write-failed");
    assert.equal(classifyNfcBindError(error), "write-failed");
    // 不得被歸類成「後端綁定失敗」（那會讓現場去重試綁定，而卡片其實沒寫進去）。
    assert.notEqual(classifyNfcBindError(error), "bind-failed");
    assert.notEqual(classifyNfcBindError(error), "cancelled");
  });

  it("T-ANQ-S2b [static] given 寫入失敗, when 檢視畫面的處置順序, then 後端綁定只可能在寫入成功之後（該卡不得被發放，原 QR 路徑不受影響）", () => {
    const start = NFC_BIND_SCREEN.indexOf("const writeAndBind = useCallback(");
    const end = NFC_BIND_SCREEN.indexOf("[bindOnly, blocked, eventId, fail],");
    assert.ok(start >= 0 && end > start, "找不到 writeAndBind 的函式邊界");
    const body = NFC_BIND_SCREEN.slice(start, end);

    const write = body.indexOf("const { tagUid } = await writeUriToCard(");
    const bind = body.indexOf("await bindOnly(");

    assert.ok(write >= 0, "寫入呼叫不在 writeAndBind 內");
    assert.ok(bind >= 0, "綁定呼叫不在 writeAndBind 內");
    assert.ok(write < bind, "綁定必須在寫入之後，否則寫失敗的卡仍會被綁定");
    // 綁定用的是「寫入時讀回驗證過的」那張卡，不是另外再讀一次。
    assert.match(body, /const \{ tagUid \} = await writeUriToCard\(/);

    // 現場看到的字：寫卡失敗 → 自己的文案，不得是成功文案。
    assert.match(
      NFC_BIND_SCREEN,
      /["']write-failed["']:\s*copy\.nfc\.writeFailed/,
    );
  });

  it("T-ANQ-E1 given 讀回值只差一個尾斜線, when 寫入後讀回, then 仍視為相符並回傳讀回值（尾斜線不算不同）", async () => {
    resetNfc();
    const url = buildRegistrationProfileUrl("abc-123");
    readBackUri = `${url}/`;

    const result = await writeUriToCard(url, { timeoutMs: 1000 });

    assert.equal(result.writtenUri, `${url}/`);
  });

  it("T-ANQ-E2 given 讀回值是真正不同的路徑, when 寫入後讀回, then 以 uri-mismatch 拒絕（證明 E1 不是恆真）", async () => {
    resetNfc();
    const url = buildRegistrationProfileUrl("abc-123");
    readBackUri = url.replace(/abc-123$/, "abd-123");

    await assert.rejects(
      () => writeUriToCard(url, { timeoutMs: 1000 }),
      (error) => error instanceof NfcFlowError && error.kind === "uri-mismatch",
    );
  });

  it(
    "T-ANQ-C1 應然: 寫卡佇列的排隊、重入與排水（ADM 尚無佇列實作，探索後固化）",
    {
      todo: true,
    },
  );
});
