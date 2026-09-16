import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router, useLocalSearchParams } from 'expo-router';

import { Card } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { InlineBanner, type InlineBannerTone } from '@/components/ui/InlineBanner';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { copy } from '@/constants/copy.zh-TW';
import { layout, semantic, space, spacing, type } from '@/constants/theme';
import { eventService } from '@/services/event.service';
import { useEventStore } from '@/stores/event.store';

interface StatItem {
    key: string;
    label: string;
    value: number;
    icon: IconName;
}

interface QuickAction {
    key: string;
    label: string;
    icon: IconName;
    route: string;
}

const QUICK_ACTIONS: QuickAction[] = [
    { key: 'check-in', label: copy.event.checkInTitle, icon: 'qr-code', route: 'check-in' },
    { key: 'nfc', label: copy.nfc.writeTitle, icon: 'nfc', route: 'nfc-bind' },
    { key: 'badges', label: copy.event.badgesTitle ?? 'Badge', icon: 'clipboard-check', route: 'badges' },
];

export default function EventOverviewScreen() {
    const insets = useSafeAreaInsets();
    const { eventId } = useLocalSearchParams<{ eventId: string }>();
    const { events } = useEventStore();
    const [loading, setLoading] = useState(true);
    const [banner, setBanner] = useState<{ tone: InlineBannerTone; message: string } | null>(null);
    const [stats, setStats] = useState<StatItem[]>([]);

    const event = events.find(e => e.id === eventId);

    useEffect(() => {
        let active = true;

        async function load() {
            if (!eventId) return;
            setLoading(true);
            setBanner(null);
            try {
                const [totalRes, checkedInRes] = await Promise.all([
                    eventService.getRegistrations(eventId, { limit: 1 }),
                    eventService.getRegistrations(eventId, { limit: 1, status: 'CHECKED_IN' }),
                ]);
                if (!active) return;
                setStats([
                    { key: 'registrations', label: copy.event.registrations, value: totalRes.pagination?.total ?? 0, icon: 'users' },
                    { key: 'checkedIn', label: copy.event.checkedIn, value: checkedInRes.pagination?.total ?? 0, icon: 'check-circle' },
                    { key: 'exhibitors', label: copy.event.exhibitors, value: event?.exhibitorCount ?? 0, icon: 'archive' },
                ]);
            } catch {
                if (!active) return;
                setBanner({ tone: 'danger', message: copy.home.loadFailed });
            } finally {
                if (active) setLoading(false);
            }
        }

        void load();

        return () => {
            active = false;
        };
    }, [eventId, event?.exhibitorCount]);

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            <ScreenHeader
                title={event?.name ?? copy.event.overviewTitle}
                subtitle={event?.status ?? ''}
                leading="back"
                backFallbackPath="/(auth)/home"
            />

            <ScrollView
                contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.safeFooter }]}
            >
                {banner ? <InlineBanner tone={banner.tone} message={banner.message} /> : null}

                {loading ? (
                    <View style={styles.statGrid}>
                        <Skeleton width="48%" height={96} radius={12} />
                        <Skeleton width="48%" height={96} radius={12} />
                        <Skeleton width="48%" height={96} radius={12} />
                    </View>
                ) : (
                    <View style={styles.statGrid}>
                        {stats.map(s => (
                            <Card key={s.key} style={styles.statCard}>
                                <Icon name={s.icon} size="lg" color={semantic.icon.brand} />
                                <Text style={type.h1}>{s.value}</Text>
                                <Text style={[type.caption, styles.statLabel]}>{s.label}</Text>
                            </Card>
                        ))}
                    </View>
                )}

                {/* A6/A8：原為 `copy.event.quickActions ?? '快速操作'`，硬編中文 fallback 已移除 */}
                <Text style={[type.h3, styles.sectionTitle]}>{copy.event.quickActions}</Text>
                <View style={styles.actionGrid}>
                    {QUICK_ACTIONS.map(a => (
                        <Pressable
                            key={a.key}
                            onPress={() => {
                                router.push({
                                    pathname: `/(auth)/[eventId]/${a.route}` as never,
                                    params: { eventId: eventId ?? '' },
                                });
                            }}
                            style={({ pressed }) => [styles.actionCard, pressed && styles.actionPressed]}
                            accessibilityRole="button"
                            accessibilityLabel={a.label}
                        >
                            <Icon name={a.icon} size="lg" color={semantic.icon.brand} />
                            <Text style={[type.label, styles.actionLabel]}>{a.label}</Text>
                        </Pressable>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: semantic.bg.canvas,
    },
    content: {
        paddingHorizontal: spacing.screen,
        paddingTop: spacing.section,
        gap: spacing.section,
    },
    statGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.gap,
    },
    statCard: {
        width: '48%',
        alignItems: 'center',
        gap: space[2],
    },
    statLabel: {
        color: semantic.text.muted,
    },
    sectionTitle: {
        marginTop: spacing.gap,
    },
    actionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.gap,
    },
    actionCard: {
        width: '31%',
        minHeight: layout.touchMin * 2,
        backgroundColor: semantic.bg.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: semantic.border.decorative,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space[2],
        padding: spacing.card,
    },
    actionPressed: {
        backgroundColor: semantic.bg.pressedOnLight,
    },
    actionLabel: {
        textAlign: 'center',
    },
});