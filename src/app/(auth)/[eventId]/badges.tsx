import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import {
  InlineBanner,
  type InlineBannerTone,
} from "@/components/ui/InlineBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { copy } from "@/constants/copy.zh-TW";
import {
  hairline,
  layout,
  radius,
  semantic,
  space,
  spacing,
  type,
} from "@/constants/theme";
import { nfcService } from "@/services/nfc.service";
import type { BadgeStatus, NfcLookupResult } from "@/types/api.types";
import { getApiErrorCode, getApiErrorStatus } from "@/utils/api-error";

interface BadgeListItem {
  id: string;
  tagUid: string;
  badgeType: string;
  status: BadgeStatus;
  registrationId: string | null;
  boundAt: string | null;
  batchLabel?: string | null;
}

/** 查詢結果：後端摘要 + 此次查詢的 tagUid */
type LookupResultView = NfcLookupResult & { tagUid: string };

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

const COPY_FEEDBACK_MS = 1600;

function formatBoundAt(iso: string | null | undefined): string {
  if (!iso) return copy.badges.boundAtEmpty;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

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

  const [badges, setBadges] = useState<BadgeListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const PAGE_SIZE = 20;

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

  const loadList = useCallback(
    async (nextPage: number, replace = false) => {
      if (!eventId) return;
      setListLoading(true);
      setBanner(null);
      try {
        const { badges: list, pagination } = await nfcService.listBadges(
          eventId,
          {
            page: nextPage,
            pageSize: PAGE_SIZE,
          },
        );
        const items = (list ?? []) as unknown as BadgeListItem[];
        setBadges((prev) => (replace ? items : [...prev, ...items]));
        const total = pagination?.total ?? 0;
        setHasMore(nextPage * PAGE_SIZE < total);
        setPage(nextPage);
      } catch {
        setBanner({ tone: "danger", message: copy.home.loadFailed });
      } finally {
        setListLoading(false);
      }
    },
    [eventId],
  );

  useEffect(() => {
    let active = true;

    async function initial() {
      if (!eventId) return;
      setListLoading(true);
      setBanner(null);
      try {
        const { badges: list, pagination } = await nfcService.listBadges(
          eventId,
          {
            page: 1,
            pageSize: PAGE_SIZE,
          },
        );
        if (!active) return;
        const items = (list ?? []) as unknown as BadgeListItem[];
        setBadges(items);
        const total = pagination?.total ?? 0;
        setHasMore(1 * PAGE_SIZE < total);
        setPage(1);
      } catch {
        if (!active) return;
        setBanner({ tone: "danger", message: copy.home.loadFailed });
      } finally {
        if (active) setListLoading(false);
      }
    }

    void initial();

    return () => {
      active = false;
    };
  }, [eventId]);

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

  const renderBadge = ({ item }: { item: BadgeListItem }) => {
    const tone = STATUS_TONE[item.status] ?? "neutral";
    const statusToken = semantic.status[tone];
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
          <Text
            style={styles.boundAtValue}
            numberOfLines={1}
            maxFontSizeMultiplier={layout.maxFontScaleBody}
          >
            {formatBoundAt(item.boundAt)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={copy.event.badgesTitle}
        leading="back"
        backFallbackPath="/(auth)/home"
      />

      <View style={styles.body}>
        {banner ? (
          <InlineBanner compact tone={banner.tone} message={banner.message} />
        ) : null}

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
            <View
              style={styles.lookupResultSection}
              testID="badge-lookup-result"
            >
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
                    style={[
                      type.badge,
                      { color: semantic.status.success.fg },
                    ]}
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
                  {copy.badges.registrantTypeLabel}：
                  {lookupResult.registrantType}
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

        <View style={styles.listSection}>
          <Text
            style={styles.sectionTitle}
            maxFontSizeMultiplier={layout.maxFontScaleFixed}
          >
            {copy.badges.listSectionTitle}
          </Text>

          {listLoading && badges.length === 0 ? (
            <View style={styles.skeletonList}>
              <Skeleton width="100%" height={88} radius={8} />
              <Skeleton width="100%" height={88} radius={8} />
            </View>
          ) : badges.length === 0 ? (
            <EmptyState
              icon="empty-card"
              title={copy.badges.emptyTitle}
              description={copy.badges.emptyHint}
            />
          ) : (
            <FlatList
              data={badges}
              keyExtractor={(item) => item.id}
              renderItem={renderBadge}
              style={styles.list}
              contentContainerStyle={{ paddingBottom: spacing.safeFooter }}
              ItemSeparatorComponent={() => (
                <View style={{ height: space[2] }} />
              )}
              onEndReached={() => {
                if (hasMore && !listLoading) void loadList(page + 1);
              }}
              onEndReachedThreshold={0.4}
              ListFooterComponent={
                listLoading ? (
                  <View style={styles.footerLoading}>
                    <ActivityIndicator color={semantic.icon.brand} />
                  </View>
                ) : null
              }
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: semantic.bg.canvas },
  body: {
    flex: 1,
    paddingHorizontal: spacing.screen,
    paddingTop: space[4],
    gap: space[5],
  },
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
  listSection: {
    flex: 1,
    minHeight: 0,
    gap: space[3],
    paddingTop: space[2],
    borderTopWidth: hairline,
    borderTopColor: semantic.border.decorative,
  },
  list: { flex: 1 },
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
