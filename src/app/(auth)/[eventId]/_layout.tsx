import { Stack } from "expo-router";

import { semantic } from "@/constants/theme";

export default function EventLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: semantic.bg.canvas },
      }}
    >
      <Stack.Screen name="overview" />
      <Stack.Screen name="check-in" />
      <Stack.Screen name="nfc-bind" />
      <Stack.Screen name="badges" />
    </Stack>
  );
}
