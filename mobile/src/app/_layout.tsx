import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/lib/auth";
import { colors, font } from "@/lib/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
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
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="owner" options={{ headerShown: false }} />
          <Stack.Screen name="shop" options={{ headerShown: false }} />
          <Stack.Screen name="controller" options={{ headerShown: false }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
