/**
 * WP-A7 簽到三態（VALID / DUPLICATE / INVALID）
 */
import type { Registration } from "@/types/api.types";

export type CheckInOutcomeKind = "valid" | "duplicate" | "invalid";

export type CheckInUiState =
  | { phase: "idle" }
  | { phase: "loading" }
  | {
      phase: "outcome";
      kind: CheckInOutcomeKind;
      code: string;
      message: string;
      registration?: Registration;
      /** 首次／本次簽到時間（ISO）；重複態優先顯示首次 */
      checkedInAt?: string | null;
    };
