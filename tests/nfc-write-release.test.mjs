/**
 * `F-01`（`CRA-V1-009`）的風險控制測試：逾時／取消時 NFC reader 必須被釋放。
 *
 * 這個檔案存在的唯一理由：證明「外層 `finally` 有釋放讀取器」。
 * 逾時之所以存在，正是因為內層寫入可能**永不 settle**——那種情況下內層的
 * `finally` 永遠不會執行，讀取器會被永久佔住，現場整個場次再也寫不了卡
 * （Android 上後續 `requestTechnology` 失敗，只能重啟 App）。
 *
 * 載入鏈：`nfc-utils` → `react-native`（mock）＋動態
 * `import("react-native-nfc-manager")`（同樣以 mock 攔截）。`nfc-utils`
 * **不**被 mock，這樣 `NfcFlowError` 才是真的類別，`kind` 斷言才有意義。
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

mock.module("react-native", {
  namedExports: { Platform: { OS: "android" } },
});

const PROFILE_URL = "https://linkcard.xyz/u/abc";

let cancelCalls = 0;
let cancelBehaviour = () => Promise.resolve();
/** true ＝ 內層操作永不 settle，重現「逾時之所以存在」的前提 */
let holdWriteOpen = false;

mock.module("react-native-nfc-manager", {
  defaultExport: {
    requestTechnology: () => {
      if (holdWriteOpen) {
        return new Promise(() => {});
      }
      return Promise.resolve("Ndef");
    },
    cancelTechnologyRequest: () => {
      cancelCalls += 1;
      return cancelBehaviour();
    },
    getTag: async () => ({ id: "04A1B2C3" }),
    ndefHandler: {
      writeNdefMessage: async () => undefined,
      getNdefMessage: async () => ({ ndefMessage: [{ payload: [1, 2, 3] }] }),
    },
  },
  namedExports: {
    NfcTech: { Ndef: "Ndef" },
    Ndef: {
      encodeMessage: () => [1, 2, 3],
      uriRecord: (uri) => uri,
      uri: { decodePayload: () => PROFILE_URL },
    },
  },
});

const { writeUriToCard } = await import("@/utils/nfc-utils");

function resetNfc() {
  cancelCalls = 0;
  cancelBehaviour = () => Promise.resolve();
  holdWriteOpen = false;
}

test("F-01：逾時時，外層 finally 仍釋放 reader（即使內層永不 settle）", async () => {
  resetNfc();
  holdWriteOpen = true;

  await assert.rejects(
    () => writeUriToCard(PROFILE_URL, { timeoutMs: 5 }),
    (error) => error.kind === "timeout",
  );

  // 內層 promise 從未 settle → 它的 finally 不可能跑過 → 這次釋放只能來自外層。
  assert.equal(cancelCalls, 1);
});

test("F-01：釋放失敗不得蓋掉逾時錯誤（第二次 cancel 被拒仍回逾時）", async () => {
  resetNfc();
  holdWriteOpen = true;
  cancelBehaviour = () => Promise.reject(new Error("no active request"));

  await assert.rejects(
    () => writeUriToCard(PROFILE_URL, { timeoutMs: 5 }),
    (error) => error.kind === "timeout",
  );

  assert.equal(cancelCalls, 1);
});

test("F-01 對照組：成功路徑保留內層釋放，且雙重 cancel 無害", async () => {
  resetNfc();

  const result = await writeUriToCard(PROFILE_URL, { timeoutMs: 1000 });

  assert.deepEqual(result, { tagUid: "04A1B2C3", writtenUri: PROFILE_URL });
  // 內層 + 外層各一次：同時證明「內層釋放被保留」與「外層重複 cancel 無害」。
  assert.equal(cancelCalls, 2);
});
