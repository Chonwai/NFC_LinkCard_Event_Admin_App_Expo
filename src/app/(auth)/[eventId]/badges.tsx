/**
 * 活動的 Badge（實體手環／卡片）庫存與批次。
 *
 * 對齊 `FE:app/(event)/manage/[eventId]/badges/page.tsx`（Web 的徽章管理頁）。
 * Web 做得到的讀取，這裡都要做得到；寫入面在後續 commit 逐項補上。
 *
 * ## 本輪（讀取）與 Web 的差異
 *
 * ### 一、統計與批次聚合以「全量」為基礎 —— 與 Web 相同，但值得寫下來
 *
 * Web 除了當頁清單之外，另外打一次 `all: true` 拿全量（`loadAll`），因為
 * 「總數／已寫卡／已綁定」若只算當頁，就會低報，而畫面上完全看不出來。
 * 這裡照做：`badges` 給清單，`allBadges` 給統計與批次聚合，兩個來源
 * **刻意不同**。統計失敗不阻擋列表（照 Web）。
 *
 * ### 二、分頁用無限捲動，不是上下頁按鈕
 *
 * Web 是「上一頁／下一頁 ＋ 第 X／Y 頁」，這裡是 `onEndReached` 續接。
 * 這是平台差異不是能力差異——兩者都能取到每一筆，只是手機上的手勢不同。
 * `hasMore` 一律由後端 `pagination.total` 推算（**不是**本地陣列長度），
 * 否則最後一頁會永遠以為還有下一頁。
 *
 * ### 三、狀態篩選是遠端查詢，不是本地過濾
 *
 * Web 改篩選會改變後端的 `status` 參數並重新載入第一頁。這裡相同：改篩選
 * 就回到第 1 頁。本地過濾會讓「載入更多」拿到被前段篩選丟掉的資料，
 * 看起來像漏頁。
 *
 * ### 四、明細列多了「寫卡時間」與 QR
 *
 * Web 的明細表有 `tagUid`／`qrCode`／`batchLabel`／`status`／`writtenAt`／
 * `boundAt` 六欄。原本 App 只有 `tagUid`／`badgeType`／`batchLabel`／
 * `boundAt`，少掉 `writtenAt`——而「這張卡寫過了沒」正是操作員在
 * 「已寫卡」統計對不起來時唯一能逐筆核對的欄位。補上，不是新增功能。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";

import { Button } from "@/components/ui/Button";
import { ChoiceChips } from "@/components/ui/ChoiceChips";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import {
  InlineBanner,
  type InlineBannerTone,
} from "@/components/ui/InlineBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmActionDialog } from "@/components/badges/ConfirmActionDialog";
import { CompleteBatchDialog } from "@/components/badges/CompleteBatchDialog";
import { CreateBatchDialog } from "@/components/badges/CreateBatchDialog";
import { copy } from "@/constants/copy.zh-TW";
import {
  layout,
  radius,
  semantic,
  space,
  spacing,
  type,
} from "@/constants/theme";
import { nfcService } from "@/services/nfc.service";
import type {
  BadgeStatus,
  CreateNfcBatchParams,
  NfcBadgeInventoryItem,
  NfcLookupResult,
} from "@/types/api.types";
import {
  buildCompleteBatchConfirmation,
  buildCreateBatchConfirmation,
  type CompleteBatchLine,
} from "@/utils/badge-batch";
import {
  BADGE_STAT_KEYS,
  BADGE_STATUS_FILTERS,
  buildBadgeBatchSummaries,
  buildBadgeStats,
  canCompleteBadgeBatch,
  formatBadgeTimestamp,
  type BadgeBatchSummary,
  type BadgeStats,
} from "@/utils/badge-inventory";
import { getApiErrorCode, getApiErrorStatus } from "@/utils/api-error";

/** 查詢結果：後端摘要 + 此次查詢的 tagUid */
type LookupResultView = NfcLookupResult & { tagUid: string };

/**
 * 狀態篩選的晶片值。
 *
 * `BADGE_STATUS_FILTERS` 用空字串代表「全部」（那是後端「不送 status」的
 * 表示法），但空字串當 `testID` 後綴與 `key` 都很難看，也不利讀屏，
 * 所以畫面這一層改用 `ALL`，只在送請求時換回「不送 status」。
 */
type StatusFilterValue = "ALL" | BadgeStatus;

const STATUS_CHOICES: readonly StatusFilterValue[] = BADGE_STATUS_FILTERS.map(
  (value) => (value === "" ? "ALL" : value),
);

const STATUS_LABELS: Record<string, string> = {
  UNASSIGNED: copy.badgeStatus.unassigned,
  BOUND: copy.badgeStatus.bound,
  ACTIVE: copy.badgeStatus.active,
  DEACTIVATED: copy.badgeStatus.deactivated,
  LOST: copy.badgeStatus.lost,
};

const STATUS_TONE: Record<string, keyof typeof semantic.status> = {
  UNASSIGNED: "pending",
  BOUND: "success",
  ACTIVE: "available",
  DEACTIVATED: "warning",
  LOST: "danger",
};

/** 統計卡的文案。排序用 `BADGE_STAT_KEYS`，鍵的集合由 `BadgeStats` 決定。 */
const STAT_COPY: Record<keyof BadgeStats, { label: string; desc: string }> = {
  total: { label: copy.badges.total, desc: copy.badges.totalDesc },
  unassigned: {
    label: copy.badges.unassigned,
    desc: copy.badges.unassignedDesc,
  },
  written: { label: copy.badges.written, desc: copy.badges.writtenDesc },
  bound: { label: copy.badges.bound, desc: copy.badges.boundDesc },
  deactivated: {
    label: copy.badges.deactivated,
    desc: copy.badges.deactivatedDesc,
  },
};

const COPY_FEEDBACK_MS = 1600;

/** 一頁幾筆。與 Web 的 50 不同是因為手機一次看得到的列數較少——不是能力差異。 */
const PAGE_SIZE = 20;

export default function BadgesScreen() {
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const [lookupUid, setLookupUid] = useState("");
  const [lookupResult, setLookupResult] = useState<LookupResultView | null>(
    null,
  );
  const [lookupLoading, setLookupLoading] = useState(false);
  const [banner, setBanner] = useState<{
    tone: InlineBannerTone;
    message: string;
  } | null>(null);

  const [badges, setBadges] = useState<NfcBadgeInventoryItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("ALL");

  /**
   * 全量 badge（無分頁）——統計卡與批次聚合用。
   *
   * 刻意與 `badges` 分開：`badges` 是「目前篩選下的當頁」，`allBadges` 是
   * 「該活動全部」。混用會讓統計卡隨篩選跳動，而那張卡的語意是「這個活動
   * 一共有多少張手環」。
   */
  const [allBadges, setAllBadges] = useState<NfcBadgeInventoryItem[]>([]);
  const [statsReady, setStatsReady] = useState(false);

  /**
   * 重新載入的觸發計數器。
   *
   * 與 Web 的 `await load(1); await loadAll();` 同義，但不在 handler 內直接
   * 呼叫載入函式——載入路徑永遠只有 effect 那一份。
   */
  const [reloadKey, setReloadKey] = useState(0);

  /**
   * 建立批次的三個狀態：表單是否開著、表單已填好的參數（等待確認）、
   * 以及送出中的錯誤。
   *
   * `pendingCreate` 是「已通過驗證但還沒送出」，它必須是 `null` 才代表不需要
   * 確認框——這與 `bank-transfer-review.ts` 的 `intent` 同一個手法：
   * 送出前先落到一個可被觀察的狀態，而不是按鈕裡的 `if`。
   */
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingCreate, setPendingCreate] =
    useState<CreateNfcBatchParams | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  /**
   * 完成批次的三個狀態（與建立批次同一個形狀）。
   *
   * `completeTarget` 是「哪一批正在回填」（表單開著），`pendingComplete` 是
   * 「已通過解析、等待確認」。兩者分開是因為確認框必須顯示**批次名稱**——
   * 上百張手環的 UID 貼錯批次是最貴的一種錯。
   */
  const [completeTarget, setCompleteTarget] =
    useState<BadgeBatchSummary | null>(null);
  const [pendingComplete, setPendingComplete] = useState<{
    /**
     * 真實 batchId；`null` 代表散卡群組。
     *
     * 型別刻意保留 `null` 而不是在呼叫端填 `""`——Web 就是把散卡的 `batchId`
     * 寫成空字串，於是 `POST /nfc/batch//complete` 回 404。保留 `null` 讓
     * `submitCompleteBatch` 的守衛有東西可以擋，而不是靠「按鈕不會出現」。
     */
    batchId: string | null;
    label: string;
    updated: CompleteBatchLine[];
  } | null>(null);
  const [completeBusy, setCompleteBusy] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    };
  }, []);

  const copyTagUid = useCallback((key: string, tagUid: string) => {
    void Clipboard.setStringAsync(tagUid).then(() => {
      setCopiedKey(key);
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
      copyResetTimer.current = setTimeout(() => {
        setCopiedKey(null);
        copyResetTimer.current = null;
      }, COPY_FEEDBACK_MS);
    });
  }, []);

  const statusParam = statusFilter === "ALL" ? undefined : statusFilter;

  /**
   * 第一頁（以及換篩選、寫入後的重載）。
   *
   * `statusFilter` 在依賴裡是刻意的：換篩選必須回到第 1 頁，否則會出現
   * 「第 3 頁的新篩選結果接在第 1 頁後面」這種不可能的清單。
   */
  useEffect(() => {
    let active = true;

    async function loadFirstPage() {
      if (!eventId) return;
      setListLoading(true);
      setBanner(null);
      try {
        const res = await nfcService.listBadges(eventId, {
          page: 1,
          pageSize: PAGE_SIZE,
          status: statusParam,
        });
        if (!active) return;
        setBadges(res.badges);
        setPage(1);
        setHasMore(PAGE_SIZE < (res.pagination?.total ?? 0));
      } catch {
        if (!active) return;
        setBadges([]);
        setHasMore(false);
        setBanner({ tone: "danger", message: copy.home.loadFailed });
      } finally {
        if (active) setListLoading(false);
      }
    }

    void loadFirstPage();

    return () => {
      active = false;
    };
    // statusParam 由 statusFilter 推導，兩者同值不同名——依賴列 statusFilter
  }, [eventId, statusFilter, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /** 全量（統計與批次聚合）。失敗不阻擋列表——照 Web。 */
  useEffect(() => {
    let active = true;

    async function loadAll() {
      if (!eventId) return;
      try {
        const res = await nfcService.listBadges(eventId, { all: true });
        if (!active) return;
        setAllBadges(res.badges);
        setStatsReady(true);
      } catch {
        // 統計失敗不阻擋列表；保留上次資料（照 Web）
      }
    }

    void loadAll();

    return () => {
      active = false;
    };
  }, [eventId, reloadKey]);

  const loadMore = useCallback(async () => {
    if (!eventId || listLoading || !hasMore) return;
    const nextPage = page + 1;
    setListLoading(true);
    try {
      const res = await nfcService.listBadges(eventId, {
        page: nextPage,
        pageSize: PAGE_SIZE,
        status: statusParam,
      });
      setBadges((prev) => [...prev, ...res.badges]);
      setPage(nextPage);
      setHasMore(nextPage * PAGE_SIZE < (res.pagination?.total ?? 0));
    } catch {
      setBanner({ tone: "danger", message: copy.home.loadFailed });
    } finally {
      setListLoading(false);
    }
  }, [eventId, hasMore, listLoading, page, statusParam]);

  const stats = useMemo(() => buildBadgeStats(allBadges), [allBadges]);
  const batchSummaries = useMemo(
    () => buildBadgeBatchSummaries(allBadges),
    [allBadges],
  );

  const createConfirmation = pendingCreate
    ? buildCreateBatchConfirmation(pendingCreate)
    : null;

  /**
   * 真的建立批次（確認框按下確認之後）。
   *
   * 失敗時**不關掉確認框**：錯誤顯示在同一個框裡，操作員可以直接取消，而
   * 不是回到表單重填一次——重填不會讓「權限不足」變成權限足夠。
   */
  const submitCreateBatch = useCallback(async () => {
    if (!eventId || !pendingCreate) return;
    setCreateBusy(true);
    setCreateError(null);
    try {
      const created = await nfcService.createBatch(eventId, pendingCreate);
      setPendingCreate(null);
      setBanner({
        tone: "success",
        message: copy.badges.createSuccess(created.count),
      });
      setReloadKey((key) => key + 1);
    } catch {
      setCreateError(copy.badges.createFailed);
    } finally {
      setCreateBusy(false);
    }
  }, [eventId, pendingCreate]);

  /**
   * 真的回填 tagUid（確認框按下確認之後）。
   *
   * 後端是**逐筆套用**、部分成功也回 200，所以這裡把 `failures` 當成
   * 資訊而不是失敗：有失敗就報 `warning` 並說出張數，沒有才是 `success`。
   * 兩種情況都重載——失敗的那幾筆在清單上就還是舊值，重載才看得到真實狀態。
   */
  const submitCompleteBatch = useCallback(async () => {
    if (!eventId || !pendingComplete || !pendingComplete.batchId) return;
    setCompleteBusy(true);
    setCompleteError(null);
    try {
      const result = await nfcService.completeBatch(
        eventId,
        pendingComplete.batchId,
        { updated: pendingComplete.updated },
      );
      setPendingComplete(null);
      setBanner({
        tone: result.failures.length > 0 ? "warning" : "success",
        message:
          result.failures.length > 0
            ? copy.badges.completePartial(
                result.updatedCount,
                result.failures.length,
              )
            : copy.badges.completeSuccess(result.updatedCount),
      });
      setReloadKey((key) => key + 1);
    } catch {
      setCompleteError(copy.badges.completeFailed);
    } finally {
      setCompleteBusy(false);
    }
  }, [eventId, pendingComplete]);

  const completeConfirmation = pendingComplete
    ? buildCompleteBatchConfirmation(pendingComplete.updated)
    : null;

  const doLookup = useCallback(async () => {
    if (!eventId || !lookupUid.trim()) return;
    const queriedUid = lookupUid.trim().toUpperCase();
    setLookupLoading(true);
    setBanner(null);
    setLookupResult(null);
    try {
      const data = await nfcService.lookup(eventId, { uid: queriedUid });
      setLookupResult({ ...data, tagUid: queriedUid });
    } catch (error) {
      const status = getApiErrorStatus(error);
      const code = getApiErrorCode(error);
      const notFound =
        status === 404 ||
        code === "NFC_BADGE_NOT_BOUND" ||
        code === "NFC_BADGE_DEACTIVATED";
      setBanner({
        tone: notFound ? "warning" : "danger",
        message: notFound
          ? copy.badges.lookupNotFound
          : copy.badges.lookupFailed,
      });
    } finally {
      setLookupLoading(false);
    }
  }, [eventId, lookupUid]);

  const renderTagUidRow = (key: string, tagUid: string) => {
    const copied = copiedKey === key;
    return (
      <Pressable
        onPress={() => {
          copyTagUid(key, tagUid);
        }}
        style={styles.tagUidRow}
        accessibilityRole="button"
        accessibilityLabel={
          copied
            ? copy.badges.tagUidCopied
            : `${copy.badges.copyTagUid} ${tagUid}`
        }
        hitSlop={6}
      >
        <Text
          style={styles.tagUidText}
          numberOfLines={1}
          maxFontSizeMultiplier={layout.maxFontScaleBody}
        >
          <Text style={styles.tagUidPrefix}>{copy.badges.tagUidLabel}：</Text>
          {tagUid}
        </Text>
        <Icon
          name={copied ? "check" : "copy"}
          size="sm"
          color={copied ? semantic.status.success.fg : semantic.icon.muted}
        />
      </Pressable>
    );
  };

  const renderBadge = ({ item }: { item: NfcBadgeInventoryItem }) => {
    const tone = STATUS_TONE[item.status] ?? "neutral";
    const statusToken = semantic.status[tone];
    const writtenAt = formatBadgeTimestamp(item.writtenAt);
    const boundAt = formatBadgeTimestamp(item.boundAt);
    return (
      <View style={styles.badgeCard} testID={`badge-row-${item.id}`}>
        <View style={styles.badgeCardTop}>
          <View style={styles.tagUidWrap}>
            {renderTagUidRow(item.id, item.tagUid)}
          </View>
          <View
            style={[styles.statusPill, { backgroundColor: statusToken.bg }]}
          >
            <Text
              style={[type.badge, { color: statusToken.fg }]}
              maxFontSizeMultiplier={layout.maxFontScaleFixed}
            >
              {STATUS_LABELS[item.status] ?? item.status}
            </Text>
          </View>
        </View>

        <View style={styles.badgeMetaRow}>
          <Text
            style={styles.badgeMeta}
            numberOfLines={1}
            maxFontSizeMultiplier={layout.maxFontScaleBody}
          >
            {item.badgeType}
            {item.batchLabel ? ` · ${item.batchLabel}` : ""}
          </Text>
          {item.qrCode ? (
            <Text
              style={styles.qrCode}
              numberOfLines={1}
              maxFontSizeMultiplier={layout.maxFontScaleBody}
              testID={`badge-qr-${item.id}`}
            >
              {copy.badges.qrCodeLabel}：{item.qrCode}
            </Text>
          ) : null}
        </View>

        <View style={styles.badgeMetaRow}>
          <Text
            style={styles.badgeMeta}
            numberOfLines={1}
            maxFontSizeMultiplier={layout.maxFontScaleBody}
            testID={`badge-written-${item.id}`}
          >
            {copy.badges.writtenAtLabel}：
            {writtenAt ?? copy.badges.writtenAtEmpty}
          </Text>
          <Text
            style={styles.boundAtValue}
            numberOfLines={1}
            maxFontSizeMultiplier={layout.maxFontScaleBody}
          >
            {copy.badges.boundAtLabel}：{boundAt ?? copy.badges.boundAtEmpty}
          </Text>
        </View>
      </View>
    );
  };

  const listHeader = (
    <View style={styles.header}>
      {banner ? (
        <InlineBanner compact tone={banner.tone} message={banner.message} />
      ) : null}

      {/* 動作列。Web 把「匯出 CSV」「建立批次」放在頁首右側。 */}
      <View style={styles.actions}>
        <Button
          label={copy.badges.createBatch}
          onPress={() => {
            setCreateError(null);
            setCreateOpen(true);
          }}
          testID="badges-create-batch-open"
        />
      </View>

      <View style={styles.lookupBox}>
        <Text
          style={styles.sectionTitle}
          maxFontSizeMultiplier={layout.maxFontScaleFixed}
        >
          {copy.badges.lookupHint}
        </Text>
        <TextInput
          value={lookupUid}
          onChangeText={setLookupUid}
          placeholder="tagUid"
          placeholderTextColor={semantic.text.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.input}
          accessibilityLabel={copy.badges.lookupHint}
        />
        <Button
          label={copy.badges.lookupButton}
          onPress={() => void doLookup()}
          loading={lookupLoading}
          disabled={!lookupUid.trim()}
        />
        {lookupResult ? (
          <View style={styles.lookupResultSection} testID="badge-lookup-result">
            <View style={styles.lookupResultHeader}>
              <Text
                style={styles.lookupResultTitle}
                maxFontSizeMultiplier={layout.maxFontScaleFixed}
              >
                {copy.badges.lookupResultTitle}
              </Text>
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: semantic.status.success.bg },
                ]}
              >
                <Text
                  style={[type.badge, { color: semantic.status.success.fg }]}
                  maxFontSizeMultiplier={layout.maxFontScaleFixed}
                >
                  {STATUS_LABELS.BOUND}
                </Text>
              </View>
            </View>

            <View style={styles.tagUidWrap}>
              {renderTagUidRow(
                `lookup:${lookupResult.tagUid}`,
                lookupResult.tagUid,
              )}
            </View>

            <Text
              style={styles.lookupName}
              numberOfLines={1}
              maxFontSizeMultiplier={layout.maxFontScaleFixed}
            >
              {lookupResult.displayName}
            </Text>

            {lookupResult.company || lookupResult.jobTitle ? (
              <Text
                style={styles.badgeMeta}
                numberOfLines={1}
                maxFontSizeMultiplier={layout.maxFontScaleBody}
              >
                {[lookupResult.company, lookupResult.jobTitle]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            ) : null}

            <View style={styles.badgeMetaRow}>
              <Text
                style={styles.badgeMeta}
                numberOfLines={1}
                maxFontSizeMultiplier={layout.maxFontScaleBody}
              >
                {copy.badges.registrantTypeLabel}：{lookupResult.registrantType}
              </Text>
              {lookupResult.registrationId ? (
                <Text
                  style={styles.boundAtValue}
                  numberOfLines={1}
                  maxFontSizeMultiplier={layout.maxFontScaleBody}
                >
                  {copy.badges.boundRegistration}
                  {lookupResult.registrationId.slice(0, 8)}…
                </Text>
              ) : null}
            </View>

            {lookupResult.profileUrl ? (
              <Text
                style={styles.profileUrl}
                numberOfLines={1}
                selectable
                maxFontSizeMultiplier={layout.maxFontScaleBody}
              >
                {copy.badges.profileUrlLabel}：{lookupResult.profileUrl}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text
          style={styles.sectionTitle}
          maxFontSizeMultiplier={layout.maxFontScaleFixed}
        >
          {copy.badges.statsHeading}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statRow}
          testID="badge-stats"
        >
          {BADGE_STAT_KEYS.map((key) => {
            const text = STAT_COPY[key];
            return (
              <View
                key={key}
                style={styles.statCard}
                testID={`badge-stat-${key}`}
              >
                <Text
                  style={styles.statLabel}
                  maxFontSizeMultiplier={layout.maxFontScaleBody}
                >
                  {text.label}
                </Text>
                <Text
                  style={styles.statValue}
                  maxFontSizeMultiplier={layout.maxFontScaleFixed}
                >
                  {statsReady ? stats[key] : "—"}
                </Text>
                <Text
                  style={styles.statDesc}
                  numberOfLines={2}
                  maxFontSizeMultiplier={layout.maxFontScaleBody}
                >
                  {text.desc}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text
          style={styles.sectionTitle}
          maxFontSizeMultiplier={layout.maxFontScaleFixed}
        >
          {copy.badges.batchesHeading}
        </Text>
        {batchSummaries.length === 0 ? (
          <Text
            style={styles.muted}
            maxFontSizeMultiplier={layout.maxFontScaleBody}
          >
            {copy.badges.batchesEmpty}
          </Text>
        ) : (
          batchSummaries.map((batch) => (
            <View
              key={batch.key}
              style={styles.batchCard}
              testID={`badge-batch-${batch.key}`}
            >
              <Text
                style={styles.batchLabel}
                numberOfLines={1}
                maxFontSizeMultiplier={layout.maxFontScaleFixed}
              >
                {batch.batchLabel ??
                  (batch.batchId
                    ? batch.batchId.slice(0, 8)
                    : copy.badges.noBatchLabel)}
              </Text>
              <View style={styles.batchMetrics}>
                {(
                  [
                    { key: "count", label: copy.badges.countColumn },
                    { key: "writtenCount", label: copy.badges.writtenColumn },
                    { key: "boundCount", label: copy.badges.boundColumn },
                    { key: "assignedCount", label: copy.badges.assignedColumn },
                  ] as const
                ).map((metric) => (
                  <View key={metric.key} style={styles.batchMetric}>
                    <Text
                      style={styles.batchMetricValue}
                      maxFontSizeMultiplier={layout.maxFontScaleFixed}
                    >
                      {batch[metric.key]}
                    </Text>
                    <Text
                      style={styles.batchMetricLabel}
                      maxFontSizeMultiplier={layout.maxFontScaleBody}
                    >
                      {metric.label}
                    </Text>
                  </View>
                ))}
              </View>

              {/*
                「完成批次」只給真的批次。
                散卡群組（batchId 為 null）沒有批次可以完成——Web 在那一列
                照樣畫按鈕，按下去是 404（見 utils/badge-inventory.ts 檔頭）。
              */}
              {canCompleteBadgeBatch(batch) ? (
                <Button
                  label={copy.badges.completeBatch}
                  variant="secondary"
                  onPress={() => {
                    setCompleteError(null);
                    setCompleteTarget(batch);
                  }}
                  testID={`badge-batch-complete-${batch.key}`}
                />
              ) : null}
            </View>
          ))
        )}
      </View>

      <ChoiceChips
        label={copy.badges.statusFilterLabel}
        options={STATUS_CHOICES}
        value={statusFilter}
        labelFor={(value) =>
          value === "ALL" ? copy.badges.statusFilterAll : STATUS_LABELS[value]
        }
        onSelect={setStatusFilter}
        testID="badge-status-filter"
      />

      <Text
        style={styles.sectionTitle}
        maxFontSizeMultiplier={layout.maxFontScaleFixed}
      >
        {copy.badges.listSectionTitle}
      </Text>
    </View>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={copy.event.badgesTitle}
        leading="back"
        backFallbackPath="/(auth)/home"
      />

      <FlatList
        data={badges}
        keyExtractor={(item) => item.id}
        renderItem={renderBadge}
        ListHeaderComponent={listHeader}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: space[2] }} />}
        onEndReached={() => {
          if (hasMore && !listLoading) void loadMore();
        }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          listLoading ? (
            <View style={styles.skeletonList}>
              <Skeleton width="100%" height={88} radius={8} />
              <Skeleton width="100%" height={88} radius={8} />
            </View>
          ) : (
            <EmptyState
              icon="empty-card"
              title={copy.badges.emptyTitle}
              description={copy.badges.emptyHint}
            />
          )
        }
        ListFooterComponent={
          listLoading && badges.length > 0 ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator color={semantic.icon.brand} />
            </View>
          ) : null
        }
      />

      {createOpen ? (
        <CreateBatchDialog
          busy={createBusy}
          onSubmit={(params) => {
            setCreateOpen(false);
            setCreateError(null);
            setPendingCreate(params);
          }}
          onCancel={() => setCreateOpen(false)}
        />
      ) : null}

      {completeTarget ? (
        <CompleteBatchDialog
          batchLabel={
            completeTarget.batchLabel ??
            completeTarget.batchId ??
            copy.badges.noBatchLabel
          }
          busy={completeBusy}
          onSubmit={(updated) => {
            const target = completeTarget;
            setCompleteTarget(null);
            setCompleteError(null);
            setPendingComplete({
              batchId: target.batchId,
              label:
                target.batchLabel ?? target.batchId ?? copy.badges.noBatchLabel,
              updated,
            });
          }}
          onCancel={() => setCompleteTarget(null)}
        />
      ) : null}

      {pendingComplete && completeConfirmation ? (
        <ConfirmActionDialog
          title={copy.badges.confirmCompleteTitle}
          intro={copy.badges.confirmCompleteIntro}
          rows={[
            { label: copy.badges.rowBatchLabel, value: pendingComplete.label },
            {
              label: copy.badges.rowCompleteCount,
              value: String(completeConfirmation.count),
            },
            {
              label: copy.badges.rowCompletePreview,
              value: [
                ...completeConfirmation.preview.map(
                  (line) => `${line.badgeId.slice(0, 8)} → ${line.realTagUid}`,
                ),
                ...(completeConfirmation.remaining > 0
                  ? [
                      copy.badges.completePreviewMore(
                        completeConfirmation.remaining,
                      ),
                    ]
                  : []),
              ].join("\n"),
            },
          ]}
          warning={copy.badges.confirmCompleteWarning}
          confirmLabel={copy.badges.confirmComplete}
          busy={completeBusy}
          error={completeError}
          onConfirm={() => void submitCompleteBatch()}
          onCancel={() => {
            if (completeBusy) return;
            setPendingComplete(null);
            setCompleteError(null);
          }}
          testID="badges-complete-confirm"
        />
      ) : null}

      {pendingCreate && createConfirmation ? (
        <ConfirmActionDialog
          title={copy.badges.confirmCreateTitle}
          intro={copy.badges.confirmCreateIntro}
          rows={[
            {
              label: copy.badges.rowCount,
              value: String(createConfirmation.count),
            },
            {
              label: copy.badges.rowBadgeType,
              value: createConfirmation.badgeType ?? copy.badges.notSpecified,
            },
            ...(createConfirmation.colorCode
              ? [
                  {
                    label: copy.badges.rowColorCode,
                    value: createConfirmation.colorCode,
                  },
                ]
              : []),
            {
              label: copy.badges.rowBatchLabel,
              value: createConfirmation.batchLabel ?? copy.badges.notSpecified,
            },
          ]}
          warning={copy.badges.confirmCreateWarning}
          confirmLabel={copy.badges.confirmCreate}
          busy={createBusy}
          error={createError}
          onConfirm={() => void submitCreateBatch()}
          onCancel={() => {
            if (createBusy) return;
            setPendingCreate(null);
            setCreateError(null);
          }}
          testID="badges-create-confirm"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: semantic.bg.canvas },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: spacing.screen,
    paddingTop: space[4],
    paddingBottom: spacing.safeFooter,
    gap: space[2],
  },
  header: { gap: space[5], paddingBottom: space[3] },
  actions: { gap: space[2] },
  section: { gap: space[3] },
  muted: { ...type.caption, color: semantic.text.muted },
  sectionTitle: {
    ...type.h3,
    color: semantic.text.primary,
  },
  lookupBox: { gap: space[3] },
  input: {
    backgroundColor: semantic.bg.surface,
    borderWidth: 1,
    borderColor: semantic.border.interactive,
    borderRadius: 12,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    fontSize: type.mono.fontSize,
    fontFamily: type.mono.fontFamily,
    color: semantic.text.primary,
    minHeight: layout.buttonHeight,
  },
  lookupResultSection: {
    backgroundColor: semantic.bg.brandSoft,
    borderRadius: radius.md,
    padding: space[3],
    gap: space[2],
    borderWidth: 1.5,
    borderColor: semantic.border.interactiveSelected,
  },
  lookupResultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space[2],
  },
  lookupResultTitle: {
    ...type.label,
    color: semantic.action.primary,
  },
  lookupName: {
    ...type.h3,
    color: semantic.text.primary,
  },
  profileUrl: {
    ...type.monoSm,
    color: semantic.text.muted,
  },
  statRow: { gap: space[2], paddingRight: space[4] },
  statCard: {
    width: 132,
    backgroundColor: semantic.bg.surface,
    borderRadius: radius.md,
    padding: space[3],
    gap: space[1],
    borderWidth: 1,
    borderColor: semantic.border.decorative,
  },
  statLabel: {
    ...type.caption,
    color: semantic.text.secondary,
    fontWeight: "600",
  },
  statValue: {
    ...type.h2,
    color: semantic.text.primary,
  },
  statDesc: {
    ...type.caption,
    color: semantic.text.muted,
  },
  batchCard: {
    backgroundColor: semantic.bg.surface,
    borderRadius: radius.md,
    padding: space[3],
    gap: space[2],
    borderWidth: 1,
    borderColor: semantic.border.decorative,
  },
  batchLabel: {
    ...type.label,
    color: semantic.text.primary,
  },
  batchMetrics: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: space[2],
  },
  batchMetric: { alignItems: "center", flex: 1, gap: 2 },
  batchMetricValue: {
    ...type.h3,
    color: semantic.text.primary,
  },
  batchMetricLabel: {
    ...type.caption,
    color: semantic.text.muted,
  },
  badgeCard: {
    backgroundColor: semantic.bg.surface,
    borderRadius: radius.md,
    padding: space[3],
    gap: space[2],
    borderWidth: 1,
    borderColor: semantic.border.decorative,
  },
  badgeCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
  },
  tagUidWrap: {
    flex: 1,
    minWidth: 0,
  },
  tagUidRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: "100%",
    gap: space[1],
  },
  tagUidText: {
    ...type.monoSm,
    color: semantic.text.primary,
    flexShrink: 1,
  },
  tagUidPrefix: {
    ...type.caption,
    color: semantic.text.secondary,
    fontFamily: type.body.fontFamily,
  },
  badgeMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space[3],
  },
  badgeMeta: {
    ...type.caption,
    color: semantic.text.muted,
    flex: 1,
    minWidth: 0,
  },
  qrCode: {
    ...type.monoSm,
    color: semantic.text.muted,
    flexShrink: 0,
  },
  boundAtValue: {
    ...type.caption,
    color: semantic.text.secondary,
    flexShrink: 0,
    textAlign: "right",
  },
  statusPill: {
    flexShrink: 0,
    borderRadius: radius.full,
    paddingHorizontal: space[3],
    paddingVertical: space[1],
  },
  skeletonList: { gap: space[2] },
  footerLoading: { paddingVertical: space[3] },
});
