import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocalSearchParams, router } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { InlineBanner, type InlineBannerTone } from '@/components/ui/InlineBanner';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { copy } from '@/constants/copy.zh-TW';
import { WEB_BASE_URL } from '@/constants/config';
import { layout, radius, semantic, space, spacing, type } from '@/constants/theme';
import { nfcService } from '@/services/nfc.service';
import { registrationService } from '@/services/registration.service';
import { isNfcSupported, normalizeTagUid, startNfc, writeUriToCard } from '@/utils/nfc-utils';

type BadgeType = 'WRISTBAND' | 'CARD' | 'QR_ONLY';

type FlowState =
    | { phase: 'lookup' }
    | { phase: 'lookup-loading' }
    | { phase: 'confirm'; registrationId: string; code: string }
    | { phase: 'writing' }
    | { phase: 'done'; ok: boolean; message: string };

const BADGE_TYPES: { key: BadgeType; label: string; icon: IconName }[] = [
    { key: 'WRISTBAND', label: copy.nfc.badgeTypeWristband, icon: 'check' },
    { key: 'CARD', label: copy.nfc.badgeTypeCard, icon: 'check' },
    { key: 'QR_ONLY', label: 'QR', icon: 'qr-code' },
];

export default function NfcBindScreen() {
    const insets = useSafeAreaInsets();
    const { eventId } = useLocalSearchParams<{ eventId: string }>();
    const [code, setCode] = useState('');
    const [badgeType, setBadgeType] = useState<BadgeType>('WRISTBAND');
    const [state, setState] = useState<FlowState>({ phase: 'lookup' });
    const [banner, setBanner] = useState<{ tone: InlineBannerTone; message: string } | null>(null);

    const lookup = useCallback(async () => {
        if (!eventId || !code.trim()) return;
        setState({ phase: 'lookup-loading' });
        setBanner(null);
        try {
            const { registration } = await registrationService.getByCode(eventId, code.trim());
            const registrationId = (registration as { id?: string }).id;
            if (!registrationId) {
                setBanner({ tone: 'danger', message: copy.nfc.bindFailed });
                setState({ phase: 'lookup' });
                return;
            }
            setState({ phase: 'confirm', registrationId, code: code.trim() });
        } catch {
            setBanner({ tone: 'danger', message: copy.checkIn.registrationNotFound });
            setState({ phase: 'lookup' });
        }
    }, [eventId, code]);

    const writeAndBind = useCallback(async () => {
        if (!eventId || state.phase !== 'confirm') return;

        // iOS 不支援實體寫卡（資訊層提示），主要使用裝置為 Android
        if (Platform.OS === 'ios') {
            Alert.alert(copy.nfc.iosWriteNotSupported);
            return;
        }

        setState({ phase: 'writing' });
        setBanner(null);
        try {
            const supported = await isNfcSupported();
            if (!supported) {
                setBanner({ tone: 'warning', message: copy.settings.nfcNotSupported });
                setState({ phase: 'confirm', registrationId: state.registrationId, code: state.code });
                return;
            }
            await startNfc();

            const payloadUrl = `${WEB_BASE_URL}/u/${state.registrationId}`;
            const { tagUid } = await writeUriToCard(payloadUrl);

            if (!tagUid) {
                setBanner({ tone: 'danger', message: copy.nfc.bindFailed });
                setState({ phase: 'confirm', registrationId: state.registrationId, code: state.code });
                return;
            }

            // 綁定 badge ↔ registration（OPERATOR+）
            await nfcService.bind(eventId, state.registrationId, normalizeTagUid(tagUid), {
                badgeType,
            });

            setState({ phase: 'done', ok: true, message: copy.nfc.bindSuccess });
        } catch {
            setBanner({ tone: 'danger', message: copy.nfc.bindFailed });
            setState({ phase: 'confirm', registrationId: state.registrationId, code: state.code });
        }
    }, [eventId, state, badgeType]);

    const reset = useCallback(() => {
        setCode('');
        setBanner(null);
        setState({ phase: 'lookup' });
    }, []);

    /**
     * W-12：路由參數缺失（`undefined` / 空字串）＝無法解析的活動。
     *
     * `lookup()` 與 `writeAndBind()` 原本對空 `eventId` 直接 return，使用者按下
     * 「查詢」、「開始寫入」皆無反應（無錯誤、無進度），是死路。
     */
    const hasEventId = typeof eventId === 'string' && eventId.trim() !== '';

    if (!hasEventId) {
        return (
            <View style={[styles.screen, { paddingTop: insets.top }]}>
                <ScreenHeader
                    title={copy.nfc.writeTitle}
                    leading="back"
                    backFallbackPath="/(auth)/home"
                />
                <View style={styles.emptyBody}>
                    <EmptyState
                        kind="no-results"
                        headingLevel={2}
                        title={copy.event.unavailableTitle}
                        description={copy.event.unavailableHint}
                        actionLabel={copy.settings.backToEvents}
                        onAction={() => router.replace('/(auth)/home')}
                        testID="nfc-bind-empty"
                    />
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            <ScreenHeader title={copy.nfc.writeTitle} leading="back" backFallbackPath="/(auth)/home" />

            <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.safeFooter }]}>
                {banner ? <InlineBanner tone={banner.tone} message={banner.message} /> : null}

                {state.phase === 'lookup' || state.phase === 'lookup-loading' ? (
                    <>
                        <Text style={[type.caption, styles.stepHint]}>
                            {copy.nfc.stepLookupHint}
                        </Text>
                        <TextInput
                            value={code}
                            onChangeText={setCode}
                            placeholder={copy.checkIn.codePlaceholder}
                            placeholderTextColor={semantic.text.muted}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            style={styles.input}
                            accessibilityLabel={copy.checkIn.codePlaceholder}
                        />
                        <Button
                            label={copy.checkIn.submit}
                            onPress={() => void lookup()}
                            loading={state.phase === 'lookup-loading'}
                            disabled={!code.trim()}
                        />
                    </>
                ) : null}

                {state.phase === 'confirm' ? (
                    <>
                        <Text style={[type.caption, styles.stepHint]}>
                            {copy.nfc.stepChooseTypeHint}
                        </Text>
                        <View style={styles.badgeTypeRow}>
                            {BADGE_TYPES.map(b => (
                                <Pressable
                                    key={b.key}
                                    onPress={() => setBadgeType(b.key)}
                                    style={[styles.badgeType, badgeType === b.key && styles.badgeTypeActive]}
                                    accessibilityRole="button"
                                    accessibilityLabel={b.label}
                                >
                                    <Icon
                                        name={b.icon}
                                        size="sm"
                                        color={badgeType === b.key ? semantic.icon.brand : semantic.icon.muted}
                                    />
                                    <Text
                                        style={[
                                            type.label,
                                            { color: badgeType === b.key ? semantic.text.primary : semantic.text.muted },
                                        ]}
                                    >
                                        {b.label}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                        <Button label={copy.nfc.startWrite} onPress={() => void writeAndBind()} />
                        <Button label={copy.nfc.retype} variant="ghost" onPress={reset} />
                    </>
                ) : null}

                {state.phase === 'writing' ? (
                    <View style={styles.centerBox}>
                        <ActivityIndicator size="large" color={semantic.icon.brand} />
                        <Text style={[type.body, styles.loadingText]}>{copy.nfc.writing}</Text>
                    </View>
                ) : null}

                {state.phase === 'done' ? (
                    <View style={[styles.doneCard, state.ok ? styles.doneOk : styles.doneFail]}>
                        <Icon
                            name={state.ok ? 'check-circle' : 'x-circle'}
                            size="xl"
                            color={state.ok ? semantic.status.success.fg : semantic.status.danger.fg}
                        />
                        <Text style={[type.h3, styles.doneTitle]}>{state.message}</Text>
                        <Button label={copy.nfc.continueNext} onPress={reset} />
                        <Button
                            label={copy.settings.backToEvents}
                            variant="ghost"
                            onPress={() => router.back()}
                        />
                    </View>
                ) : null}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: semantic.bg.canvas },
    body: { padding: spacing.screen, gap: spacing.section },
    /** W-12：空態置中（與其他頁面 emptyBody 同一定義） */
    emptyBody: {
        flex: 1,
        justifyContent: 'center',
        padding: spacing.screen,
    },
    stepHint: { color: semantic.text.muted },
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
    badgeTypeRow: {
        flexDirection: 'row',
        gap: spacing.gap,
    },
    badgeType: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space[2],
        paddingVertical: space[3],
        borderRadius: radius.md,
        backgroundColor: semantic.bg.surface,
        borderWidth: 1,
        borderColor: semantic.border.decorative,
    },
    badgeTypeActive: {
        backgroundColor: semantic.bg.brandSoft,
        borderColor: semantic.border.interactiveSelected,
    },
    centerBox: { alignItems: 'center', gap: spacing.gap, paddingVertical: spacing.group },
    loadingText: { color: semantic.text.muted },
    doneCard: {
        alignItems: 'center',
        gap: spacing.gap,
        borderRadius: 16,
        padding: spacing.group,
        borderWidth: 1,
    },
    doneOk: {
        backgroundColor: semantic.status.success.bg,
        borderColor: semantic.status.success.border,
    },
    doneFail: {
        backgroundColor: semantic.status.danger.bg,
        borderColor: semantic.status.danger.border,
    },
    doneTitle: { textAlign: 'center' },
});