import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Tabs } from "expo-router";
import { BottomTabBar } from "expo-router/build/react-navigation/bottom-tabs";

import { Icon } from "@/components/ui/Icon";
import { copy } from "@/constants/copy.zh-TW";
import { components, hairline, layout } from "@/constants/theme";

/**
 * 僅內容區高度（icon 28 + 標籤 12 + 少量內距）。
 * 底部 safe-area 另計，避免把 Home Indicator 空白算成「行距過大」。
 */
const TAB_BAR_CONTENT_HEIGHT = 52;

type TabBarProps = React.ComponentProps<typeof BottomTabBar>;

function AuthTabBar(props: TabBarProps) {
  const focused = props.state.routes[props.state.index]?.key;
  const focusedOptions = focused
    ? props.descriptors[focused]?.options
    : undefined;
  const flatStyle = StyleSheet.flatten(focusedOptions?.tabBarStyle);
  if (flatStyle && "display" in flatStyle && flatStyle.display === "none") {
    return null;
  }

  const bar = <BottomTabBar {...props} />;
  if (Platform.OS !== "web") {
    return bar;
  }

  return <View style={styles.webFixed}>{bar}</View>;
}

export default function AuthLayout() {
  const insets = useSafeAreaInsets();
  /**
   * Web / Chrome 裝置模式常回傳很大的 safe-area-inset-bottom，
   * 會在標籤下方留一塊空白，看起來像行距過大。Web 不額外加這段。
   */
  const bottomInset = Platform.OS === "web" ? 0 : insets.bottom;
  const tabBarHeight = TAB_BAR_CONTENT_HEIGHT + bottomInset;

  return (
    <View style={styles.root}>
      <Tabs
        tabBar={AuthTabBar}
        screenOptions={{
          headerShown: false,
          tabBarPosition: "bottom",
          tabBarLabelPosition: "below-icon",
          tabBarShowLabel: true,
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: components.tabBar.activeLabel,
          tabBarInactiveTintColor: components.tabBar.inactiveLabel,
          tabBarStyle: {
            position: Platform.OS === "web" ? "relative" : "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: components.tabBar.bg,
            borderTopColor: components.tabBar.borderColor,
            borderTopWidth: hairline,
            height: tabBarHeight,
            paddingTop: 0,
            paddingBottom: bottomInset,
            justifyContent: "center",
          },
          tabBarItemStyle: {
            justifyContent: "center",
            paddingVertical: 0,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            lineHeight: 12,
            fontWeight: "500",
            marginTop: 1,
            marginBottom: 0,
          },
          tabBarIconStyle: {
            marginTop: 0,
            marginBottom: 0,
          },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: copy.home.title,
            sceneStyle: { paddingBottom: tabBarHeight },
            tabBarIcon: ({ color, size }) => (
              <Icon
                name="home"
                color={String(color)}
                size={typeof size === "number" ? size : layout.icon.lg}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: copy.settings.title,
            sceneStyle: { paddingBottom: tabBarHeight },
            tabBarIcon: ({ color, size }) => (
              <Icon
                name="cog"
                color={String(color)}
                size={typeof size === "number" ? size : layout.icon.lg}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="[eventId]"
          options={{
            href: null,
            tabBarStyle: { display: "none" },
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  webFixed: {
    position: "fixed" as unknown as "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
});
