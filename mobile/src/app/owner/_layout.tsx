import { Stack } from "expo-router";
import { RoleGate } from "@/components/RoleGate";
import { colors, font } from "@/lib/theme";

export default function OwnerLayout() {
  return (
    <RoleGate role="Owner">
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
        <Stack.Screen name="index" options={{ title: "Owner" }} />
        <Stack.Screen name="today" options={{ title: "Today's Entries" }} />
        <Stack.Screen name="stock-in" options={{ title: "Morning Stock-In" }} />
        <Stack.Screen name="closing" options={{ title: "Closing Balances" }} />
        <Stack.Screen name="expenses" options={{ title: "Expenses" }} />
        <Stack.Screen name="products" options={{ title: "Products" }} />
        <Stack.Screen name="shops" options={{ title: "Shop Assignments" }} />
        <Stack.Screen name="reports" options={{ title: "Reports" }} />
      </Stack>
    </RoleGate>
  );
}
