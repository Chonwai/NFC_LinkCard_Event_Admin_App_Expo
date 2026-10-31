import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineBanner } from "@/components/ui/InlineBanner";
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
import type { AdminTicketType } from "@/types/ticketType.types";

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
              />
            ))}
          </View>
        )}
      </ScrollView>
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
}: {
  ticket: AdminTicketType;
  copied: boolean;
  onCopy: () => void;
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
      </View>
    </Card>
  );
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
    justifyContent: "flex-end",
    gap: space[2],
    marginTop: space[3],
    paddingTop: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: semantic.border.decorative,
  },
  /** 動作鈕不撐滿卡片寬度（`Button` 預設 `fullWidth`），用外層限寬。 */
  actionButton: { minWidth: layout.touchMin * 2.6 },
});
