import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";

import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { copy } from "@/constants/copy.zh-TW";
import { layout, semantic, space, spacing, type } from "@/constants/theme";
import { eventService, listPageCount } from "@/services/event.service";
import type { Registration } from "@/types/api.types";
import { getApiErrorStatus } from "@/utils/api-error";
import {
  getRegistrationCompany,
  getRegistrationDisplayName,
  maskEmail,
} from "@/utils/registration-display";

const PAGE_SIZE = 20;
const COPY_FEEDBACK_MS = 1800;

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

export default function RegistrationsScreen() {
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const [items, setItems] = useState<Registration[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"server" | "name" | "recent">("server");
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestKey = `${eventId ?? ""}:${status}`;
  const loading = Boolean(eventId) && loadedKey !== requestKey && !error;

  useEffect(() => {
    return () => {
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    };
  }, []);

  const copyRegistrationCode = useCallback((id: string, code: string) => {
    void Clipboard.setStringAsync(code).then(() => {
      setCopiedId(id);
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
      copyResetTimer.current = setTimeout(() => {
        setCopiedId(null);
        copyResetTimer.current = null;
      }, COPY_FEEDBACK_MS);
    });
  }, []);

  useEffect(() => {
    if (!eventId) return;
    let active = true;
    void eventService
      .getRegistrations(eventId, {
        page: 1,
        limit: PAGE_SIZE,
        status: status || undefined,
        visibility: "active",
      })
      .then((res) => {
        if (!active) return;
        setItems(res.registrations ?? []);
        setPage(1);
        setPageCount(listPageCount(res.pagination));
        setError(null);
        setLoadedKey(`${eventId}:${status}`);
      })
      .catch((err: unknown) => {
        if (!active) return;
        const forbidden = getApiErrorStatus(err) === 403;
        setError(
          forbidden ? copy.roster.operatorForbidden : copy.roster.loadFailed,
        );
        setItems([]);
        setLoadedKey(`${eventId}:${status}`);
      });
    return () => {
      active = false;
    };
  }, [eventId, status]);

  const refresh = useCallback(async () => {
    if (!eventId) return;
    setRefreshing(true);
    setError(null);
    try {
      const res = await eventService.getRegistrations(eventId, {
        page: 1,
        limit: PAGE_SIZE,
        status: status || undefined,
        visibility: "active",
      });
      setItems(res.registrations ?? []);
      setPage(1);
      setPageCount(listPageCount(res.pagination));
      setLoadedKey(`${eventId}:${status}`);
    } catch (err) {
      const forbidden = getApiErrorStatus(err) === 403;
      setError(
        forbidden ? copy.roster.operatorForbidden : copy.roster.loadFailed,
      );
    } finally {
      setRefreshing(false);
    }
  }, [eventId, status]);

  const loadMore = useCallback(async () => {
    if (!eventId || loading || loadingMore || page >= pageCount) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await eventService.getRegistrations(eventId, {
        page: nextPage,
        limit: PAGE_SIZE,
        status: status || undefined,
        visibility: "active",
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
  }, [eventId, loading, loadingMore, page, pageCount, status]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = q ? items.filter((item) => matchesQuery(item, q)) : items;
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
  }, [items, query, sort]);

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
            </View>
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
          const copied = copiedId === item.id;
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
              <Pressable
                onPress={() => {
                  copyRegistrationCode(item.id, item.registrationCode);
                }}
                style={({ pressed }) => [
                  styles.codeRow,
                  copied && styles.codeRowCopied,
                  pressed && !copied && styles.codeRowPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  copied
                    ? copy.roster.codeCopied
                    : `${copy.roster.copyCode} ${item.registrationCode}`
                }
                hitSlop={6}
              >
                <Text
                  style={[styles.code, copied && styles.codeCopied]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={layout.maxFontScaleFixed}
                >
                  {item.registrationCode}
                </Text>
                <Icon
                  name={copied ? "clipboard-check" : "copy"}
                  size="sm"
                  color={
                    copied ? semantic.status.success.fg : semantic.icon.muted
                  }
                />
              </Pressable>
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
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: semantic.bg.canvas },
  emptyBody: { flex: 1, padding: spacing.screen, justifyContent: "center" },
  headerBlock: { gap: space[3], marginBottom: space[2] },
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
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: semantic.border.decorative,
    marginLeft: space[6],
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
});
