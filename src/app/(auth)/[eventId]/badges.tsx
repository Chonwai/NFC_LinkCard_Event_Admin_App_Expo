import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { copy } from '@/constants/copy.zh-TW';
import { semantic, spacing, type } from '@/constants/theme';

export default function BadgesScreen() {
    const insets = useSafeAreaInsets();
    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            <ScreenHeader title={copy.event.badgesTitle} leading="back" backFallbackPath="/(auth)/home" />
            <View style={styles.body}>
                <Text style={type.body}>{copy.event.badgesTitle}</Text>
                <Text style={[type.caption, styles.note]}>功能開發中</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: semantic.bg.canvas },
    body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.screen, gap: spacing.gap },
    note: { color: semantic.text.muted },
});