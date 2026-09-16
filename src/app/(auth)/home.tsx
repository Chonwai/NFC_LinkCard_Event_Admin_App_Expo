import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router } from 'expo-router';

import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { InlineBanner } from '@/components/ui/InlineBanner';
import { Logo } from '@/components/ui/Logo';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { copy } from '@/constants/copy.zh-TW';
import { layout, metaText, semantic, space, spacing, type } from '@/constants/theme';
import { useEventStore } from '@/stores/event.store';
import { EVENT_STATUS_LABEL, EVENT_STATUS_TONE } from '@/utils/event-status';

export default function HomeScreen() {
    const insets = useSafeAreaInsets();
    const { events, loading, error, loadEvents, dismissError } = useEventStore();
    const [refreshing, setRefreshing] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    /**
     * A1 決策 (b)：不在畫面 try/catch，也**不**在 store rethrow。
     *
     * store 的 `error` 是唯一來源；`loadEvents()` 開頭會 `set({ error: null })`，
     * 因此重試成功後橫幅會自動消失（不需要額外的清除邏輯）。
     */
    useEffect(() => {
        void loadEvents();
    }, [loadEvents, reloadKey]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadEvents();
        setRefreshing(false);
    }, [loadEvents]);

    const renderEvent = ({ item }: { item: (typeof events)[number] }) => {
        const tone = EVENT_STATUS_TONE[item.status] ?? 'neutral';
        // N2：用 `||` 而非 `??`——`item.status` 的型別是 `EventStatus | string`
        // （非 nullable），`??` 的第三段永遠不可達；改用 `||` 後空字串也會
        // 落到 `unknownStatus`，分支才真正可達。
        const label = EVENT_STATUS_LABEL[item.status] || item.status || copy.event.unknownStatus;
        const statusToken = semantic.status[tone];

        return (
            <Pressable
                onPress={() => {
                    router.push({
                        pathname: '/(auth)/[eventId]/overview',
                        params: { eventId: item.id },
                    });
                }}
                style={({ pressed }) => [styles.eventCard, pressed && styles.eventCardPressed]}
                accessibilityRole="button"
                accessibilityLabel={item.name}
            >
                <View style={styles.eventCardHeader}>
                    <Text style={type.h3} numberOfLines={1}>
                        {item.name}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusToken.bg }]}>
                        <Text style={[type.badge, { color: statusToken.fg }]}>{label}</Text>
                    </View>
                </View>

                <View style={styles.eventMeta}>
                    {item.userRole ? (
                        <View style={styles.metaItem}>
                            <Icon name="users" size={layout.icon.sm} color={semantic.text.muted} />
                            <Text style={[type.caption, metaText]}>
                                {item.userRole.replace(/_/g, ' ')}
                            </Text>
                        </View>
                    ) : null}
                    <View style={styles.metaItem}>
                        <Icon name="check-circle" size={layout.icon.sm} color={semantic.text.muted} />
                        <Text style={[type.caption, metaText]}>
                            {item.registrationCount ?? 0} {copy.event.registrations}
                        </Text>
                    </View>
                    <View style={styles.metaItem}>
                        <Icon name="users" size={layout.icon.sm} color={semantic.text.muted} />
                        <Text style={[type.caption, metaText]}>
                            {item.exhibitorCount ?? 0} {copy.event.exhibitors}
                        </Text>
                    </View>
                </View>
            </Pressable>
        );
    };

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            <View style={styles.brandRow}>
                <Logo size="md" />
                <View style={styles.brandText}>
                    <Text style={type.h2}>{copy.home.title}</Text>
                    <Text style={[type.caption, styles.tagline]}>{copy.app.tagline}</Text>
                </View>
            </View>

            <ScreenHeader title={copy.home.title} subtitle={copy.app.tagline} onRefresh={onRefresh} isRefreshing={refreshing} />

            {error != null ? (
                <View style={styles.bannerWrapper}>
                    <InlineBanner
                        tone="danger"
                        message={error}
                        dismissible
                        onDismiss={dismissError}
                        testID="home-error-banner"
                    />
                </View>
            ) : null}

            {loading && events.length === 0 ? (
                <View style={styles.skeletonWrapper}>
                    <Skeleton width="100%" height={96} radius={12} />
                    <Skeleton width="100%" height={96} radius={12} />
                    <Skeleton width="100%" height={96} radius={12} />
                </View>
            ) : events.length === 0 ? (
                <EmptyState
                    icon="empty-card"
                    title={copy.home.emptyTitle}
                    description={copy.home.emptyHint}
                    actionLabel={copy.home.retry}
                    onAction={() => {
                        setReloadKey(key => key + 1);
                    }}
                />
            ) : (
                <FlatList
                    data={events}
                    keyExtractor={item => item.id}
                    renderItem={renderEvent}
                    contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + spacing.safeFooter }]}
                    ItemSeparatorComponent={() => <View style={{ height: spacing.gap }} />}
                    onRefresh={onRefresh}
                    refreshing={refreshing}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: semantic.bg.canvas,
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.screen,
        paddingTop: spacing.card,
        gap: spacing.gap,
    },
    brandText: {
        flex: 1,
    },
    tagline: {
        color: semantic.text.muted,
        marginTop: 2,
    },
    bannerWrapper: {
        paddingHorizontal: spacing.screen,
        marginTop: spacing.gap,
    },
    skeletonWrapper: {
        paddingHorizontal: spacing.screen,
        marginTop: spacing.section,
        gap: spacing.gap,
    },
    listContent: {
        paddingHorizontal: spacing.screen,
        paddingTop: spacing.section,
    },
    eventCard: {
        backgroundColor: semantic.bg.surface,
        borderRadius: 12,
        padding: spacing.card,
        gap: space[3],
        borderWidth: 1,
        borderColor: semantic.border.decorative,
    },
    eventCardPressed: {
        backgroundColor: semantic.bg.pressedOnLight,
    },
    eventCardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: space[3],
    },
    eventMeta: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: space[4],
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[1],
    },
    statusBadge: {
        borderRadius: 999,
        paddingHorizontal: space[3],
        paddingVertical: space[1],
    },
});