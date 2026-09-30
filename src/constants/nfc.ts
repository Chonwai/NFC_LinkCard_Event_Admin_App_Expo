/**
 * NFC 寫卡 — 領域常數（AdminApp）。
 *
 * `DEFAULT_BADGE_TYPE`：NFC 寫卡畫面的**預設卡類型**。
 *
 * 為什麼需要這個常數：`fd3c697`（2026-09-28）把預設值由 `WRISTBAND` 改成 `CARD`，
 * 並同時把 `BADGE_TYPES` 的順序改成 `CARD → WRISTBAND → QR_ONLY`；commit message
 * 只寫 `badge postion`，**未申報**這是產品行為變更（`ME-5`／`F-12`）。
 *
 * 裁決（`X-27`，2026-09-30）：PM 把「維持 `CARD`」或「改回 `WRISTBAND`」的決定
 * 委由工程以**工程判斷**裁定 ⇒ **維持 `CARD`**（`WRISTBAND` 在 `BADGE_TYPES`
 * 仍可選，現場工作人員可自行切換）。但**固化方式**被指定為：把 `nfc-bind.tsx`
 * 的 `useState<BadgeType>("CARD")` 魔法字面值抽成**單一具名常數**，使「預設值」
 * 與「首選項」不可能再各自漂移。
 *
 * 裁決 SoT：`LinkCard_ExpressJS_Backend/docs/cross-team-delivery/event-visitor-flow-v1/07-open-decisions-log.md § X-27`
 *
 * 不變式（由 `tests/nfc-bind-default-badge-type.test.mjs` 守門）：
 * 1. 本值必須等於 `nfc-bind.tsx` 的 `BADGE_TYPES[0].key` ——「首選＝預設」。
 * 2. `nfc-bind.tsx` 的 `useState<BadgeType>()` 必須**引用本常數**，不得寫回字面值。
 */
export const DEFAULT_BADGE_TYPE = "CARD";
