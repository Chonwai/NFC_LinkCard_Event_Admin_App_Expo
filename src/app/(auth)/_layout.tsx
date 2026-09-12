import { Tabs } from 'expo-router';

import { Icon } from '@/components/ui/Icon';
import { copy } from '@/constants/copy.zh-TW';
import { semantic } from '@/constants/theme';

export default function AuthLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: semantic.icon.brand,
                tabBarInactiveTintColor: semantic.icon.muted,
                tabBarStyle: {
                    backgroundColor: semantic.bg.surface,
                    borderTopColor: semantic.border.decorative,
                },
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    title: copy.home.title,
                    tabBarIcon: ({ color, size }) => (
                        <Icon name="home" color={color.toString()} size={size as unknown as 'md'} />
                    ),
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: copy.settings.title,
                    tabBarIcon: ({ color, size }) => (
                        <Icon name="cog" color={color.toString()} size={size as unknown as 'md'} />
                    ),
                }}
            />
            {/* 動態活動路由不是 tab：從 tab bar 隱藏 */}
            <Tabs.Screen name="[eventId]" options={{ href: null }} />
        </Tabs>
    );
}
