/**
 * Backend 契約閘門的自我測試。
 *
 * 這支測試要證明三件事，缺一不可：
 *   1. 現在（2026-10-22 之後）App 的每一條呼叫都存在於後端路由快照裡。
 *   2. 快照本身有出處（commit + 產生時間），不是一坨來路不明的 JSON。
 *   3. **閘門真的有鑑別力**：把當初那條死路由塞回去，它必須失敗。
 *
 * 第 3 點是重點。一個永遠會過的檢查比沒有檢查更糟——它會讓人以為有人守著。
 * 2026-10-22 的審計發現 `registrations/checkin/override` 被呼叫了數個月，
 * 而所有 `tsc` / `lint` / 210 個測試都是綠的。
 */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const { checkContract, describeAppCall, extractAppCalls, pathShape } =
  await import("../scripts/check-backend-contract.mjs");

const SNAPSHOT = new URL(
  "../scripts/backend-routes.snapshot.json",
  import.meta.url,
);

test("契約閘門：目前 App 的呼叫全部存在於後端路由快照", () => {
  const { violations, unknownBase, checked } = checkContract();
  assert.deepEqual(
    violations.map((v) => `${v.method} ${v.raw}`),
    [],
    "有呼叫對不上後端路由——請確認是真的死路徑，還是快照過期",
  );
  assert.deepEqual(
    unknownBase.map((v) => v.raw),
    [],
    "有呼叫的基底不在守備範圍，describeAppCall 需要擴充",
  );
  // 12 條 events + 2 條 auth。這個數字變動時要有人看一眼。
  assert.ok(checked >= 14, `只檢查到 ${checked} 條呼叫，疑似擷取器失效`);
});

test("契約閘門：快照帶得出處", async () => {
  const snapshot = JSON.parse(
    await import("node:fs").then((fs) => fs.readFileSync(SNAPSHOT, "utf8")),
  );
  assert.ok(Array.isArray(snapshot.eventRoutes));
  assert.ok(
    snapshot.eventRoutes.length > 100,
    "路由數明顯偏少，快照可能只抓到一半",
  );
  assert.match(
    snapshot.generatedFrom.commit ?? "",
    /^[0-9a-f]{7,40}$/,
    "快照必須記錄後端 commit，否則無法判斷它對應哪個版本",
  );
  assert.ok(snapshot.generatedFrom.generatedAt);
});

test("契約閘門：死路由塞回去必須被抓到（鑑別力）", () => {
  const root = mkdtempSync(join(tmpdir(), "contract-neg-"));
  mkdirSync(join(root, "src", "services"), { recursive: true });
  writeFileSync(
    join(root, "src", "services", "regression.service.ts"),
    [
      'import { apiClient } from "./api";',
      "export async function dead(eventId: string, code: string) {",
      "  const res = await apiClient.post<unknown>(",
      "    `/api/v1/events/${encodeURIComponent(eventId)}/registrations/checkin/override`,",
      "    { registrationCode: code },",
      "  );",
      "  return res;",
      "}",
    ].join("\n"),
  );

  const { violations } = checkContract(root, SNAPSHOT);
  assert.equal(violations.length, 1, "死路由沒有被攔下來，閘門失效");
  assert.equal(
    violations[0].key,
    "POST */registrations/checkin/override",
    "攔到的不是預期的那一條",
  );
});

test("pathShape：參數一律視為 *，query 不影響形狀", () => {
  assert.deepEqual(pathShape("/:eventId/nfc/lookup"), ["*", "nfc", "lookup"]);
  assert.deepEqual(
    pathShape("/api/v1/events/${encodeURIComponent(id)}/nfc/lookup?uid=x"),
    ["api", "v1", "events", "*", "nfc", "lookup"],
  );
  assert.deepEqual(pathShape("/my-managed"), ["my-managed"]);
  assert.deepEqual(pathShape("/"), []);
});

test("describeAppCall：events 去前綴、其他 /api 走非 events 池", () => {
  assert.deepEqual(describeAppCall("/api/v1/events/by-id/${id}"), {
    scope: "event",
    path: "/by-id/:param",
  });
  assert.deepEqual(describeAppCall("/api/users/me"), {
    scope: "non-event",
    path: "/api/users/me",
  });
  assert.equal(describeAppCall("https://example.com/x"), null);
});

test("extractAppCalls：跨行泛型也抓得到，且不會抓到註解裡的示意", () => {
  const calls = extractAppCalls();
  const raws = calls.map((c) => c.raw);
  assert.ok(
    raws.includes("/api/v1/events/my-managed"),
    "純字串字面（非模板）的呼叫漏抓",
  );
  assert.ok(
    raws.some((r) => r.includes("/registrations/checkin")),
    "跨行泛型的呼叫漏抓",
  );
  assert.ok(
    !raws.some((r) => r.includes("checkin/override")),
    "已移除的死路由仍被抓到——表示擷取器讀到了註解區塊",
  );
});
