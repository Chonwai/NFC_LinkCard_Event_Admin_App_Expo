# ADM 端的同意閘門方向（`C11`）

> 日期：2026-09-29｜Loop G（Review → Remediate → TDD Hardening）｜執行者：trinity
> 適用：`LinkCard_Event_Admin_App_Expo`（現場工作人員用 App）
> 相關：`03-contract-alignment § 3.4.3`、`BE-F12` 的跨 repo 版本
> （`LinkCard_ExpressJS_Backend/docs/cross-team-delivery/event-visitor-flow-v1/16-consent-flag-direction.md`）

## 1. 旗標與預設值

| 項目             | 值                                                                                                          |
| :--------------- | :---------------------------------------------------------------------------------------------------------- |
| 旗標名           | `EVENT_CONSENT_ENFORCE`（**伺服器端環境變數**，不在 App 內）                                                |
| 預設             | **不擋**。只有值**逐字等於** `'true'` 才啟用（`=== 'true'`）；未設、`'false'`、`'1'`、`'TRUE'` 一律**不擋** |
| 誰決定           | 後端（BE）。App 不讀這個旗標，也不做本地推論                                                                |
| 本 Loop 是否啟用 | **沒有**。Loop G 未設旗標、未寫入任何 `.env*`、未部署（`R-9`）                                              |

## 2. AdminApp 的角色：不是閘門

AdminApp **不是**同意閘門，也不假裝自己是。具體含意：

- App **不**依任何旗標決定要不要顯示／要求同意。現場代填一律顯示同意 checkbox
  （`copy.checkIn.walkInConsentLabel`），送出一律帶 `consent` 欄位。
- App 裡的本地守衛（`validateWalkInConsent`，順序 `ticketId → email → consent`）
  是**送出前的 UX 提示**，不是授權判斷。真正的判斷在伺服器。
- App 只做一件事：把伺服器回的錯誤碼**翻成現場看得懂、且可分辨**的文案
  （`mapWalkInError`）。

| 伺服器錯誤碼                        | AdminApp 顯示                                  | 現場該做什麼                     |
| :---------------------------------- | :--------------------------------------------- | :------------------------------- |
| `CONSENT_REQUIRED`                  | `copy.checkIn.walkInConsentRequired`           | 請對方讀條款並勾同意後重送       |
| `CONSENT_VERSION_MISMATCH`          | `copy.checkIn.walkInConsentVersionMismatch`    | 條款改版，重新讀並重新同意後重送 |
| `EVENT_NOT_ACCEPTING_REGISTRATIONS` | `copy.checkIn.walkInNotAccepting`              | 活動已停止收報名                 |
| 其他                                | 後端 message，否則 `copy.checkIn.walkInFailed` | —                                |

兩條 `CONSENT_*` 文案**必須互異**：把「條款改版」講成「還沒同意」會讓現場人員
把人擋在錯誤的理由上（與 `check-in-errors.ts` 的 `CRA-V1-002` 同型缺陷）。

## 3. 若之後要啟用旗標

1. **三 repo 同批**：BE 設 `EVENT_CONSENT_ENFORCE=true` 之前，FE 與 ADM 的
   `CONSENT_*` 分支必須已上線（`H4`：三 repo 無法同批部署）。
2. 啟用後 ADM 不需改版：錯誤碼分支已就位（本 Loop 交付）。
3. 關閉：把旗標移除或設為非 `'true'` 即可回到「不擋」。

## 4. 明確的非目標（未閉環的缺口）

現場代填的同意告知**仍無可讀的條款全文**：ADM 是原生 App，入口必須指向
`/terms`／`/privacy` 的**絕對 URL**，而該 URL 尚未由 PM 定案
（`ESC-VPW-003`／Loop F `ESC-008`）。本 Loop **不**發明 URL、**不**新增入口，
以 ticket `T-ADM-S5-LEGAL-ENTRY` 追蹤。⇒ `C08`（告知內容可回溯）在 ADM 端**未閉環**。

## 5. 程式落點

| 檔案                                   | 責任                                                         |
| :------------------------------------- | :----------------------------------------------------------- |
| `src/utils/walk-in-validation.ts`      | 本地守衛 + `EVENT_CONSENT_TOS_VERSION`（與 FE／BE 同值）     |
| `src/utils/walk-in-payload.ts`         | 送出 payload（含 `consent.tosVersion`／`privacyAcceptedAt`） |
| `src/utils/walk-in-error-map.ts`       | 伺服器錯誤碼 → 現場文案                                      |
| `src/app/(auth)/[eventId]/walk-in.tsx` | 接線（守衛、payload、錯誤映射）                              |
