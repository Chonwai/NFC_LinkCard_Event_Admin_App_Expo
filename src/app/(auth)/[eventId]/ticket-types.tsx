import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChoiceChips } from "@/components/ui/ChoiceChips";
import { EmptyState } from "@/components/ui/EmptyState";
import { FieldInput } from "@/components/ui/FieldInput";
import { Icon } from "@/components/ui/Icon";
import {
  InlineBanner,
  type InlineBannerTone,
} from "@/components/ui/InlineBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { WEB_BASE_URL } from "@/constants/config";
import { copy } from "@/constants/copy.zh-TW";
import {
  layout,
  radius,
  semantic,
  space,
  spacing,
  type,
} from "@/constants/theme";
import { eventService } from "@/services/event.service";
import { ticketTypeService } from "@/services/ticket-type.service";
import {
  ENABLED_PAYMENT_METHODS,
  REGISTRANT_TYPES,
  TICKET_CAPABILITIES,
  type AdminTicketType,
  type EnabledPaymentMethod,
  type EventPaymentMethod,
  type RegistrantType,
} from "@/types/ticketType.types";
import { classifyTicketMutationError } from "@/utils/ticket-type-errors";
import {
  buildTicketTypePayload,
  emptyTicketTypeForm,
  payloadContextFrom,
  resolveTicketCapabilities,
  summarizeTicketTypeChanges,
  ticketTypeFormFrom,
  toggleTicketCapability,
  validateTicketTypeForm,
  type TicketTypeFormErrorCode,
  type TicketTypeFormInput,
} from "@/utils/ticket-type-form";

/**
 * 票種管理（parity `ticket-types`）。
 *
 * 前端 counterpart：`LinkCard_Frontend/app/(event)/manage/[eventId]/ticket-types/page.tsx`。
 * 對齊原則：Web 做得到的事，App 也要做得到，不增不減。
 *
 * ## 讀取是一條請求，不是兩條
 *
 * Web 的 `load()` 是 `Promise.all([listAdminTicketTypes, getEventById])`：
 * 票種清單要活動的 `slug` 才組得出報名連結。App 照同一條路（同樣兩條請求、
 * 同一個順序），不改成「先讀清單、按了複製再補讀活動」——那樣複製鈕第一次
 * 按會沒有反應。
 *
 * ## 為什麼失敗要講出來
 *
 * Web 的 `load()` 是 `catch { /* ignore *\/ }`：請求失敗時畫面收成
 * 「尚未設置任何票種」的空狀態——**看起來跟真的一個票種都沒有**。
 * 現場看到那個畫面，會以為票種被人刪光了。App 分成兩條：載入失敗給橫幅，
 * 查無資料才給 EmptyState。這是 App 唯一比 Web 多做的呈現，理由同
 * `polls.tsx`：不講話的失敗在現場無法診斷。
 *
 * ## 為什麼重新整理走 `reloadKey`
 *
 * 與 `polls.tsx` / `content.tsx` 同一個理由：標頭的重新整理鈕不能在 effect
 * 外直接呼叫會 `setState` 的載入函式（`react-hooks/set-state-in-effect`），
 * 所以把「重載」表達成「把 key 加一」，由 effect 自己監聽。載入邏輯只留一份。
 *
 * ## 報名連結怎麼組
 *
 * Web 用 `window.location.origin`；App 沒有 origin，改用 `WEB_BASE_URL`
 * （`constants/config.ts`，可由 `EXPO_PUBLIC_WEB_URL` 覆寫，預設
 * `https://linkcard.xyz`）。**不從 `API_BASE_URL` 推導**：staging 的 API
 * 與 staging 的 Web 不是同一台主機，從 API 推會產生一個打得開但 404 的連結。
 *
 * 路徑與 query 逐字照 Web `handleCopyRegisterLink`：
 * `/events/{slug}/register?ticketTypeId={id}`，隱藏票再追一個 `&code={accessCode}`。
 */
export default function EventTicketTypesScreen() {
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  const [tickets, setTickets] = useState<AdminTicketType[]>([]);
  const [eventSlug, setEventSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [copiedTicketId, setCopiedTicketId] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  /** `null` ＝ 新增；有值 ＝ 編輯該票種。 */
  const [editing, setEditing] = useState<AdminTicketType | null>(null);
  /** 待停用的票種；非 null 時顯示確認框。 */
  const [pendingDeactivate, setPendingDeactivate] =
    useState<AdminTicketType | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  /** 票種權益強制開關（活動層級）。 */
  const [capabilitiesEnabled, setCapabilitiesEnabled] = useState(false);
  const [togglingCapabilities, setTogglingCapabilities] = useState(false);
  /** 非 false 時顯示「啟用票種權益」的二次確認。 */
  const [pendingCapabilityEnable, setPendingCapabilityEnable] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: InlineBannerTone;
    message: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [list, event] = await Promise.all([
          ticketTypeService.listAdminTicketTypes(eventId),
          eventService.getEventById(eventId),
        ]);
        if (cancelled) return;
        setTickets(list.ticketTypes ?? []);
        // 與 Web `setEventSlug(event?.slug ?? eventId)` 相同：取不到 slug 時
        // 退回 eventId。後端的 `resolveEventId` 兩種都吃，所以連結仍然有效。
        setEventSlug(event?.event?.slug ?? null);
        // 與 Web `setCapabilitiesEnabled(event?.ticketCapabilitiesEnabled === true)`
        // 相同：嚴格比 `true`，不是 truthy。舊後端不回這個欄位時要是「未啟用」。
        setCapabilitiesEnabled(
          event?.event?.ticketCapabilitiesEnabled === true,
        );
        setLoadError(false);
      } catch {
        if (cancelled) return;
        // 只說「載入失敗」，不把後端原文倒到畫面上（見檔頭）。
        setLoadError(true);
        setTickets([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [eventId, reloadKey]);

  async function handleCopyRegisterLink(ticket: AdminTicketType) {
    const query = new URLSearchParams({ ticketTypeId: ticket.id });
    if (ticket.accessCode) {
      query.set("code", ticket.accessCode);
    }

    const url = `${WEB_BASE_URL}/events/${eventSlug ?? eventId}/register?${query.toString()}`;

    try {
      await Clipboard.setStringAsync(url);
      setCopyFailed(false);
      setCopiedTicketId(ticket.id);
    } catch {
      setCopyFailed(true);
      return;
    }

    /**
     * 「已複製」兩秒後退回原字。
     *
     * 與 `badges.tsx` / `nfc-read.tsx` 不同：那兩頁只是把值放進剪貼簿、
     * 沒有回饋字。這裡照 Web 的 `setTimeout` 行為——按鈕文字會變，
     * 而且會變回來。
     */
    setTimeout(() => {
      setCopiedTicketId((current) => (current === ticket.id ? null : current));
    }, 2000);
  }

  function openForm(ticket: AdminTicketType | null) {
    setEditing(ticket);
    setFormOpen(true);
  }

  function handleSaved(mode: "create" | "update") {
    setFormOpen(false);
    setEditing(null);
    setFeedback({
      tone: "success",
      message:
        mode === "create"
          ? copy.ticketTypes.createSuccess
          : copy.ticketTypes.updateSuccess,
    });
    setReloadKey((key) => key + 1);
  }

  /**
   * 切換活動層級的票種權益強制。
   *
   * 與 Web `handleToggleCapabilities` 逐條相同：只在**開啟**時要確認
   * （關閉是放寬限制，不需要再問一次），成功後重新載入列表——因為列表上的
   * 「已售 / 上限」與權益顯示都跟這個開關有關。
   */
  async function handleToggleCapabilities(next: boolean) {
    setTogglingCapabilities(true);
    try {
      await eventService.updateEvent(eventId, {
        ticketCapabilitiesEnabled: next,
      });
      setPendingCapabilityEnable(false);
      setFeedback({
        tone: "success",
        message: next
          ? copy.ticketTypes.capabilitiesEnabled
          : copy.ticketTypes.capabilitiesDisabled,
      });
      setReloadKey((key) => key + 1);
    } catch {
      // 這條走的是活動而非票種的錯誤碼，所以不經 `classifyTicketMutationError`
      // ——那支認的是票種的 code。一律回一句可執行的話，不回顯後端原文。
      setPendingCapabilityEnable(false);
      setFeedback({
        tone: "danger",
        message: copy.ticketTypes.capabilitiesToggleFailed,
      });
    } finally {
      setTogglingCapabilities(false);
    }
  }

  /**
   * 停用（後端是 DELETE，語意是軟刪除——見 `services/ticket-type.service.ts`）。
   *
   * 照 Web 的做法：成功後**重新載入列表**，不用回應值拼湊本地狀態。
   * 「列表現在長什麼樣」只有後端知道（例如 `soldCount` 會被重算）。
   */
  async function handleDeactivate() {
    if (!pendingDeactivate) return;

    setDeactivating(true);
    try {
      await ticketTypeService.deactivateTicketType(
        eventId,
        pendingDeactivate.id,
      );
      setPendingDeactivate(null);
      setFeedback({
        tone: "success",
        message: copy.ticketTypes.deactivateSuccess,
      });
      setReloadKey((key) => key + 1);
    } catch (error) {
      const outcome = classifyTicketMutationError(error);
      setPendingDeactivate(null);
      setFeedback({
        tone: "danger",
        message: copy.ticketTypes.mutationErrors[outcome.kind],
      });
    } finally {
      setDeactivating(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={copy.ticketTypes.title}
        subtitle={copy.ticketTypes.subtitle}
        leading="back"
        onRefresh={() => setReloadKey((key) => key + 1)}
        isRefreshing={loading}
        testID="ticket-types-header"
      />
      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + spacing.screen },
        ]}
      >
        <Button
          label={copy.ticketTypes.add}
          onPress={() => openForm(null)}
          testID="ticket-types-add"
        />

        <Card testID="ticket-types-capabilities-switch">
          <Text style={styles.displayName}>
            {capabilitiesEnabled
              ? copy.ticketTypes.capabilitiesEnabled
              : copy.ticketTypes.capabilitiesDisabled}
          </Text>
          <Text style={styles.meta}>
            {capabilitiesEnabled
              ? copy.ticketTypes.capabilitiesEnabledHint
              : copy.ticketTypes.capabilitiesDisabledHint}
          </Text>
          <View style={styles.actions}>
            <View style={styles.actionButton}>
              <Button
                label={
                  capabilitiesEnabled
                    ? copy.ticketTypes.capabilitiesDisable
                    : copy.ticketTypes.capabilitiesEnable
                }
                variant={capabilitiesEnabled ? "secondary" : "primary"}
                loading={togglingCapabilities}
                // 只有「開啟」需要二次確認（Web 同一條）。
                onPress={() => {
                  if (capabilitiesEnabled) {
                    void handleToggleCapabilities(false);
                  } else {
                    setPendingCapabilityEnable(true);
                  }
                }}
                testID="ticket-types-capabilities-toggle"
              />
            </View>
          </View>
        </Card>

        {feedback ? (
          <InlineBanner
            compact
            tone={feedback.tone}
            message={feedback.message}
            dismissible
            onDismiss={() => setFeedback(null)}
          />
        ) : null}

        {loadError ? (
          <InlineBanner
            compact
            tone="danger"
            message={copy.ticketTypes.loadError}
            actionLabel={copy.common.refresh}
            onAction={() => setReloadKey((key) => key + 1)}
          />
        ) : null}

        {copyFailed ? (
          <InlineBanner
            compact
            tone="danger"
            message={copy.ticketTypes.copyFailed}
            dismissible
            onDismiss={() => setCopyFailed(false)}
          />
        ) : null}

        {loading ? (
          <View style={styles.skeletonGroup}>
            {[0, 1].map((index) => (
              <Skeleton key={index} height={96} />
            ))}
          </View>
        ) : tickets.length === 0 ? (
          // 載入失敗時不要同時給「尚未設置任何票種」——那會把失敗說成事實。
          loadError ? null : (
            <EmptyState
              kind="first-use"
              headingLevel={2}
              icon="empty-card"
              title={copy.ticketTypes.empty}
            />
          )
        ) : (
          <View style={styles.list}>
            {tickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                copied={copiedTicketId === ticket.id}
                onCopy={() => void handleCopyRegisterLink(ticket)}
                onEdit={() => openForm(ticket)}
                onDeactivate={() => setPendingDeactivate(ticket)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {formOpen ? (
        <TicketTypeFormModal
          eventId={eventId}
          existing={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
        />
      ) : null}

      {pendingDeactivate ? (
        <DeactivateDialog
          ticket={pendingDeactivate}
          busy={deactivating}
          onConfirm={() => void handleDeactivate()}
          onCancel={() => setPendingDeactivate(null)}
        />
      ) : null}

      {pendingCapabilityEnable ? (
        <ConfirmDialog
          title={copy.ticketTypes.capabilitiesEnableConfirmTitle}
          message={copy.ticketTypes.capabilitiesEnableConfirm}
          confirmLabel={copy.ticketTypes.capabilitiesEnable}
          busy={togglingCapabilities}
          tone="primary"
          onConfirm={() => void handleToggleCapabilities(true)}
          onCancel={() => setPendingCapabilityEnable(false)}
          testID="ticket-types-capabilities-confirm"
        />
      ) : null}
    </View>
  );
}

/**
 * 一張票種。
 *
 * 資訊順序照 Web：`displayName` → 識別名稱 → 狀態徽章（已停用／隱藏）→
 * 幣別金額／報名者類型／已售與上限 → 訪問碼（只有隱藏票才顯示）。
 *
 * 徽章用 `semantic.status.*`，不自己挑顏色：`contrast` 閘門驗的是 token 組合，
 * 自創的 hex 不會被它守到。
 */
function TicketCard({
  ticket,
  copied,
  onCopy,
  onEdit,
  onDeactivate,
}: {
  ticket: AdminTicketType;
  copied: boolean;
  onCopy: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
}) {
  return (
    <Card testID={`ticket-type-card-${ticket.id}`}>
      <View style={styles.badges}>
        <Text style={styles.displayName} numberOfLines={2}>
          {ticket.displayName}
        </Text>
        <Text style={styles.name}>{ticket.name}</Text>
        {ticket.isActive ? null : (
          <View
            style={[
              styles.pill,
              {
                backgroundColor: semantic.status.neutral.bg,
                borderColor: semantic.status.neutral.border,
              },
            ]}
          >
            <Text
              style={[styles.pillLabel, { color: semantic.status.neutral.fg }]}
            >
              {copy.ticketTypes.inactive}
            </Text>
          </View>
        )}
        {ticket.isHidden ? (
          <View
            style={[
              styles.pill,
              {
                backgroundColor: semantic.status.warning.bg,
                borderColor: semantic.status.warning.border,
              },
            ]}
          >
            <Text
              style={[styles.pillLabel, { color: semantic.status.warning.fg }]}
            >
              {copy.ticketTypes.hidden}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.meta}>
        {ticket.currency} {ticket.price}
        {"  ·  "}
        {copy.ticketTypes.registrantTypeLabels[ticket.registrantType] ??
          ticket.registrantType}
        {"  ·  "}
        {copy.ticketTypes.soldWithCapacity(
          ticket.soldCount ?? 0,
          ticket.capacity ?? null,
        )}
      </Text>

      {ticket.isHidden && ticket.accessCode ? (
        <Text style={styles.accessCode}>
          {copy.ticketTypes.code(ticket.accessCode)}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <View style={styles.actionButton}>
          <Button
            label={copied ? copy.ticketTypes.copied : copy.ticketTypes.copyLink}
            variant="secondary"
            size="md"
            onPress={onCopy}
            testID={`ticket-type-copy-${ticket.id}`}
          />
        </View>
        <View style={styles.actionButton}>
          <Button
            label={copy.ticketTypes.editAction}
            variant="secondary"
            size="md"
            onPress={onEdit}
            testID={`ticket-type-edit-${ticket.id}`}
          />
        </View>
        {/** Web 也是 `{ticket.isActive && …}`：已停用的票不該再出現停用鈕。 */}
        {ticket.isActive ? (
          <View style={styles.actionButton}>
            <Button
              label={copy.ticketTypes.deactivate}
              variant="danger"
              size="md"
              onPress={onDeactivate}
              testID={`ticket-type-deactivate-${ticket.id}`}
            />
          </View>
        ) : null}
      </View>
    </Card>
  );
}

/**
 * 新增票種表單。**兩段式**：`form` → `confirm` → 送出。
 *
 * 第二段只列**實際變動**的價格與名額（見 `summarizeTicketTypeChanges`）。
 * 沒有變動的項目不出現，避免變成一路按「確定」的儀式性彈窗。
 *
 * 不用 RN 的 `Alert.alert`：這個 repo 全案沒有用過它（`src/` 搜不到），
 * 既有的三個確認面板都是自繪 `Modal`（`content.tsx` 的 `ConfirmDialog`、
 * 名單管理、批次寄信）。這裡照同一條路。
 */
function TicketTypeFormModal({
  eventId,
  existing,
  onClose,
  onSaved,
}: {
  eventId: string;
  /** `null` ＝ 新增；有值 ＝ 編輯該票種。 */
  existing: AdminTicketType | null;
  onClose: () => void;
  onSaved: (mode: "create" | "update") => void;
}) {
  const [form, setForm] = useState<TicketTypeFormInput>(() =>
    existing ? ticketTypeFormFrom(existing) : emptyTicketTypeForm(),
  );
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [errorCodes, setErrorCodes] = useState<TicketTypeFormErrorCode[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const errorFor = (code: TicketTypeFormErrorCode): string | null =>
    errorCodes.includes(code) ? formErrorMessage(code) : null;

  function update<K extends keyof TicketTypeFormInput>(
    key: K,
    value: TicketTypeFormInput[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleNext() {
    const codes = validateTicketTypeForm(form);
    setErrorCodes(codes);
    setFailure(null);
    if (codes.length > 0) return;
    setStep("confirm");
  }

  async function handleSubmit() {
    setSubmitting(true);
    setFailure(null);
    try {
      // `payloadContextFrom` 兩個分支都不一樣，而且**都不是可有可無的**：
      // - 新增：`capabilities` = null（繼承）、`formFieldsJson` = 空表。
      // - 編輯：帶回既有的 `capabilitiesOverride` 與 `formFieldsJson`。
      //   傳錯任何一個，存一次檔就會把主辦方的設定默默改掉（見 util 檔頭）。
      const payload = buildTicketTypePayload(
        form,
        payloadContextFrom(existing),
      );

      if (existing) {
        await ticketTypeService.updateTicketType(eventId, existing.id, payload);
        onSaved("update");
      } else {
        await ticketTypeService.createTicketType(eventId, payload);
        onSaved("create");
      }
    } catch (error) {
      const outcome = classifyTicketMutationError(error);
      setFailure(copy.ticketTypes.mutationErrors[outcome.kind]);
      // 失敗退回第一段：錯誤要顯示在表單上，而且使用者可能要改值。
      setStep("form");
    } finally {
      setSubmitting(false);
    }
  }

  const changes = summarizeTicketTypeChanges(form, existing);
  /** 目前實際生效的權益（繼承或覆寫）。編輯器用它決定勾選狀態。 */
  const effectiveCapabilities = resolveTicketCapabilities({
    registrantType: form.registrantType,
    capabilities: form.capabilities,
  });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.dialog} testID="ticket-type-form">
          {step === "form" ? (
            <>
              <Text style={type.h3}>
                {existing ? copy.ticketTypes.edit : copy.ticketTypes.add}
              </Text>
              <ScrollView
                style={styles.formScroll}
                contentContainerStyle={styles.formBody}
                keyboardShouldPersistTaps="handled"
              >
                {failure ? (
                  <InlineBanner compact tone="danger" message={failure} />
                ) : null}

                <FieldInput
                  label={copy.ticketTypes.identifierName}
                  value={form.name}
                  onChangeText={(text) => update("name", text)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  required
                  error={errorFor("name_required")}
                  testID="ticket-type-form-name"
                />
                <FieldInput
                  label={copy.ticketTypes.displayName}
                  value={form.displayName}
                  onChangeText={(text) => update("displayName", text)}
                  placeholder={copy.ticketTypes.displayNamePlaceholder}
                  required
                  error={errorFor("display_name_required")}
                  testID="ticket-type-form-display-name"
                />
                <FieldInput
                  label={copy.ticketTypes.price}
                  value={form.price}
                  onChangeText={(text) => update("price", text)}
                  // `decimal-pad`：價格是 `Decimal(10,2)`，`number-pad` 在 iOS
                  // 上沒有小數點鍵，打不出 `1500.50`。
                  keyboardType="decimal-pad"
                  required
                  error={
                    errorFor("price_required") ?? errorFor("price_invalid")
                  }
                  testID="ticket-type-form-price"
                />
                <FieldInput
                  label={copy.ticketTypes.currency}
                  value={form.currency}
                  onChangeText={(text) => update("currency", text)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="ticket-type-form-currency"
                />
                <ChoiceChips
                  label={copy.ticketTypes.registrantType}
                  options={REGISTRANT_TYPES}
                  value={form.registrantType}
                  labelFor={(value: RegistrantType) =>
                    registrantTypeLabel(value)
                  }
                  onSelect={(value) => update("registrantType", value)}
                  testID="ticket-type-form-registrant"
                />
                <FieldInput
                  label={copy.ticketTypes.description}
                  value={form.description}
                  onChangeText={(text) => update("description", text)}
                  multiline
                  testID="ticket-type-form-description"
                />
                <FieldInput
                  label={copy.ticketTypes.capacity}
                  value={form.capacity}
                  onChangeText={(text) => update("capacity", text)}
                  placeholder={copy.ticketTypes.capacityPlaceholder}
                  keyboardType="number-pad"
                  error={errorFor("capacity_invalid")}
                  testID="ticket-type-form-capacity"
                />
                <FieldInput
                  label={copy.ticketTypes.initialTokens}
                  value={form.initialTokens}
                  onChangeText={(text) => update("initialTokens", text)}
                  keyboardType="number-pad"
                  error={errorFor("tokens_invalid")}
                  testID="ticket-type-form-tokens"
                />
                {/**
                 * 付款方式在 Web 上**看起來**是多選，實際是單選：
                 * `selectPaymentMethod` 一律寫成單元素陣列
                 * （`page.tsx:774-777`）。所以這裡用單選晶片，語意相同、
                 * 而且不會讓人以為可以同時選免費與轉帳。
                 */}
                <ChoiceChips
                  label={copy.ticketTypes.paymentMethod}
                  options={ENABLED_PAYMENT_METHODS}
                  value={enabledPaymentMethodOf(form.allowedPaymentMethods)}
                  labelFor={(value: EnabledPaymentMethod) =>
                    copy.ticketTypes.paymentMethodLabels[value]
                  }
                  onSelect={(value) => update("allowedPaymentMethods", [value])}
                  testID="ticket-type-form-payment"
                />
                <ToggleRow
                  label={copy.ticketTypes.hiddenTicket}
                  hint={copy.ticketTypes.hiddenHint}
                  value={form.isHidden}
                  onToggle={() => update("isHidden", !form.isHidden)}
                  testID="ticket-type-form-hidden"
                />
                {form.isHidden ? (
                  <FieldInput
                    label={copy.ticketTypes.accessCode}
                    value={form.accessCode}
                    onChangeText={(text) => update("accessCode", text)}
                    placeholder={copy.ticketTypes.accessCodePlaceholder}
                    autoCapitalize="none"
                    autoCorrect={false}
                    required
                    error={errorFor("access_code_required")}
                    testID="ticket-type-form-access-code"
                  />
                ) : null}
                {/**
                 * 票種權益編輯（LC-TTE）。
                 *
                 * 三件事照 Web：
                 * 1. 勾選狀態看的是**實際生效**的那一組（繼承時就是預設值），
                 *    所以「我只取消一項」不會讓其他五項一起消失。
                 * 2. 第一次勾選／取消就把「繼承」實體化成「明確覆寫」。
                 * 3. 有「還原為預設」把覆寫改回 `null`。
                 *
                 * 這一段的語意在後端是 null-inherit、**不做聯集**；空陣列是
                 * 「明確不給任何權益」。細節見 `utils/ticket-type-form.ts` 的
                 * `resolveTicketCapabilities`。
                 */}
                <View style={styles.capabilityBlock}>
                  <Text style={styles.sectionLabel}>
                    {copy.ticketTypes.capabilities}
                  </Text>
                  <Text style={styles.confirmNote}>
                    {form.capabilities === null
                      ? copy.ticketTypes.capabilitiesInheritedHint
                      : copy.ticketTypes.capabilitiesOverriddenHint}
                  </Text>
                  {TICKET_CAPABILITIES.map((capability) => (
                    <ToggleRow
                      key={capability}
                      label={
                        copy.ticketTypes.capabilityLabels[capability] ??
                        capability
                      }
                      hint=""
                      value={effectiveCapabilities.includes(capability)}
                      onToggle={() =>
                        update(
                          "capabilities",
                          toggleTicketCapability({
                            registrantType: form.registrantType,
                            current: form.capabilities,
                            capability,
                          }),
                        )
                      }
                      testID={`ticket-type-form-capability-${capability}`}
                    />
                  ))}
                  {form.capabilities === null ? null : (
                    <Button
                      label={copy.ticketTypes.capabilitiesInheritReset}
                      variant="ghost"
                      onPress={() => update("capabilities", null)}
                      testID="ticket-type-form-capability-reset"
                    />
                  )}
                </View>
              </ScrollView>
              <Button
                label={copy.ticketTypes.save}
                onPress={handleNext}
                testID="ticket-type-form-next"
              />
              <Button
                label={copy.ticketTypes.cancel}
                variant="secondary"
                onPress={onClose}
                testID="ticket-type-form-cancel"
              />
            </>
          ) : (
            <>
              <Text style={type.h3}>
                {existing
                  ? copy.ticketTypes.confirm.editTitle
                  : copy.ticketTypes.confirm.createTitle}
              </Text>
              <Text style={styles.confirmName}>{form.displayName}</Text>
              {changes.priceChanged ? (
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLine}>
                    {copy.ticketTypes.confirm.priceLine(
                      changes.priceFrom == null
                        ? null
                        : formatMoney(form.currency, changes.priceFrom),
                      formatMoney(form.currency, changes.priceTo),
                    )}
                  </Text>
                  <Text style={styles.confirmNote}>
                    {copy.ticketTypes.confirm.priceNote}
                  </Text>
                </View>
              ) : null}
              {changes.capacityChanged ? (
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLine}>
                    {copy.ticketTypes.confirm.capacityLine(
                      changes.capacityFrom == null
                        ? null
                        : String(changes.capacityFrom),
                      changes.capacityTo == null
                        ? null
                        : String(changes.capacityTo),
                    )}
                  </Text>
                  <Text style={styles.confirmNote}>
                    {copy.ticketTypes.confirm.capacityNote}
                  </Text>
                </View>
              ) : null}
              {failure ? (
                <InlineBanner compact tone="danger" message={failure} />
              ) : null}
              <Button
                label={
                  existing
                    ? copy.ticketTypes.confirm.confirmSave
                    : copy.ticketTypes.confirm.confirmCreate
                }
                loading={submitting}
                onPress={() => void handleSubmit()}
                testID="ticket-type-form-confirm"
              />
              <Button
                label={copy.ticketTypes.confirm.cancel}
                variant="secondary"
                disabled={submitting}
                onPress={() => setStep("form")}
                testID="ticket-type-form-back"
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

/**
 * 通用二次確認框（取消／確定兩顆）。
 *
 * 形狀照 `content.tsx` 的 `ConfirmDialog`：自繪 `Modal`、按鈕順序
 * 「主動作在上、取消在下」。不用 RN 的 `Alert.alert`（全案沒有用過它）。
 */
function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busy,
  tone,
  onConfirm,
  onCancel,
  testID,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  busy: boolean;
  tone: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
  testID: string;
}) {
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onCancel();
      }}
    >
      <View style={styles.backdrop}>
        <View style={styles.dialog} testID={testID}>
          <Text style={type.h3}>{title}</Text>
          <Text style={styles.confirmNote}>{message}</Text>
          <Button
            label={confirmLabel}
            variant={tone === "danger" ? "dangerSolid" : "primary"}
            loading={busy}
            onPress={onConfirm}
            testID={`${testID}-confirm`}
          />
          <Button
            label={copy.ticketTypes.cancel}
            variant="secondary"
            disabled={busy}
            onPress={onCancel}
            testID={`${testID}-cancel`}
          />
        </View>
      </View>
    </Modal>
  );
}

/**
 * 停用的二次確認。
 *
 * Web 也有一個確認框（瀏覽器原生 `confirm()`），但它的文案寫「此操作不可逆」
 * ——查證後不成立（後端只是把 `isActive` 設成 false，PATCH 可以再開回來；
 * 而且既有報名從來不受影響）。更重要的是它**沒有說已售出的票會怎樣**，
 * 而那正是操作員按下確認前最想知道的事。
 *
 * 所以這裡把四個後果分開列，一句一件事（見 `copy.ticketTypes.deactivateConfirm`
 * 與 `services/ticket-type.service.ts` 的 `deactivateTicketType`）。
 */
function DeactivateDialog({
  ticket,
  busy,
  onConfirm,
  onCancel,
}: {
  ticket: AdminTicketType;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const lines = [
    copy.ticketTypes.deactivateConfirm.registrationsUnaffected,
    copy.ticketTypes.deactivateConfirm.newRegistrationsBlocked,
    copy.ticketTypes.deactivateConfirm.publicPageHidden,
    copy.ticketTypes.deactivateConfirm.adminStillVisible,
  ];

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onCancel();
      }}
    >
      <View style={styles.backdrop}>
        <View style={styles.dialog} testID="ticket-type-deactivate-confirm">
          <Text style={type.h3}>
            {copy.ticketTypes.deactivateConfirm.title}
          </Text>
          <Text style={styles.confirmName}>
            {copy.ticketTypes.deactivateConfirm.intro(ticket.displayName)}
          </Text>
          {lines.map((line) => (
            <Text key={line} style={styles.confirmBullet}>
              {"・"}
              {line}
            </Text>
          ))}
          <Button
            label={copy.ticketTypes.deactivateConfirm.confirm}
            variant="dangerSolid"
            loading={busy}
            onPress={onConfirm}
            testID="ticket-type-deactivate-confirm-submit"
          />
          <Button
            label={copy.ticketTypes.deactivateConfirm.cancel}
            variant="secondary"
            disabled={busy}
            onPress={onCancel}
            testID="ticket-type-deactivate-confirm-cancel"
          />
        </View>
      </View>
    </Modal>
  );
}

/**
 * 勾選列。
 *
 * 形狀照搬 `content.tsx` 的 `PublishCheckbox`（同樣是 `Pressable` +
 * `accessibilityRole="checkbox"`），不另外抽通用元件——目前只有這一頁在用。
 */
function ToggleRow({
  label,
  hint,
  value,
  onToggle,
  testID,
}: {
  label: string;
  hint: string;
  value: boolean;
  onToggle: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={styles.checkboxRow}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      testID={testID}
    >
      <View style={[styles.checkbox, value && styles.checkboxOn]}>
        {value ? (
          <Icon name="check" size={14} color={semantic.text.onPrimary} />
        ) : null}
      </View>
      <Text style={styles.checkboxLabel}>
        {label}
        <Text style={styles.checkboxHint}>{hint}</Text>
      </Text>
    </Pressable>
  );
}

/** `MOP 1500.50`。價格是字串（Decimal），全程不經過 `Number()`。 */
function formatMoney(currency: string, price: string): string {
  return `${currency} ${price}`;
}

/**
 * 表單目前選中的付款方式。
 *
 * UI 是單選（與 Web `selectPaymentMethod` 相同），但狀態存的是陣列型別
 * （`CreateTicketTypePayload.allowedPaymentMethods` 就是陣列）。挑選規則與
 * `normalizeAllowedPaymentMethods` 一致：`BANK_TRANSFER` 優先，其餘回 `FREE`。
 */
function enabledPaymentMethodOf(
  methods: readonly EventPaymentMethod[],
): EnabledPaymentMethod {
  return methods.includes("BANK_TRANSFER") ? "BANK_TRANSFER" : "FREE";
}

function registrantTypeLabel(value: RegistrantType): string {
  return copy.ticketTypes.registrantTypeLabels[value] ?? value;
}

/** 錯誤碼 → 文案。util 不持有任何字串，畫面負責翻譯。 */
function formErrorMessage(code: TicketTypeFormErrorCode): string {
  switch (code) {
    case "name_required":
      return copy.ticketTypes.formErrors.nameRequired;
    case "display_name_required":
      return copy.ticketTypes.formErrors.displayNameRequired;
    case "price_required":
      return copy.ticketTypes.formErrors.priceRequired;
    case "price_invalid":
      return copy.ticketTypes.formErrors.priceInvalid;
    case "capacity_invalid":
      return copy.ticketTypes.formErrors.capacityInvalid;
    case "tokens_invalid":
      return copy.ticketTypes.formErrors.tokensInvalid;
    case "access_code_required":
      return copy.ticketTypes.formErrors.accessCodeRequired;
    case "payment_method_required":
      return copy.ticketTypes.formErrors.paymentMethodRequired;
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: semantic.bg.canvas },
  body: {
    padding: spacing.screen,
    gap: spacing.gap,
  },
  skeletonGroup: { gap: spacing.gap },
  list: { gap: spacing.gap },
  badges: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: space[2],
  },
  displayName: { ...type.label, color: semantic.text.primary },
  /** 識別名稱是系統用的，用等寬字感與次級色把它壓下去（Web 也是灰字小膠囊）。 */
  name: { ...type.caption, color: semantic.text.muted },
  pill: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: space[2],
    paddingVertical: 2,
  },
  pillLabel: { ...type.caption },
  meta: {
    ...type.caption,
    color: semantic.text.secondary,
    marginTop: space[2],
  },
  accessCode: {
    ...type.caption,
    color: semantic.status.warning.fg,
    marginTop: space[1],
  },
  /**
   * 卡片內動作列。
   *
   * 與 `polls.tsx` 同一個處理：加上分隔線，否則按鈕會看起來像屬於上面那行字。
   */
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: space[2],
    marginTop: space[3],
    paddingTop: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: semantic.border.decorative,
  },
  /** 動作鈕不撐滿卡片寬度（`Button` 預設 `fullWidth`），用外層限寬。 */
  actionButton: { minWidth: layout.touchMin * 2.6 },

  // ── 表單彈窗 ────────────────────────────────────────────────
  backdrop: {
    flex: 1,
    backgroundColor: semantic.bg.scrim,
    justifyContent: "center",
    padding: spacing.screen,
  },
  dialog: {
    backgroundColor: semantic.bg.surface,
    borderRadius: radius.lg,
    padding: spacing.screen,
    gap: spacing.gap,
    maxHeight: "88%",
  },
  formScroll: { flexGrow: 0 },
  formBody: { gap: spacing.gap, paddingBottom: space[2] },
  confirmName: { ...type.body, color: semantic.text.primary },
  confirmRow: { gap: space[1] },
  confirmLine: { ...type.label, color: semantic.text.primary },
  confirmNote: { ...type.caption, color: semantic.text.secondary },
  confirmBullet: { ...type.body, color: semantic.text.secondary },
  sectionLabel: { ...type.label, color: semantic.text.secondary },
  capabilityBlock: {
    gap: space[1],
    paddingTop: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: semantic.border.decorative,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space[3],
    minHeight: layout.touchMin,
    paddingVertical: space[2],
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: semantic.border.interactive,
    backgroundColor: semantic.bg.surface,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxOn: {
    backgroundColor: semantic.action.primary,
    borderColor: semantic.action.primary,
  },
  checkboxLabel: { ...type.body, flex: 1, color: semantic.text.primary },
  checkboxHint: { ...type.caption, color: semantic.text.muted },
});
