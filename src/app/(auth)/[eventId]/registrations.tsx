import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";

import { BatchSendClaimEmailModal } from "@/components/roster/BatchSendClaimEmailModal";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon, type IconName } from "@/components/ui/Icon";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { copy } from "@/constants/copy.zh-TW";
import { layout, semantic, space, spacing, type } from "@/constants/theme";
import { eventService, listPageCount } from "@/services/event.service";
import { registrationService } from "@/services/registration.service";
import type { Registration, TicketTypeItem } from "@/types/api.types";
import { getApiErrorCode, getApiErrorStatus } from "@/utils/api-error";
import { rememberRegistrationList } from "@/utils/registration-list-cache";
import {
  type DepositRefundFilter,
  type RegistrationVisibility,
  buildRegistrationListQuery,
} from "@/utils/registration-filters";
import {
  REVERSE_ACTION,
  type ManageAction,
  correctionTargetFor,
  manageActionsFor,
} from "@/utils/registration-actions";
import {
  buildRegistrationPaymentUrl,
  getRegistrationCompany,
  getRegistrationDisplayName,
  maskEmail,
} from "@/utils/registration-display";
import {
  type EmailStatusFilter,
  type EmailStatusTone,
  countActionable,
  emailStatusDetail,
  emailStatusLabel,
  emailStatusTone,
  matchesEmailStatusFilter,
} from "@/utils/registration-email-status";

const PAGE_SIZE = 20;
const COPY_FEEDBACK_MS = 1800;

/**
 * 語意 tone → 實際顏色。
 *
 * App 的 `semantic.status` 沒有 `info` 這一格；Web 把 `SENT_NOT_OPENED`
 * （已寄出、尚未領取）標成 `info`。這裡落到 `pending`（紫）——也就是「進行中、
 * 等對方動作」，與既有紫色標籤同一語意家族，而不是自己造一組顏色。
 */
const EMAIL_TONE: Record<EmailStatusTone, { fg: string; bg: string }> = {
  success: semantic.status.success,
  info: semantic.status.pending,
  neutral: semantic.status.neutral,
  warning: semantic.status.warning,
  danger: semantic.status.danger,
};

/** 可見性／封存四項的按钮文案與完成文案。狀態修正的文案依目前狀態變，見 `actionCopyFor`。 */
const VISIBILITY_COPY: Record<
  Exclude<ManageAction, "correct" | "refund" | "resendConfirmation">,
  { label: string; done: string }
> = {
  hide: { label: copy.roster.manage.hide, done: copy.roster.manage.hideDone },
  unhide: {
    label: copy.roster.manage.unhide,
    done: copy.roster.manage.unhideDone,
  },
  archive: {
    label: copy.roster.manage.archive,
    done: copy.roster.manage.archiveDone,
  },
  unarchive: {
    label: copy.roster.manage.unarchive,
    done: copy.roster.manage.unarchiveDone,
  },
};

/** 動作 → icon。只影響按鈕圖示，不影響行為。 */
const ACTION_ICON: Record<ManageAction, IconName> = {
  hide: "eye-off",
  unhide: "eye",
  archive: "archive",
  unarchive: "refresh",
  correct: "check-circle",
  refund: "clipboard-check",
  resendConfirmation: "copy",
};

/** 動作 → 按鈕文案 / 完成文案。 */
function actionCopyFor(
  reg: Registration,
  action: ManageAction,
): { label: string; done: string } {
  if (action === "correct") {
    return correctionTargetFor(reg) === "CHECKED_IN"
      ? {
          label: copy.roster.manage.markCheckedIn,
          done: copy.roster.manage.markCheckedInDone,
        }
      : {
          label: copy.roster.manage.undoCheckIn,
          done: copy.roster.manage.undoCheckInDone,
        };
  }
  if (action === "refund") {
    return {
      label: copy.roster.manage.refund,
      done: copy.roster.manage.refundDone,
    };
  }
  if (action === "resendConfirmation") {
    // `done` 只能是「已排入佇列」——後端只重置 outbox 意圖，不是直接寄。
    return {
      label: copy.roster.manage.resendConfirmation,
      done: copy.roster.manage.resendConfirmationQueued,
    };
  }
  return VISIBILITY_COPY[action];
}

/**
 * 管理面板各動作需要的輸入。
 *
 * 用一個 draft 物件而不是一個 `reason` 字串：押金退款需要金額／匯款號／備註，
 * 而它們必須跟其他動作**共用同一份送出脈絡**——否則等於為了一種動作再拉一條
 * 平行的送出流程，兩條很快就會漂移。
 */
interface ManageDraft {
  reason: string;
  amount: string;
  reference: string;
  note: string;
}

/**
 * 依動作呼叫對應端點。
 *
 * `unhide`／`unarchive` **不吃原因**——不是「忽略了參數」，而是那兩條端點
 * 的契約本來就沒有 body（見 `registrationService` 的註解）。這裡故意不分派
 * 原因，讓「誰需要理由」只有一個地方在決定。
 */
async function performManageAction(
  eventId: string,
  reg: Registration,
  action: ManageAction,
  draft: ManageDraft,
): Promise<void> {
  switch (action) {
    case "hide":
      await registrationService.hide(eventId, reg.id, draft.reason.trim());
      return;
    case "archive":
      await registrationService.archive(eventId, reg.id, draft.reason.trim());
      return;
    case "unhide":
      await registrationService.unhide(eventId, reg.id);
      return;
    case "unarchive":
      await registrationService.unarchive(eventId, reg.id);
      return;
    case "correct": {
      const target = correctionTargetFor(reg);
      // 依建構方式不可能為 null（按鈕只在有 target 時出現）；若真的走到這裡，
      // 寧可什麼都不做，也不要瞎猜一個目標狀態送出去。
      if (target === null) return;
      await registrationService.updateStatus(eventId, reg.id, {
        targetStatus: target,
        reason: draft.reason.trim(),
      });
      return;
    }
    case "refund":
      await registrationService.markDepositRefund(eventId, reg.id, {
        amount: Number(draft.amount),
        reference: draft.reference.trim() || undefined,
        note: draft.note.trim() || undefined,
      });
      return;
    case "resendConfirmation":
      // 重寄確認信不吃原因；它也不需要（後端把動作寫在 outbox 列上）。
      await registrationService.resendConfirmation(eventId, reg.id);
      return;
  }
}

/**
 * 管理動作失敗 → 使用者看得懂的文案。
 *
 * 為何不只分 403／其他：重寄確認信有兩條「再試也没用」的失敗（沒帳號、
 * 狀態未確認），把它們歸到「請稍後再試」會讓操作員一直重試同一個確定會錯的
 * 動作。後端錯誤碼逐一對應，剩下的才落到通用失敗。
 */
function manageActionError(err: unknown): string {
  if (getApiErrorStatus(err) === 403) return copy.roster.manage.forbidden;
  switch (getApiErrorCode(err)) {
    case "CONFIRMATION_EMAIL_NOT_APPLICABLE":
      return copy.roster.manage.resendConfirmationNotApplicable;
    case "REGISTRATION_NOT_FOUND_OR_NOT_CONFIRMED":
      return copy.roster.manage.resendConfirmationNotConfirmed;
    default:
      return copy.roster.manage.failed;
  }
}

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "", label: copy.roster.filterAll },
  { key: "CONFIRMED", label: copy.roster.statusLabels.CONFIRMED },
  { key: "CHECKED_IN", label: copy.roster.statusLabels.CHECKED_IN },
  { key: "PENDING_PAYMENT", label: copy.roster.statusLabels.PENDING_PAYMENT },
  { key: "CANCELLED", label: copy.roster.statusLabels.CANCELLED },
];

function statusLabel(status: string): string {
  const labels = copy.roster.statusLabels;
  if (status in labels) {
    return labels[status as keyof typeof labels];
  }
  return status;
}

function statusTone(status: string) {
  switch (status) {
    case "CHECKED_IN":
      return semantic.status.success;
    case "CONFIRMED":
      return semantic.status.available;
    case "PENDING_PAYMENT":
      return semantic.status.warning;
    case "CANCELLED":
    case "NO_SHOW":
      return semantic.status.danger;
    default:
      return semantic.status.neutral;
  }
}

function formatRegisteredAt(iso: string | undefined): string {
  if (!iso) return copy.event.dash;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hours}:${minutes}`;
}

function matchesQuery(item: Registration, query: string): boolean {
  const hay = [
    getRegistrationDisplayName(item),
    item.email,
    item.phone,
    item.profile?.phone,
    item.registrationCode,
    item.company,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(query);
}

/** 一列篩選選項（icon + 等寬 chip），給可見性與押金退款共用。 */
function ChipLine<T extends string>({
  icon,
  options,
  value,
  onChange,
}: {
  icon: IconName;
  options: { key: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View style={styles.toolLine}>
      <Icon name={icon} size="sm" color={semantic.icon.muted} />
      <View style={styles.toolOptions}>
        {options.map((item) => {
          const selected = value === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => onChange(item.key)}
              style={[styles.filterItem, selected && styles.itemOn]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text
                style={[styles.optionText, selected && styles.optionOn]}
                numberOfLines={1}
                maxFontSizeMultiplier={layout.maxFontScaleFixed}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function RegistrationsScreen() {
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const [items, setItems] = useState<Registration[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [status, setStatus] = useState("");
  // 其餘三個篩選（Web 的票種分頁籤、可見性、押金退款）。
  const [visibility, setVisibility] =
    useState<RegistrationVisibility>("active");
  const [ticketTypeId, setTicketTypeId] = useState("all");
  const [depositRefunded, setDepositRefunded] =
    useState<DepositRefundFilter>("all");
  /**
   * Email 狀態篩選（Web `page.tsx:435-450`）。
   *
   * **不進 `listQuery`**：後端 `GET /registrations` 沒有這個查詢維度，Web 也
   * 是拿回整頁後在前端篩。所以它只作用於**已載入**的列，畫面上另有說明
   * （`filterScopeHint`），不假裝是全域篩選。
   */
  const [emailStatusFilter, setEmailStatusFilter] =
    useState<EmailStatusFilter>("all");
  const [ticketTypes, setTicketTypes] = useState<TicketTypeItem[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"server" | "name" | "recent">("server");
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  /**
   * 剛才複製了哪一列的哪一樣東西（`code` / `payment`）。
   *
   * 用一組 `(id, kind)` 而不是兩個獨立的 state：兩者共用一個計時器與一份
   * 「誰剛被複製」的事實，分開存就會出現「編號還是打勾、付款連結已經熄掉」
   * 這種自相矛盾的畫面。
   */
  const [copied, setCopied] = useState<{
    id: string;
    kind: "code" | "payment";
  } | null>(null);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 名單管理（隱藏／取消隱藏）────────────────────────────────────────
  // `manage`＝正在操作哪一筆；`pendingAction`＝已選動作、等填原因。
  // 兩個 state 分開，是因為「先選動作、再填原因」是兩步；把它們壓成一個 union
  // 會讓「只打開選單」與「已選動作」共用同一個 modal 而分不清楚。
  const [manage, setManage] = useState<Registration | null>(null);
  const [pendingAction, setPendingAction] = useState<ManageAction | null>(null);
  const [reason, setReason] = useState("");
  // 押金退款的三個輸入（Web `DepositRefundModal`）：金額、匯款號、備註。
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  /**
   * 上一次成功操作的提示。有值才顯示頂部橫幅。
   *
   * `undo` 有值才長出「復原」鈕：匯出這類一次性提示沒有反向操作。
   */
  const [notice, setNotice] = useState<{
    message: string;
    /** 匯出失敗／無資料不是「成功」，橫幅顏色要跟隨事實。 */
    tone: "success" | "danger";
    undo?: { reg: Registration; reverse: ManageAction };
  } | null>(null);
  const [exporting, setExporting] = useState(false);
  /**
   * 批次寄送 claim email 面板（FE-08）。
   *
   * 點「開啟」**不寄任何信**（`S-5`／AC4）——面板本身只是把收件人選出來，
   * 真正寄送發生在面板的「確認寄送」。
   */
  const [batchOpen, setBatchOpen] = useState(false);

  /**
   * 送給後端的查詢參數。三個載入路徑（首次／下拉更新／載入更多）共用這一份，
   * 否則「篩選只在第一頁生效」這種經典錯誤遲早會出現。
   */
  const listQuery = useMemo(
    () =>
      buildRegistrationListQuery({
        status,
        ticketTypeId,
        visibility,
        depositRefunded,
      }),
    [status, ticketTypeId, visibility, depositRefunded],
  );
  const filterKey = `${status}|${ticketTypeId}|${visibility}|${depositRefunded}`;
  const requestKey = `${eventId ?? ""}:${filterKey}`;
  const loading = Boolean(eventId) && loadedKey !== requestKey && !error;

  useEffect(() => {
    return () => {
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    };
  }, []);

  /**
   * 複製一段文字到剪貼簿，並讓那一列顯示「已複製」。
   *
   * `kind` 不是為了美觀：同一列可能有兩個可複製的東西（報名編號、付款連結），
   * 只記 `id` 會讓兩個按鈕同時變成打勾。沿用 App 既有的 `expo-clipboard`
   * （`badges.tsx` 也在用），不新增依賴。
   */
  const copyValue = useCallback(
    (id: string, kind: "code" | "payment", value: string) => {
      void Clipboard.setStringAsync(value).then(() => {
        setCopied({ id, kind });
        if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
        copyResetTimer.current = setTimeout(() => {
          setCopied(null);
          copyResetTimer.current = null;
        }, COPY_FEEDBACK_MS);
      });
    },
    [],
  );

  useEffect(() => {
    if (!eventId) return;
    let active = true;
    void eventService
      .getRegistrations(eventId, {
        page: 1,
        limit: PAGE_SIZE,
        ...listQuery,
      })
      .then((res) => {
        if (!active) return;
        setItems(res.registrations ?? []);
        setPage(1);
        setPageCount(listPageCount(res.pagination));
        setError(null);
        setLoadedKey(`${eventId}:${filterKey}`);
      })
      .catch((err: unknown) => {
        if (!active) return;
        const forbidden = getApiErrorStatus(err) === 403;
        setError(
          forbidden ? copy.roster.operatorForbidden : copy.roster.loadFailed,
        );
        setItems([]);
        setLoadedKey(`${eventId}:${filterKey}`);
      });
    return () => {
      active = false;
    };
  }, [eventId, listQuery, filterKey]);

  /**
   * 把當前名單記進記憶體快取，供詳情頁取用。
   *
   * 詳情頁需要 `isHidden / archivedAt / depositRefunded* / emailStatus` 這些
   * 欄位，而它們**只**在名單端點出現（後端沒有「用 id 取完整詳情」的端點）。
   * 名單已經載入了，就不要再讓詳情頁去求一個拿不到的答案。
   * 掛在 `items` 上而不是逐一修改三條載入路徑——三條路徑最後都會 setItems。
   */
  useEffect(() => {
    if (!eventId) return;
    rememberRegistrationList(eventId, items);
  }, [eventId, items]);

  /**
   * 票種清單（給票種篩選用）。
   *
   * 失敗就**不顯示那一列**——票種篩選是加分項，不該讓它拖垮整頁；Web 也是
   * `ticketTypes.length > 0` 才渲染。
   */ useEffect(() => {
    if (!eventId) return;
    let active = true;
    void eventService
      .listTicketTypes(eventId)
      .then((res) => {
        if (active) setTicketTypes(res.ticketTypes ?? []);
      })
      .catch(() => {
        if (active) setTicketTypes([]);
      });
    return () => {
      active = false;
    };
  }, [eventId]);

  const refresh = useCallback(async () => {
    if (!eventId) return;
    setRefreshing(true);
    setError(null);
    try {
      const res = await eventService.getRegistrations(eventId, {
        page: 1,
        limit: PAGE_SIZE,
        ...listQuery,
      });
      setItems(res.registrations ?? []);
      setPage(1);
      setPageCount(listPageCount(res.pagination));
      setLoadedKey(`${eventId}:${filterKey}`);
    } catch (err) {
      const forbidden = getApiErrorStatus(err) === 403;
      setError(
        forbidden ? copy.roster.operatorForbidden : copy.roster.loadFailed,
      );
    } finally {
      setRefreshing(false);
    }
  }, [eventId, listQuery, filterKey]);

  const loadMore = useCallback(async () => {
    if (!eventId || loading || loadingMore || page >= pageCount) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await eventService.getRegistrations(eventId, {
        page: nextPage,
        limit: PAGE_SIZE,
        ...listQuery,
      });
      setItems((prev) => [...prev, ...(res.registrations ?? [])]);
      setPage(nextPage);
      setPageCount(listPageCount(res.pagination));
    } catch (err) {
      const forbidden = getApiErrorStatus(err) === 403;
      setError(
        forbidden ? copy.roster.operatorForbidden : copy.roster.loadFailed,
      );
    } finally {
      setLoadingMore(false);
    }
  }, [eventId, loading, loadingMore, page, pageCount, listQuery]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = q ? items.filter((item) => matchesQuery(item, q)) : items;
    // Email 狀態篩選（client-side，同 Web）。放在關鍵字之後、排序之前：
    // 先縮小集合再排，排序成本才不會白花在會被篩掉的列上。
    if (emailStatusFilter !== "all") {
      rows = rows.filter((item) =>
        matchesEmailStatusFilter(item.emailStatus, emailStatusFilter),
      );
    }
    if (sort === "name") {
      rows = [...rows].sort((a, b) =>
        getRegistrationDisplayName(a).localeCompare(
          getRegistrationDisplayName(b),
        ),
      );
    } else if (sort === "recent") {
      rows = [...rows].sort((a, b) =>
        (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
      );
    }
    return rows;
  }, [items, query, sort, emailStatusFilter]);

  /** 「待處理」chip 的計數（Web `page.tsx:85`）。算在**已載入**的列上。 */
  const actionableCount = useMemo(() => countActionable(items), [items]);

  /** 「原因」是否必填（`hide`／`archive`／狀態修正要，取消類與退款不要）。 */
  const needsReason =
    pendingAction === "hide" ||
    pendingAction === "archive" ||
    pendingAction === "correct";
  /** 必填而未填。 */
  const reasonMissing = needsReason && reason.trim() === "";
  /** 退款金額必須 > 0（對齊後端 `@Min(0.01)`）。 */
  const amountMissing = pendingAction === "refund" && !(Number(amount) > 0);
  /** 確認鈕的 disabled 條件。 */
  const confirmBlocked = reasonMissing || amountMissing;
  /**
   * 確認鈕的語意色：只有**破壞性**的 hide／archive 用紅色；取消類、狀態修正
   * 與退款登記用主色（登記一筆已發生的事不是在刪資料）。
   */
  const confirmIsDanger =
    pendingAction === "hide" || pendingAction === "archive";

  /** 清空所有輸入（開動作、返回上一層、關閉面板都做同一件事）。 */
  const resetDraft = useCallback(() => {
    setReason("");
    setAmount("");
    setReference("");
    setNote("");
    setActionError(null);
  }, []);

  /** 打開某一筆的管理選單。 */
  const openManage = useCallback(
    (reg: Registration) => {
      setManage(reg);
      setPendingAction(null);
      resetDraft();
    },
    [resetDraft],
  );

  const closeManage = useCallback(() => {
    if (busy) return;
    setManage(null);
    setPendingAction(null);
    resetDraft();
  }, [busy, resetDraft]);

  /**
   * 執行一項名單管理動作，成功後**重載第一頁**。
   *
   * 為何不就地改那一列：後端會回整筆 registration，但 `visibility: "active"`
   * 的篩選是後端做的，就地改狀態會讓一筆已隱藏的資料繼續留在畫面上，
   * 看起來像沒生效。
   */
  const runManageAction = useCallback(
    async (reg: Registration, action: ManageAction, draft: ManageDraft) => {
      if (!eventId) return;
      setBusy(true);
      setActionError(null);
      try {
        await performManageAction(eventId, reg, action, draft);
        const reverse = REVERSE_ACTION[action];
        setNotice({
          message: actionCopyFor(reg, action).done,
          tone: "success",
          ...(reverse ? { undo: { reg, reverse } } : {}),
        });
        setManage(null);
        setPendingAction(null);
        resetDraft();
        await refresh();
      } catch (err) {
        setActionError(manageActionError(err));
      } finally {
        setBusy(false);
      }
    },
    [eventId, refresh, resetDraft],
  );

  /**
   * 「復原」＝呼叫相反端點。失敗只改提示，不覆蓋清單。
   *
   * 狀態修正**沒有**復原：它的「反向」是把剛才的修正再修正回去，而那一樣需要
   * 理由（後端稽核）。Web 的狀態修正 toast 同樣只有確認文字、沒有 undo，
   * 這裡對齊。
   */
  const runUndo = useCallback(async () => {
    const pendingUndo = notice?.undo;
    if (!eventId || !pendingUndo) return;
    const { reg, reverse } = pendingUndo;
    setNotice(null);
    try {
      await performManageAction(eventId, reg, reverse, {
        reason: copy.roster.manage.undoReason,
        amount: "",
        reference: "",
        note: "",
      });
      await refresh();
    } catch (err) {
      setError(
        getApiErrorStatus(err) === 403
          ? copy.roster.manage.forbidden
          : copy.roster.manage.failed,
      );
    }
  }, [eventId, refresh, notice]);

  /**
   * 匯出報名名單（CSV）。
   *
   * Web 用 `downloadTextFile` 直接把檔案丟給瀏覽器；App **沒有檔案系統**，
   * 所以改走系統分享（`Share` 是 React Native 核心元件，零新依賴）——
   * 使用者可以把 CSV 存到檔案、寄出或丟進雲端硬碟。
   *
   * 分享不可用時退回剪貼簿（`expo-clipboard` 已在用）。兩條路都讓操作者
   * **真的拿到**那份 CSV；只顯示「已匯出」而不給內容就是說謊。
   *
   * ⚠️ 已知限制（誠實邊界）：大檔（數千列以上）走 `Share` 的 `message`
   * 在部分 Android 版本會被 intent 大小上限截斷或直接失敗；失敗會落到
   * 剪貼簿那條，但剪貼簿本身也有大小限制。要真正「下載檔案」需要
   * `expo-file-system` + `expo-sharing` 兩個新依賴，依指示沒有自行加。
   */
  const handleExport = useCallback(async () => {
    if (!eventId || exporting) return;
    setExporting(true);
    setNotice(null);
    try {
      const csv = await registrationService.exportAttendeesCsv(eventId);

      /*
       * 「有沒有資料」看換行而不是看字串長度：表頭固定存在，所以只有表頭時
       * 整份 CSV 不含任何 `\n`（表頭本身不會被引號包住）。
       */
      if (!csv.includes("\n")) {
        setNotice({ message: copy.roster.manage.exportEmpty, tone: "danger" });
        return;
      }

      try {
        await Share.share({ message: csv });
        setNotice({
          message: copy.roster.manage.exportShareOpened,
          tone: "success",
        });
      } catch {
        await Clipboard.setStringAsync(csv);
        setNotice({
          message: copy.roster.manage.exportCopied,
          tone: "success",
        });
      }
    } catch (err) {
      setNotice({
        message:
          getApiErrorStatus(err) === 403
            ? copy.roster.manage.forbidden
            : copy.roster.manage.exportFailed,
        tone: "danger",
      });
    } finally {
      setExporting(false);
    }
  }, [eventId, exporting]);

  if (!eventId) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ScreenHeader
          title={copy.roster.title}
          leading="back"
          backFallbackPath="/(auth)/home"
        />
        <View style={styles.emptyBody}>
          <EmptyState
            kind="no-results"
            headingLevel={2}
            title={copy.event.unavailableTitle}
            description={copy.event.unavailableHint}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={copy.roster.title}
        leading="back"
        backFallbackPath="/(auth)/home"
      />
      <FlatList
        data={loading ? [] : visible}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void refresh();
            }}
          />
        }
        onEndReached={() => {
          if (loading || loadingMore || page >= pageCount) return;
          void loadMore();
        }}
        onEndReachedThreshold={0.4}
        contentContainerStyle={{
          padding: spacing.screen,
          paddingBottom: insets.bottom + spacing.safeFooter,
          gap: space[3],
        }}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            {error ? <InlineBanner tone="danger" message={error} /> : null}
            {notice ? (
              <InlineBanner
                tone={notice.tone}
                message={notice.message}
                actionLabel={notice.undo ? copy.roster.manage.undo : undefined}
                onAction={
                  notice.undo
                    ? () => {
                        void runUndo();
                      }
                    : undefined
                }
                dismissible
                onDismiss={() => setNotice(null)}
              />
            ) : null}
            {/* 匯出：對應 Web 標題列的「下載名單（CSV）」 */}
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => setBatchOpen(true)}
                style={({ pressed }) => [
                  styles.headerAction,
                  pressed && styles.rowPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={copy.roster.batchClaim.open}
              >
                <Icon
                  name="information-circle"
                  size="sm"
                  color={semantic.text.secondary}
                />
                <Text
                  style={styles.headerActionText}
                  maxFontSizeMultiplier={layout.maxFontScaleFixed}
                >
                  {copy.roster.batchClaim.open}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void handleExport();
                }}
                disabled={exporting}
                style={({ pressed }) => [
                  styles.headerAction,
                  pressed && styles.rowPressed,
                  exporting && styles.headerActionDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel={copy.roster.manage.exportOpen}
                accessibilityState={{ disabled: exporting, busy: exporting }}
              >
                <Icon
                  name="clipboard-check"
                  size="sm"
                  color={semantic.text.secondary}
                />
                <Text
                  style={styles.headerActionText}
                  maxFontSizeMultiplier={layout.maxFontScaleFixed}
                >
                  {exporting
                    ? copy.roster.manage.exporting
                    : copy.roster.manage.exportAction}
                </Text>
              </Pressable>
            </View>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={copy.roster.searchPlaceholder}
              placeholderTextColor={semantic.text.muted}
              autoCorrect={false}
              autoCapitalize="none"
              style={styles.search}
              accessibilityLabel={copy.roster.searchPlaceholder}
            />
            <View style={styles.toolbar}>
              <View style={styles.toolLine}>
                <Icon name="filter" size="sm" color={semantic.icon.muted} />
                <View style={styles.toolOptions}>
                  {STATUS_FILTERS.map((item) => {
                    const selected = status === item.key;
                    return (
                      <Pressable
                        key={item.key || "all"}
                        onPress={() => setStatus(item.key)}
                        style={[styles.filterItem, selected && styles.itemOn]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            selected && styles.optionOn,
                          ]}
                          numberOfLines={1}
                          maxFontSizeMultiplier={layout.maxFontScaleFixed}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View style={styles.hairline} />
              <View style={styles.toolLine}>
                <Icon name="sort" size="sm" color={semantic.icon.muted} />
                <View style={styles.sortOptions}>
                  {(
                    [
                      ["recent", copy.roster.sortRecent],
                      ["name", copy.roster.sortName],
                    ] as const
                  ).map(([key, label]) => {
                    const selected = sort === key;
                    return (
                      <Pressable
                        key={key}
                        onPress={() => setSort(key)}
                        style={[styles.sortItem, selected && styles.itemOn]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            selected && styles.optionOn,
                          ]}
                          maxFontSizeMultiplier={layout.maxFontScaleFixed}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View style={styles.hairline} />
              <ChipLine
                icon="eye"
                value={visibility}
                onChange={setVisibility}
                options={[
                  { key: "all", label: copy.roster.visibilityLabels.all },
                  { key: "active", label: copy.roster.visibilityLabels.active },
                  { key: "hidden", label: copy.roster.visibilityLabels.hidden },
                  {
                    key: "archived",
                    label: copy.roster.visibilityLabels.archived,
                  },
                ]}
              />
              <View style={styles.hairline} />
              <ChipLine
                icon="clipboard-check"
                value={depositRefunded}
                onChange={setDepositRefunded}
                options={[
                  { key: "all", label: copy.roster.depositRefundLabels.all },
                  {
                    key: "refunded",
                    label: copy.roster.depositRefundLabels.refunded,
                  },
                  {
                    key: "not_refunded",
                    label: copy.roster.depositRefundLabels.not_refunded,
                  },
                ]}
              />
              <View style={styles.hairline} />
              {/*
                Email 狀態篩選（Web `page.tsx:435-450`）。
                「待處理」後面掛計數，與 Web 一致——沒有計數的話，操作員得先
                點進去才知道這條篩選值不值得點。
              */}
              <ChipLine
                icon="mail"
                value={emailStatusFilter}
                onChange={setEmailStatusFilter}
                options={[
                  { key: "all", label: copy.roster.emailStatus.filters.all },
                  {
                    key: "actionable",
                    label:
                      actionableCount > 0
                        ? `${copy.roster.emailStatus.filters.actionable} (${actionableCount})`
                        : copy.roster.emailStatus.filters.actionable,
                  },
                  {
                    key: "failed",
                    label: copy.roster.emailStatus.filters.failed,
                  },
                  {
                    key: "claimed",
                    label: copy.roster.emailStatus.filters.claimed,
                  },
                ]}
              />
              {/*
                範圍說明：後端沒有 email 狀態這個查詢維度，所以這條篩選只作用
                於**已載入**的列。App 是無限捲動，`items` 會累積多頁——若不講
                清楚，「待處理 0」會被讀成「整份名單沒問題」。
              */}
              {emailStatusFilter !== "all" ? (
                <Text
                  style={styles.filterScopeHint}
                  maxFontSizeMultiplier={layout.maxFontScaleFixed}
                >
                  {copy.roster.emailStatus.filterScopeHint(items.length)}
                </Text>
              ) : null}
            </View>
            {ticketTypes.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.ticketRow}
                accessibilityLabel={copy.roster.filterTicketType}
              >
                {[
                  { id: "all", label: copy.roster.filterAllTicketTypes },
                  ...ticketTypes.map((tt) => ({
                    id: tt.id,
                    label: tt.displayName || tt.name || tt.id,
                  })),
                ].map((item) => {
                  const selected = ticketTypeId === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setTicketTypeId(item.id)}
                      style={({ pressed }) => [
                        styles.ticketChip,
                        selected && styles.itemOn,
                        pressed && styles.rowPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text
                        style={[styles.optionText, selected && styles.optionOn]}
                        numberOfLines={1}
                        maxFontSizeMultiplier={layout.maxFontScaleFixed}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.skeletons}>
              <Skeleton height={72} radius={12} />
              <Skeleton height={72} radius={12} />
              <Skeleton height={72} radius={12} />
            </View>
          ) : (
            <EmptyState
              kind="no-results"
              headingLevel={2}
              title={copy.roster.emptyTitle}
              description={copy.roster.emptyHint}
            />
          )
        }
        renderItem={({ item }) => {
          const tone = statusTone(item.status);
          const name = getRegistrationDisplayName(item);
          const email = maskEmail(item.email);
          const company = getRegistrationCompany(item);
          const registeredAt = formatRegisteredAt(item.createdAt);
          const codeCopied = copied?.id === item.id && copied.kind === "code";
          const paymentCopied =
            copied?.id === item.id && copied.kind === "payment";
          /*
           * email 狀態：`emailStatus` **不在**每一種回應裡。名單端點會附，
           * `by-code`／`my-tickets` 不會；資料湊不出來時 BE 也合法地回 `null`。
           * 兩種情況都走 `emailStatusLabel(undefined)` ⇒ 「未知」——把那格畫成
           * 「未寄出」會讓操作員去重寄一封其實已經寄出的信。
           */
          const emailLabel = emailStatusLabel(item.emailStatus);
          const emailTone =
            EMAIL_TONE[
              item.emailStatus
                ? emailStatusTone(item.emailStatus.state)
                : "neutral"
            ];
          const emailDetail = emailStatusDetail(item.emailStatus);
          const openDetail = () => {
            router.push({
              pathname:
                "/(auth)/[eventId]/registrant/[registrationId]" as never,
              params: {
                eventId,
                registrationId: item.id,
                code: item.registrationCode,
              },
            });
          };
          return (
            <View style={styles.row}>
              <Pressable
                onPress={openDetail}
                style={({ pressed }) => [
                  styles.rowMain,
                  pressed && styles.rowPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${name}，${statusLabel(item.status)}，${copy.roster.registeredAt} ${registeredAt}`}
              >
                <View style={styles.rowTop}>
                  <View style={styles.nameBlock}>
                    <Text
                      style={styles.name}
                      numberOfLines={1}
                      maxFontSizeMultiplier={layout.maxFontScaleBody}
                    >
                      {name}
                    </Text>
                    <Text
                      style={styles.email}
                      numberOfLines={1}
                      maxFontSizeMultiplier={layout.maxFontScaleFixed}
                    >
                      {email}
                    </Text>
                  </View>
                  <View
                    style={[styles.statusPill, { backgroundColor: tone.bg }]}
                  >
                    <Text
                      style={[styles.statusText, { color: tone.fg }]}
                      numberOfLines={1}
                      maxFontSizeMultiplier={layout.maxFontScaleFixed}
                    >
                      {statusLabel(item.status)}
                    </Text>
                  </View>
                </View>
              </Pressable>
              <View style={styles.metaRow}>
                <View style={styles.metaLeft}>
                  <Pressable
                    onPress={() => {
                      copyValue(item.id, "code", item.registrationCode);
                    }}
                    style={({ pressed }) => [
                      styles.codeRow,
                      codeCopied && styles.codeRowCopied,
                      pressed && !codeCopied && styles.codeRowPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={
                      codeCopied
                        ? copy.roster.codeCopied
                        : `${copy.roster.copyCode} ${item.registrationCode}`
                    }
                    hitSlop={6}
                  >
                    <Text
                      style={[styles.code, codeCopied && styles.codeCopied]}
                      numberOfLines={1}
                      maxFontSizeMultiplier={layout.maxFontScaleFixed}
                    >
                      {item.registrationCode}
                    </Text>
                    <Icon
                      name={codeCopied ? "clipboard-check" : "copy"}
                      size="sm"
                      color={
                        codeCopied
                          ? semantic.status.success.fg
                          : semantic.icon.muted
                      }
                    />
                  </Pressable>
                  {/*
                    email 狀態徽章（對應 Web 名單表格的「Email 狀態」欄）。
                    Web 把 claim／outbox 的錯誤字串放在 `title`；手機沒有 hover，
                    所以同一段資訊改掛在無障礙標籤上——內容相同，呈現方式跟著平台走。
                  */}
                  <View
                    style={[
                      styles.emailPill,
                      { backgroundColor: emailTone.bg },
                    ]}
                    accessible
                    accessibilityRole="text"
                    accessibilityLabel={
                      emailDetail
                        ? `${copy.roster.emailStatus.label}：${emailLabel}。${emailDetail}`
                        : `${copy.roster.emailStatus.label}：${emailLabel}`
                    }
                  >
                    <Text
                      style={[styles.emailPillText, { color: emailTone.fg }]}
                      numberOfLines={1}
                      maxFontSizeMultiplier={layout.maxFontScaleFixed}
                    >
                      {emailLabel}
                    </Text>
                  </View>
                </View>
                {/* 管理入口：對應 Web 列表列的「⋯」。文字用「⋯」（非中文），
                    讀屏標籤走 copy 模組。 */}
                <Pressable
                  onPress={() => openManage(item)}
                  style={({ pressed }) => [
                    styles.manageButton,
                    pressed && styles.rowPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${copy.roster.manage.open} ${name}`}
                  hitSlop={6}
                >
                  <Text
                    style={styles.manageDots}
                    maxFontSizeMultiplier={layout.maxFontScaleFixed}
                  >
                    ⋯
                  </Text>
                </Pressable>
              </View>
              <Pressable
                onPress={openDetail}
                style={({ pressed }) => [
                  styles.rowBottom,
                  pressed && styles.rowPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${name}，${company}`}
              >
                <Text
                  style={styles.company}
                  numberOfLines={1}
                  maxFontSizeMultiplier={layout.maxFontScaleFixed}
                >
                  {company}
                </Text>
                <Text
                  style={styles.time}
                  numberOfLines={1}
                  maxFontSizeMultiplier={layout.maxFontScaleFixed}
                >
                  {copy.roster.registeredAt} {registeredAt}
                </Text>
              </Pressable>
              {/*
                待付款列的「複製付款連結」（對應 Web `CopyLinkButton`）。
                Web 只在 `PENDING_PAYMENT` 顯示——其他狀態的人沒有付款頁可去，
                給一顆永遠導不到的連結比不給更糟。
              */}
              {item.status === "PENDING_PAYMENT" ? (
                <Pressable
                  onPress={() =>
                    copyValue(
                      item.id,
                      "payment",
                      buildRegistrationPaymentUrl(
                        eventId,
                        item.registrationCode,
                      ),
                    )
                  }
                  style={({ pressed }) => [
                    styles.payButton,
                    paymentCopied && styles.payButtonCopied,
                    pressed && !paymentCopied && styles.rowPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    paymentCopied
                      ? copy.roster.paymentLinkCopied
                      : `${copy.roster.copyPaymentLink} ${name}`
                  }
                >
                  <Icon
                    name={paymentCopied ? "clipboard-check" : "copy"}
                    size="sm"
                    color={
                      paymentCopied
                        ? semantic.status.success.fg
                        : semantic.icon.muted
                    }
                  />
                  <Text
                    style={[
                      styles.payButtonText,
                      paymentCopied && styles.codeCopied,
                    ]}
                    numberOfLines={1}
                    maxFontSizeMultiplier={layout.maxFontScaleFixed}
                  >
                    {paymentCopied
                      ? copy.roster.paymentLinkCopied
                      : copy.roster.copyPaymentLink}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />

      {/*
        批次寄送 claim email（FE-08）：三段式面板，對應 Web
        `BatchSendClaimEmailModal`。
      */}
      {batchOpen ? (
        <BatchSendClaimEmailModal
          eventId={eventId}
          registrations={items}
          onClose={() => setBatchOpen(false)}
          onSent={() => {
            void refresh();
          }}
        />
      ) : null}

      {/*
        名單管理面板（對應 Web 的 `RegistrationActionsMenu` + `RegistrationActionModal`）。

        為何用 RN 內建的 `Modal` 而不新增 overlay 套件：`expo-router` 的畫面堆疊
        不適合這種「不改路由、原位返回」的暫時性面板，而 `Modal` 是 RN 標準元件，
        不需新增依賴。目前 App 還沒有共用 sheet 元件，所以先寫在這裡——未來若
        第二個畫面也需要同一模式，再抽出。
      */}
      <Modal
        visible={manage !== null}
        transparent
        animationType="fade"
        onRequestClose={closeManage}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalPanel}>
            <ScrollView
              contentContainerStyle={styles.modalBody}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={type.h3}>{copy.roster.manage.title}</Text>
              {manage ? (
                <Text style={styles.modalSubject} numberOfLines={1}>
                  {`${getRegistrationDisplayName(manage)} · ${manage.registrationCode}`}
                </Text>
              ) : null}

              {actionError ? (
                <InlineBanner tone="danger" message={actionError} compact />
              ) : null}

              {pendingAction === null ? (
                <View style={styles.actionList}>
                  {manage === null
                    ? null
                    : manageActionsFor(manage).map((action) => (
                        <Pressable
                          key={action}
                          onPress={() => {
                            setPendingAction(action);
                            resetDraft();
                          }}
                          style={({ pressed }) => [
                            styles.actionItem,
                            pressed && styles.rowPressed,
                          ]}
                          accessibilityRole="button"
                        >
                          <Icon
                            name={ACTION_ICON[action]}
                            size="md"
                            color={semantic.icon.muted}
                          />
                          <Text style={styles.actionLabel}>
                            {actionCopyFor(manage, action).label}
                          </Text>
                        </Pressable>
                      ))}
                </View>
              ) : (
                <View style={styles.confirmBlock}>
                  <Text style={styles.confirmTitle}>
                    {manage === null
                      ? null
                      : actionCopyFor(manage, pendingAction).label}
                  </Text>
                  {needsReason ? (
                    <>
                      <Text style={styles.fieldLabel}>
                        {copy.roster.manage.reasonLabel}
                      </Text>
                      <TextInput
                        value={reason}
                        onChangeText={setReason}
                        placeholder={copy.roster.manage.reasonPlaceholder}
                        placeholderTextColor={semantic.text.muted}
                        multiline
                        maxLength={255}
                        style={styles.reasonInput}
                        accessibilityLabel={copy.roster.manage.reasonLabel}
                      />
                      {reasonMissing ? (
                        <Text style={styles.fieldHint}>
                          {copy.roster.manage.reasonRequired}
                        </Text>
                      ) : null}
                    </>
                  ) : null}
                  {pendingAction === "refund" ? (
                    <>
                      <Text style={styles.fieldLabel}>
                        {copy.roster.manage.refundAmountLabel}
                      </Text>
                      <TextInput
                        value={amount}
                        onChangeText={setAmount}
                        placeholder={copy.roster.manage.refundAmountPlaceholder}
                        placeholderTextColor={semantic.text.muted}
                        keyboardType="numbers-and-punctuation"
                        style={styles.reasonInput}
                        accessibilityLabel={
                          copy.roster.manage.refundAmountLabel
                        }
                      />
                      {amountMissing ? (
                        <Text style={styles.fieldHint}>
                          {copy.roster.manage.refundAmountInvalid}
                        </Text>
                      ) : null}
                      <Text style={styles.fieldLabel}>
                        {copy.roster.manage.refundReferenceLabel}
                      </Text>
                      <TextInput
                        value={reference}
                        onChangeText={setReference}
                        maxLength={100}
                        placeholder={copy.roster.manage.refundReferenceLabel}
                        placeholderTextColor={semantic.text.muted}
                        style={styles.reasonInput}
                        accessibilityLabel={
                          copy.roster.manage.refundReferenceLabel
                        }
                      />
                      <Text style={styles.fieldLabel}>
                        {copy.roster.manage.refundNoteLabel}
                      </Text>
                      <TextInput
                        value={note}
                        onChangeText={setNote}
                        multiline
                        maxLength={500}
                        placeholder={copy.roster.manage.refundNoteLabel}
                        placeholderTextColor={semantic.text.muted}
                        style={styles.reasonInput}
                        accessibilityLabel={copy.roster.manage.refundNoteLabel}
                      />
                    </>
                  ) : null}
                </View>
              )}

              <View style={styles.modalFooter}>
                <Button
                  label={copy.roster.manage.cancel}
                  variant="secondary"
                  onPress={pendingAction === null ? closeManage : resetDraft}
                  disabled={busy}
                />
                {pendingAction !== null ? (
                  <Button
                    label={
                      busy
                        ? copy.roster.manage.processing
                        : copy.roster.manage.confirm
                    }
                    variant={confirmIsDanger ? "dangerSolid" : "primary"}
                    loading={busy}
                    disabled={confirmBlocked}
                    onPress={() => {
                      if (!manage || !pendingAction) return;
                      void runManageAction(manage, pendingAction, {
                        reason,
                        amount,
                        reference,
                        note,
                      });
                    }}
                  />
                ) : null}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: semantic.bg.canvas },
  emptyBody: { flex: 1, padding: spacing.screen, justifyContent: "center" },
  headerBlock: { gap: space[3], marginBottom: space[2] },
  headerActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: space[2],
    flexWrap: "wrap",
  },
  headerAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[1],
    minHeight: layout.touchMin,
    paddingHorizontal: space[3],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: semantic.border.interactive,
    backgroundColor: semantic.bg.surface,
  },
  headerActionDisabled: { opacity: 0.5 },
  headerActionText: {
    ...type.caption,
    color: semantic.text.secondary,
    fontWeight: "600",
  },
  search: {
    backgroundColor: semantic.bg.surface,
    borderWidth: 1,
    borderColor: semantic.border.interactive,
    borderRadius: 12,
    minHeight: layout.buttonHeight,
    paddingHorizontal: space[4],
    color: semantic.text.primary,
    fontSize: type.body.fontSize,
  },
  toolbar: {
    backgroundColor: semantic.bg.surface,
    borderWidth: 1,
    borderColor: semantic.border.decorative,
    borderRadius: 12,
    paddingHorizontal: space[3],
    paddingVertical: space[1],
  },
  toolLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
  },
  toolOptions: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  sortOptions: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[1],
  },
  /** 票種 chip 列（水平捲動，不換行以免把清單推太低） */
  ticketRow: {
    gap: space[2],
    paddingVertical: space[1],
  },
  ticketChip: {
    minHeight: layout.touchMin,
    justifyContent: "center",
    paddingHorizontal: space[3],
    borderRadius: 999,
    borderWidth: 1,
    borderColor: semantic.border.decorative,
    backgroundColor: semantic.bg.surface,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: semantic.border.decorative,
    marginLeft: space[6],
  },
  /**
   * 篩選範圍說明（只在前端篩選啟用時出現）。
   *
   * 用 `type.caption` + muted，讓它讀起來是註解而不是另一條控制項——它不能
   * 長得像 chip，否則會被誤認為可以點。
   */
  filterScopeHint: {
    ...type.caption,
    color: semantic.text.muted,
    paddingHorizontal: space[3],
    paddingBottom: space[1],
  },
  filterItem: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    paddingVertical: space[2],
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  sortItem: {
    paddingHorizontal: space[2],
    paddingVertical: space[2],
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  itemOn: {
    borderBottomColor: semantic.border.interactiveSelected,
  },
  optionText: {
    ...type.caption,
    color: semantic.text.muted,
    textAlign: "center",
  },
  optionOn: {
    color: semantic.text.link,
    fontWeight: "600",
  },
  skeletons: { gap: space[3] },
  row: {
    backgroundColor: semantic.bg.surface,
    borderWidth: 1,
    borderColor: semantic.border.decorative,
    borderRadius: 12,
    padding: space[4],
    gap: space[2],
  },
  rowMain: {
    gap: space[2],
  },
  rowPressed: { opacity: 0.72 },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space[2],
  },
  nameBlock: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "baseline",
    gap: space[2],
  },
  name: {
    ...type.h3,
    flexShrink: 1,
    color: semantic.text.primary,
  },
  email: {
    ...type.micro,
    flexShrink: 1,
    color: semantic.text.muted,
  },
  statusPill: {
    flexShrink: 0,
    borderRadius: 999,
    paddingHorizontal: space[2],
    paddingVertical: space[1],
  },
  statusText: {
    ...type.badge,
  },
  codeRow: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: space[1],
    paddingVertical: space[1],
    paddingHorizontal: space[2],
    borderRadius: 8,
    backgroundColor: semantic.bg.surfaceSunken,
  },
  codeRowPressed: {
    backgroundColor: semantic.bg.brandSoft,
  },
  codeRowCopied: {
    backgroundColor: semantic.status.success.bg,
  },
  code: {
    ...type.monoSm,
    color: semantic.text.secondary,
  },
  codeCopied: {
    color: semantic.status.success.fg,
  },
  rowBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space[3],
  },
  company: {
    ...type.micro,
    flex: 1,
    minWidth: 0,
    color: semantic.text.muted,
  },
  time: {
    ...type.micro,
    flexShrink: 0,
    color: semantic.text.muted,
  },
  /** 報名編號與「管理」入口同一列，兩端對齊 */
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space[2],
  },
  /** 左半：報名編號 + email 狀態徽章（兩者都可能很長，所以整組可壓縮） */
  metaLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
  },
  emailPill: {
    flexShrink: 1,
    minWidth: 0,
    borderRadius: 999,
    paddingHorizontal: space[2],
    paddingVertical: space[1],
  },
  emailPillText: {
    ...type.badge,
  },
  /** 待付款列的「複製付款連結」（黃底＝待處理錢，與 Web 的 yellow 標籤同語意） */
  payButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space[1],
    minHeight: layout.touchMin,
    paddingHorizontal: space[3],
    borderRadius: 8,
    backgroundColor: semantic.status.warning.bg,
  },
  payButtonCopied: {
    backgroundColor: semantic.status.success.bg,
  },
  payButtonText: {
    ...type.caption,
    color: semantic.status.warning.fg,
    fontWeight: "600",
  },
  manageButton: {
    minWidth: layout.touchMin,
    minHeight: layout.touchMin,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  manageDots: {
    ...type.h3,
    color: semantic.text.muted,
    lineHeight: layout.icon.lg + space[3],
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: spacing.screen,
  },
  modalPanel: {
    backgroundColor: semantic.bg.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: semantic.border.decorative,
    maxHeight: "85%",
  },
  modalBody: {
    padding: space[4],
    gap: space[3],
  },
  modalSubject: {
    ...type.caption,
    color: semantic.text.muted,
  },
  actionList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: semantic.border.decorative,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    minHeight: layout.touchMin,
    paddingVertical: space[2],
  },
  actionLabel: {
    ...type.body,
    color: semantic.text.primary,
  },
  confirmBlock: {
    gap: space[2],
  },
  confirmTitle: {
    ...type.body,
    fontWeight: "600",
    color: semantic.text.primary,
  },
  fieldLabel: {
    ...type.caption,
    color: semantic.text.secondary,
  },
  fieldHint: {
    ...type.caption,
    color: semantic.status.warning.fg,
  },
  reasonInput: {
    minHeight: layout.buttonHeight + space[4],
    borderWidth: 1,
    borderColor: semantic.border.interactive,
    borderRadius: 12,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    color: semantic.text.primary,
    fontSize: type.body.fontSize,
    textAlignVertical: "top",
  },
  modalFooter: {
    gap: space[2],
  },
});
