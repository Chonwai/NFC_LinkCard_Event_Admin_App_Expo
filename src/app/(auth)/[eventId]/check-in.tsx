import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraView } from 'expo-camera';
import { useLocalSearchParams } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { copy } from '@/constants/copy.zh-TW';
import { layout, radius, semantic, space, spacing, type } from '@/constants/theme';
import { registrationService } from '@/services/registration.service';
import type { CheckInResult, Registration } from '@/types/api.types';
import { getApiErrorCode, getApiErrorMessage } from '@/utils/api-error';

type CheckInState =
    | { phase: 'idle' }
    | { phase: 'loading' }
    | { phase: 'result'; ok: true; message: string; code: string; result: CheckInResult }
    | { phase: 'result'; ok: false; message: string; code: string };

const ERROR_MESSAGES: Record<string, string> = {
    ALREADY_CHECKED_IN: copy.checkIn.alreadyCheckedIn,
    REGISTRATION_NOT_CONFIRMED: copy.checkIn.notConfirmed,
    REGISTRATION_NOT_FOUND: copy.checkIn.registrationNotFound,
    INSUFFICIENT_PERMISSION: copy.checkIn.notEnoughPermission,
};

/**
 * ⚠️ **D-2 契約漂移（本輪不修，屬 W-01）**
 *
 * 契約文件與 `Registration` 型別以 `profile.{fullName,email,company}` 描述報名者
 * 資料，但後端 `EventRegistrationService.checkIn()` 的 `select` 實際回傳**扁平欄位**
 * （`firstName` / `lastName` / `email` / `company` / `registrantType`），且
 * `checkedInAt` **位於 registration 內層**，不在 `CheckInResult` 頂層。
 *
 * 本輪**不動** `api.types.ts` 的型別結構（W-01 負責），只在畫面邊界讀取實存欄位
 * 並收斂成 `CheckInResult`。W-01 修完 D-2 後，本段的 `??` 分支即可移除。
 */
type CheckInWireRegistration = Registration & {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    company?: string | null;
    registrantType?: string | null;
    checkedInAt?: string | null;
};

/** 無值時顯示的佔位符（不是文案，不進 copy 層） */
const EMPTY_VALUE = '—';

/** 取第一個非空字串（後端扁平欄位優先，其次契約型別的 `profile.*`） */
function firstNonEmpty(...candidates: (string | null | undefined)[]): string {
    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim() !== '') {
            return candidate.trim();
        }
    }
    return '';
}

/** 報到時間（本地 `HH:mm`）；無法解析時回退空字串 */
function formatCheckedInAt(iso: string): string {
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return '';
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/** 單列「標籤 — 值」 */
function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.detailRow}>
            <Text style={[type.caption, styles.detailLabel]}>{label}</Text>
            <Text style={[type.label, styles.detailValue]} numberOfLines={1}>
                {value === '' ? EMPTY_VALUE : value}
            </Text>
        </View>
    );
}

/**
 * 報到結果卡的身分確認區（A3）。
 *
 * 現場報到必須能當面核對身分，因此固定渲染 5 列（姓名 / Email / 公司 / 類型 /
 * 報到時間），缺值以 `—` 佔位而不是隱藏整列——列數固定才能一眼看出「哪一欄沒填」。
 */
function CheckInAttendeeBlock({ result }: { result: CheckInResult }) {
    const registration = result.registration as CheckInWireRegistration;
    const fullName = firstNonEmpty(
        [registration.firstName, registration.lastName].filter(Boolean).join(' '),
        result.registration.profile?.fullName
    );

    return (
        <View style={styles.detailBlock}>
            <Text style={[type.caption, styles.detailTitle]}>{copy.checkIn.resultTitle}</Text>
            <DetailRow label={copy.checkIn.attendeeName} value={fullName} />
            <DetailRow
                label={copy.checkIn.attendeeEmail}
                value={firstNonEmpty(registration.email, result.registration.profile?.email)}
            />
            <DetailRow
                label={copy.checkIn.attendeeCompany}
                value={firstNonEmpty(registration.company, result.registration.profile?.company)}
            />
            <DetailRow
                label={copy.checkIn.attendeeType}
                value={firstNonEmpty(registration.registrantType)}
            />
            <DetailRow
                label={copy.checkIn.checkedInAt}
                value={formatCheckedInAt(result.checkedInAt)}
            />
        </View>
    );
}

export default function CheckInScreen() {
    const insets = useSafeAreaInsets();
    const { eventId } = useLocalSearchParams<{ eventId: string }>();
    const [mode, setMode] = useState<'scan' | 'manual'>('scan');
    const [scanning, setScanning] = useState(true);
    const [manualCode, setManualCode] = useState('');
    const [state, setState] = useState<CheckInState>({ phase: 'idle' });
    const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [cameraError, setCameraError] = useState(false);

    const clearResetTimer = () => {
        if (resetTimer.current) {
            clearTimeout(resetTimer.current);
            resetTimer.current = null;
        }
    };

    const doCheckIn = useCallback(
        async (code: string) => {
            if (!eventId || !code.trim()) return;
            setState({ phase: 'loading' });
            setScanning(false);
            clearResetTimer();

            try {
                // A3：接住回傳值——`{ registration }` 內含姓名/公司/類型與 checkedInAt，
                // 收斂成 `CheckInResult` 供結果卡使用（D-2 漂移見上方型別註解）。
                const { registration } = await registrationService.checkIn(eventId, code.trim());
                const wire = registration as CheckInWireRegistration;
                const result: CheckInResult = {
                    registration,
                    /** 後端把 `checkedInAt` 放在 registration 內層（非 CheckInResult 頂層） */
                    checkedInAt: firstNonEmpty(wire.checkedInAt),
                };
                setState({
                    phase: 'result',
                    ok: true,
                    message: copy.checkIn.checkedIn,
                    code: code.trim(),
                    result,
                });
            } catch (err) {
                const codeKey = getApiErrorCode(err);
                const message =
                    (codeKey != null && ERROR_MESSAGES[codeKey]) ||
                    getApiErrorMessage(err, copy.checkIn.registrationNotFound);
                setState({ phase: 'result', ok: false, message, code: code.trim() });
            }

            // 3s auto-reset（現場快速連續操作）
            resetTimer.current = setTimeout(() => {
                setState({ phase: 'idle' });
                setScanning(true);
            }, 3000);
        },
        [eventId]
    );

    useEffect(() => clearResetTimer, []);

    const onBarcodeScanned = useCallback(
        (data: { data: string }) => {
            if (state.phase !== 'idle') return; // 已處理中忽略重複掃描
            void doCheckIn(data.data);
        },
        [state.phase, doCheckIn]
    );

    return (
        <KeyboardAvoidingView
            style={[styles.screen, { paddingTop: insets.top }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScreenHeader title={copy.event.checkInTitle} leading="back" backFallbackPath="/(auth)/home" />

            {/* 模式切換 */}
            <View style={styles.modeSwitch}>
                <Pressable
                    onPress={() => {
                        setMode('scan');
                        setState({ phase: 'idle' });
                        setScanning(true);
                    }}
                    style={[styles.modeTab, mode === 'scan' && styles.modeTabActive]}
                >
                    <Icon name="qr-code" size="sm" color={mode === 'scan' ? semantic.icon.brand : semantic.icon.muted} />
                    <Text style={[type.label, { color: mode === 'scan' ? semantic.text.primary : semantic.text.muted }]}>
                        {copy.checkIn.scanMode}
                    </Text>
                </Pressable>
                <Pressable
                    onPress={() => {
                        setMode('manual');
                        setState({ phase: 'idle' });
                        setScanning(false);
                    }}
                    style={[styles.modeTab, mode === 'manual' && styles.modeTabActive]}
                >
                    <Icon name="pencil" size="sm" color={mode === 'manual' ? semantic.icon.brand : semantic.icon.muted} />
                    <Text style={[type.label, { color: mode === 'manual' ? semantic.text.primary : semantic.text.muted }]}>
                        {copy.checkIn.manualMode}
                    </Text>
                </Pressable>
            </View>

            <View style={styles.body}>
                {mode === 'scan' && state.phase === 'idle' ? (
                    <View style={styles.cameraContainer}>
                        {cameraError ? (
                            <View style={styles.cameraFallback}>
                                <Icon name="camera" size="xl" color={semantic.icon.muted} />
                                <Text style={[type.body, styles.cameraFallbackText]}>
                                    {copy.checkIn.cameraUnavailable}
                                </Text>
                                <Button
                                    label={copy.checkIn.switchToManual}
                                    variant="secondary"
                                    onPress={() => setMode('manual')}
                                />
                            </View>
                        ) : (
                            <CameraView
                                style={styles.camera}
                                facing="back"
                                onBarcodeScanned={scanning ? onBarcodeScanned : undefined}
                                onMountError={() => setCameraError(true)}
                            />
                        )}
                        <Text style={[type.caption, styles.scanHint]}>{copy.checkIn.scanHint}</Text>
                    </View>
                ) : null}

                {mode === 'manual' && state.phase === 'idle' ? (
                    <View style={styles.manualBox}>
                        <TextInput
                            value={manualCode}
                            onChangeText={setManualCode}
                            placeholder={copy.checkIn.codePlaceholder}
                            placeholderTextColor={semantic.text.muted}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            style={styles.input}
                            accessibilityLabel={copy.checkIn.codePlaceholder}
                        />
                        <Button
                            label={copy.checkIn.submit}
                            onPress={() => void doCheckIn(manualCode)}
                            loading={false}
                            disabled={!manualCode.trim()}
                        />
                    </View>
                ) : null}

                {state.phase === 'loading' ? (
                    <View style={styles.centerBox}>
                        <ActivityIndicator size="large" color={semantic.icon.brand} />
                        <Text style={[type.body, styles.loadingText]}>{copy.checkIn.checking}</Text>
                    </View>
                ) : null}

                {state.phase === 'result' ? (
                    <View style={[styles.resultCard, state.ok ? styles.resultOk : styles.resultFail]}>
                        <Icon
                            name={state.ok ? 'check-circle' : 'x-circle'}
                            size="xl"
                            color={state.ok ? semantic.status.success.fg : semantic.status.danger.fg}
                        />
                        <Text style={[type.h3, styles.resultTitle]}>{state.message}</Text>
                        <Text style={[type.mono, styles.resultCode]}>{state.code}</Text>
                        {state.ok ? <CheckInAttendeeBlock result={state.result} /> : null}
                        <Text style={[type.caption, styles.resetHint]}>
                            {copy.checkIn.autoResetIn}…
                        </Text>
                    </View>
                ) : null}
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: semantic.bg.canvas },
    modeSwitch: {
        flexDirection: 'row',
        gap: spacing.gap,
        paddingHorizontal: spacing.screen,
        marginTop: spacing.gap,
    },
    modeTab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[2],
        paddingHorizontal: space[4],
        paddingVertical: space[2],
        borderRadius: radius.full,
        backgroundColor: semantic.bg.surface,
        borderWidth: 1,
        borderColor: semantic.border.decorative,
    },
    modeTabActive: {
        backgroundColor: semantic.bg.brandSoft,
        borderColor: semantic.border.interactiveSelected,
    },
    body: { flex: 1, padding: spacing.screen, gap: spacing.section },
    cameraContainer: { flex: 1, gap: spacing.gap },
    camera: { flex: 1, borderRadius: 16, overflow: 'hidden' },
    cameraFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.gap },
    cameraFallbackText: { color: semantic.text.muted, textAlign: 'center' },
    scanHint: { color: semantic.text.muted, textAlign: 'center' },
    manualBox: { gap: spacing.gap, justifyContent: 'center', flex: 1 },
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
    centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.gap },
    loadingText: { color: semantic.text.muted },
    resultCard: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.gap,
        borderRadius: 16,
        padding: spacing.group,
        borderWidth: 1,
    },
    resultOk: {
        backgroundColor: semantic.status.success.bg,
        borderColor: semantic.status.success.border,
    },
    detailBlock: {
        alignSelf: 'stretch',
        backgroundColor: semantic.bg.surface,
        borderRadius: radius.md,
        padding: spacing.card,
        gap: space[2],
        borderWidth: 1,
        borderColor: semantic.border.decorative,
    },
    detailTitle: { color: semantic.text.muted },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.gap,
    },
    detailLabel: { color: semantic.text.muted },
    detailValue: { color: semantic.text.primary, flexShrink: 1 },
    resultFail: {
        backgroundColor: semantic.status.danger.bg,
        borderColor: semantic.status.danger.border,
    },
    resultTitle: { textAlign: 'center' },
    resultCode: { color: semantic.text.secondary },
    resetHint: { color: semantic.text.muted },
});