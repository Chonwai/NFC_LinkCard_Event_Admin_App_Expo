import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRouter } from 'expo-router';

import { EmptyState } from '@/components/ui/EmptyState';
import { copy } from '@/constants/copy.zh-TW';
import { semantic, spacing } from '@/constants/theme';

/**
 * 未匹配路由（expo-router 的 `+not-found`）。
 *
 * W-12：此檔先前不存在，任何無法解析的深連結／錯誤的 `router.push` 字面路徑都會
 * 落到 expo-router 的預設畫面（純開發者訊息、零復原入口）——屬死路型態。
 *
 * 本頁提供單一復原入口（返回活動列表）。不需自行判斷登入狀態：根佈局的 auth
 * guard 會依 `isAuthenticated` 決定去向，未登入者停在登入頁，已登入者被導向
 * `/(auth)/home`。
 *
 * `headingLevel` 維持預設 `1`：本頁是全螢幕唯一標題（無 `ScreenHeader`），傳 2
 * 反而會讓畫面沒有 `h1`。
 */
export default function NotFoundScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            <EmptyState
                kind="no-results"
                title={copy.notFound.title}
                description={copy.notFound.hint}
                actionLabel={copy.settings.backToEvents}
                onAction={() => router.replace('/(auth)/home')}
                testID="not-found"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: semantic.bg.canvas,
        justifyContent: 'center',
        padding: spacing.screen,
    },
});
