import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocalSearchParams } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineBanner, type InlineBannerTone } from '@/components/ui/InlineBanner';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { copy } from '@/constants/copy.zh-TW';
import { layout, metaText, radius, semantic, space, spacing, type } from '@/constants/theme';
import { nfcService } from '@/services/nfc.service';
import type { BadgeInfo, BadgeStatus } from '@/types/api.types';

interface BadgeListItem {
    id: string;
    tagUid: string;
    badgeType: string;
    status: BadgeStatus;
    registrationId: string | null;
    boundAt: string | null;
    batchLabel?: string | null;
}

/** Badge 狀態 → 顯示文字（文案集中在 `copy.badgeStatus`） */
const STATUS_LABELS: Record<string, string> = {
    UNASSIGNED: copy.badgeStatus.unassigned,
    BOUND: copy.badgeStatus.bound,
    ACTIVE: copy.badgeStatus.active,
    DEACTIVATED: copy.badgeStatus.deactivated,
    LOST: copy.badgeStatus.lost,
};

const STATUS_TONE: Record<string, keyof typeof semantic.status> = {
    UNASSIGNED: 'pending',
    BOUND: 'success',
    ACTIVE: 'available',
    DEACTIVATED: 'warning',
    LOST: 'danger',
};

export default function BadgesScreen() {
    const insets = useSafeAreaInsets();
    const { eventId } = useLocalSearchParams<{ eventId: string }>();
    const [lookupUid, setLookupUid] = useState('');
    const [lookupResult, setLookupResult] = useState<BadgeInfo | null>(null);
    const [lookupLoading, setLookupLoading] = useState(false);
    const [banner, setBanner] = useState<{ tone: InlineBannerTone; message: string } | null>(null);

    const [badges, setBadges] = useState<BadgeListItem[]>([]);
    const [listLoading, setListLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const PAGE_SIZE = 20;

    const loadList = useCallback(
        async (nextPage: number, replace = false) => {
            if (!eventId) return;
            setListLoading(true);
            setBanner(null);
            try {
                const { badges: list, pagination } = await nfcService.listBadges(eventId, {
                    page: nextPage,
                    pageSize: PAGE_SIZE,
                });
                const items = (list ?? []) as unknown as BadgeListItem[];
                setBadges(prev => (replace ? items : [...prev, ...items]));
                const total = pagination?.total ?? 0;
                setHasMore(nextPage * PAGE_SIZE < total);
                setPage(nextPage);
            } catch {
                setBanner({ tone: 'danger', message: copy.home.loadFailed });
            } finally {
                setListLoading(false);
            }
        },
        [eventId]
    );

    useEffect(() => {
        let active = true;

        async function initial() {
            if (!eventId) return;
            setListLoading(true);
            setBanner(null);
            try {
                const { badges: list, pagination } = await nfcService.listBadges(eventId, {
                    page: 1,
                    pageSize: PAGE_SIZE,
                });
                if (!active) return;
                const items = (list ?? []) as unknown as BadgeListItem[];
                setBadges(items);
                const total = pagination?.total ?? 0;
                setHasMore(1 * PAGE_SIZE < total);
                setPage(1);
            } catch {
                if (!active) return;
                setBanner({ tone: 'danger', message: copy.home.loadFailed });
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
        setLookupLoading(true);
        setBanner(null);
        setLookupResult(null);
        try {
            const { badge } = await nfcService.lookup(eventId, { uid: lookupUid.trim() });
            if (badge) {
                setLookupResult(badge);
            } else {
                setBanner({ tone: 'warning', message: copy.badges.lookupNotFound });
            }
        } catch {
            setBanner({ tone: 'danger', message: copy.badges.lookupFailed });
        } finally {
            setLookupLoading(false);
        }
    }, [eventId, lookupUid]);

    const renderBadge = ({ item }: { item: BadgeListItem }) => {
        const tone = STATUS_TONE[item.status] ?? 'neutral';
        const statusToken = semantic.status[tone];
        return (
            <View style={styles.badgeRow}>
                <View style={styles.badgeRowLeft}>
                    <Text style={type.monoSm} numberOfLines={1}>
                        {item.tagUid}
                    </Text>
                    <Text style={[type.caption, metaText]}>
                        {item.badgeType}
                        {item.batchLabel ? ` · ${item.batchLabel}` : ''}
                    </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: statusToken.bg }]}>
                    <Text style={[type.badge, { color: statusToken.fg }]}>
                        {STATUS_LABELS[item.status] ?? item.status}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            <ScreenHeader title={copy.event.badgesTitle} leading="back" backFallbackPath="/(auth)/home" />

            <View style={styles.body}>
                {banner ? <InlineBanner tone={banner.tone} message={banner.message} /> : null}

                {/* 查詢區 */}
                <View style={styles.lookupBox}>
                    <Text style={[type.caption, styles.lookupHint]}>{copy.badges.lookupHint}</Text>
                    <TextInput
                        value={lookupUid}
                        onChangeText={setLookupUid}
                        placeholder="tagUid"
                        placeholderTextColor={semantic.text.muted}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        style={styles.input}
                    />
                    <Button
                        label={copy.badges.lookupButton}
                        onPress={() => void doLookup()}
                        loading={lookupLoading}
                        disabled={!lookupUid.trim()}
                    />
                    {lookupResult ? (
                        <View style={styles.lookupResult}>
                            <Text style={type.monoSm}>{lookupResult.tagUid}</Text>
                            <View
                                style={[
                                    styles.statusPill,
                                    { backgroundColor: semantic.status[STATUS_TONE[lookupResult.status] ?? 'neutral'].bg },
                                ]}
                            >
                                <Text style={[type.badge, { color: semantic.status[STATUS_TONE[lookupResult.status] ?? 'neutral'].fg }]}>
                                    {STATUS_LABELS[lookupResult.status] ?? lookupResult.status}
                                </Text>
                            </View>
                            {lookupResult.registrationId ? (
                                <Text style={[type.caption, metaText]}>
                                    {copy.badges.boundRegistration}
                                    {lookupResult.registrationId.slice(0, 8)}…
                                </Text>
                            ) : null}
                        </View>
                    ) : null}
                </View>

                {/* 列表區 */}
                {listLoading && badges.length === 0 ? (
                    <View style={styles.skeletonList}>
                        <Skeleton width="100%" height={56} radius={8} />
                        <Skeleton width="100%" height={56} radius={8} />
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
                        keyExtractor={item => item.id}
                        renderItem={renderBadge}
                        contentContainerStyle={{ paddingBottom: spacing.safeFooter }}
                        ItemSeparatorComponent={() => <View style={{ height: space[2] }} />}
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
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: semantic.bg.canvas },
    body: { flex: 1, padding: spacing.screen, gap: spacing.section },
    lookupBox: { gap: spacing.gap },
    lookupHint: { color: semantic.text.muted },
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
    lookupResult: {
        backgroundColor: semantic.bg.surface,
        borderRadius: radius.md,
        padding: spacing.card,
        gap: space[2],
        borderWidth: 1,
        borderColor: semantic.border.decorative,
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: semantic.bg.surface,
        borderRadius: radius.md,
        padding: spacing.card,
        borderWidth: 1,
        borderColor: semantic.border.decorative,
    },
    badgeRowLeft: { flex: 1, gap: space[1] },
    statusPill: {
        borderRadius: radius.full,
        paddingHorizontal: space[3],
        paddingVertical: space[1],
    },
    skeletonList: { gap: space[2] },
    footerLoading: { paddingVertical: spacing.gap },
});