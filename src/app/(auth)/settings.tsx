import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { InlineBanner } from '@/components/ui/InlineBanner';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { copy } from '@/constants/copy.zh-TW';
import { radius, semantic, spacing, type } from '@/constants/theme';
import { useAuthStore } from '@/stores/auth.store';
import { isNfcSupported } from '@/utils/nfc-utils';

/**
 * NFC 能力探測狀態。
 *
 * `'checking'` 是**必要的暫時態**，不是裝飾：`isNfcSupported()` 在原生為非同步
 * 查詢、在 web 直接回 `false`。少了這一態，web 首幀會先顯示「不支援」再跳成
 * 「支援」，屬欺騙性畫面。
 */
type NfcProbe = 'checking' | 'supported' | 'unsupported';

const NFC_PROBE_LABEL: Record<NfcProbe, string> = {
    checking: copy.settings.nfcChecking,
    supported: copy.settings.nfcSupported,
    unsupported: copy.settings.nfcNotSupported,
};

/**
 * 設定頁（W-12）
 *
 * 狀態覆蓋：
 * - **loading**：`!isHydrated` → `Skeleton`（凍結規則：載入一律用 Skeleton，
 *   不得用 EmptyState）
 * - **error**：`isHydrated && user == null` → `hydrate()` 的非終止性失敗態
 *   （`auth.store` 刻意保留 token 讓使用者可重試），附「重新載入」復原入口
 * - **success**：帳號資訊 + NFC 能力 + 登出
 * - **confirm**：登出二次確認（行內兩段式，見下）
 *
 * ⚠️ 本頁**無空態**：設定頁的內容是帳號資訊，不存在「查無資料但操作正常」的
 * 情境——`user == null` 一律歸類為 error（可重試），不是 empty。
 *
 * 登出確認不用 `Alert.alert`：React Native Web 上它是 no-op，會讓 **web 的登出
 * 完全失效**（使用者按了沒反應＝死路）。改為行內兩段式，跨平台一致。
 */
export default function SettingsScreen() {
    const insets = useSafeAreaInsets();
    const { logout, user, isHydrated, hydrate } = useAuthStore();
    const [nfcProbe, setNfcProbe] = useState<NfcProbe>('checking');
    const [confirmingLogout, setConfirmingLogout] = useState(false);

    useEffect(() => {
        let active = true;

        async function probe() {
            /** `isNfcSupported()` 內部已吞掉所有例外，恆回 boolean，不會 reject */
            const supported = await isNfcSupported();
            if (active) setNfcProbe(supported ? 'supported' : 'unsupported');
        }

        void probe();

        return () => {
            active = false;
        };
    }, []);

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            <ScreenHeader title={copy.settings.title} />
            <View style={styles.body}>
                {!isHydrated ? (
                    /** Skeleton 只能作為內容的兄弟節點，不可包在可點擊項內 */
                    <View style={styles.group} testID="settings-loading">
                        <Skeleton width="60%" height={20} />
                        <Skeleton width="40%" height={16} />
                        <Skeleton width="100%" height={48} radius={12} />
                    </View>
                ) : user == null ? (
                    /** 錯誤一律走 InlineBanner（專案既有慣例，見 index.tsx） */
                    <View style={styles.group} testID="settings-account-error">
                        <InlineBanner tone="danger" message={copy.settings.accountUnavailable} />
                        <Button
                            label={copy.settings.accountRetry}
                            variant="secondary"
                            onPress={() => {
                                void hydrate();
                            }}
                        />
                    </View>
                ) : (
                    <>
                        {user.email ? (
                            <Text style={[type.caption, styles.email]}>{user.email}</Text>
                        ) : null}

                        <View style={styles.row} testID="settings-nfc-status">
                            <Text style={[type.body, styles.rowLabel]}>
                                {copy.settings.nfcStatus}
                            </Text>
                            <Text style={[type.label, styles.rowValue]}>
                                {NFC_PROBE_LABEL[nfcProbe]}
                            </Text>
                        </View>

                        <Text style={[type.caption, styles.version]}>
                            {copy.app.name} · {copy.app.version}
                        </Text>

                        {confirmingLogout ? (
                            <View style={styles.confirmGroup} testID="settings-logout-confirm">
                                <Text style={[type.label, styles.confirmTitle]}>
                                    {copy.settings.logoutConfirmTitle}
                                </Text>
                                <Text style={[type.caption, styles.confirmHint]}>
                                    {copy.settings.logoutConfirmHint}
                                </Text>
                                <Button
                                    label={copy.settings.logoutConfirm}
                                    variant="danger"
                                    testID="settings-logout-confirm-submit"
                                    onPress={() => {
                                        void logout();
                                    }}
                                />
                                <Button
                                    label={copy.settings.logoutCancel}
                                    variant="ghost"
                                    testID="settings-logout-cancel"
                                    onPress={() => {
                                        setConfirmingLogout(false);
                                    }}
                                />
                            </View>
                        ) : (
                            <Button
                                label={copy.settings.logout}
                                variant="danger"
                                testID="settings-logout"
                                onPress={() => {
                                    setConfirmingLogout(true);
                                }}
                            />
                        )}
                    </>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: semantic.bg.canvas },
    body: { flex: 1, padding: spacing.screen, gap: spacing.section, justifyContent: 'center' },
    /** loading / error 態的垂直堆疊（兩者共用同一節奏） */
    group: { gap: spacing.gap },
    email: { textAlign: 'center', color: semantic.text.secondary },
    /** NFC 狀態列（唯讀資訊，非互動元素 → 用 decorative 邊界） */
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.gap,
        backgroundColor: semantic.bg.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: semantic.border.decorative,
        paddingHorizontal: spacing.card,
        paddingVertical: spacing.gap,
    },
    rowLabel: { color: semantic.text.primary },
    rowValue: { color: semantic.text.secondary },
    version: { textAlign: 'center', color: semantic.text.muted, marginBottom: spacing.gap },
    /** 登出確認區：沿用 danger 狀態色，與確認按鈕同一語意 */
    confirmGroup: {
        gap: spacing.gap,
        backgroundColor: semantic.status.danger.bg,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: semantic.status.danger.border,
        padding: spacing.card,
    },
    confirmTitle: { color: semantic.text.primary, textAlign: 'center' },
    confirmHint: { color: semantic.text.secondary, textAlign: 'center' },
});