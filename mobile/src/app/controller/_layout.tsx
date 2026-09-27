import { Stack } from "expo-router";
import { RoleGate } from "@/components/RoleGate";
import { colors, font } from "@/lib/theme";

export default function ControllerLayout() {
  return (
    <RoleGate role="Controller">
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerTitleStyle: {
            color: colors.text,
            fontSize: font.h3,
            fontWeight: "700",
          },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
          headerBackTitle: "Back",
        }}
      >
        <Stack.Screen name="index" options={{ title: "Controller" }} />
        <Stack.Screen name="subscription" options={{ title: "Subscription" }} />
        <Stack.Screen name="clear-data" options={{ title: "Clear Data" }} />
      </Stack>
    </RoleGate>
  );
}
