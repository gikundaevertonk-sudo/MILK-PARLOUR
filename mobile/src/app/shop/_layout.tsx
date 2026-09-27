import { Stack } from "expo-router";
import { RoleGate } from "@/components/RoleGate";
import { ShopDraftProvider } from "@/lib/shopDraft";
import { colors, font } from "@/lib/theme";

export default function ShopLayout() {
  return (
    <RoleGate role="Shop">
      <ShopDraftProvider>
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
          <Stack.Screen name="index" options={{ title: "Shop" }} />
          <Stack.Screen name="sales" options={{ title: "Stock Count" }} />
          <Stack.Screen name="yoghurt" options={{ title: "Yoghurt" }} />
          <Stack.Screen name="money" options={{ title: "Closing Money" }} />
          <Stack.Screen name="review" options={{ title: "Review & Submit" }} />
        </Stack>
      </ShopDraftProvider>
    </RoleGate>
  );
}
