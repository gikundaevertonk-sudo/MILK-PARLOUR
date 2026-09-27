import { Redirect } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/lib/auth";
import { fetchSubscription, type SubscriptionState } from "@/lib/subscription";
import { colors, font, radius, shadow, spacing } from "@/lib/theme";
import type { Role } from "@/lib/supabase";
import { Button } from "./ui";

/**
 * Guards a whole role area: wrong role goes back to login, and an expired or
 * inactive subscription blocks the area entirely.
 *
 * The Controller is exempt from the block - they are the one who renews it.
 */
export function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const [sub, setSub] = useState<SubscriptionState | null>(null);

  useEffect(() => {
    let alive = true;
    fetchSubscription()
      .then((s) => {
        if (alive) setSub(s);
      })
      .catch(() => {
        if (alive) setSub(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (loading || (user && !sub)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) return <Redirect href="/login" />;
  if (user.role !== role) return <Redirect href="/" />;

  const blocked = sub?.blocked && role !== "Controller";
  if (blocked) {
    return (
      <View style={styles.center}>
        <View style={styles.card}>
          <Text style={styles.glyph}>🔒</Text>
          <Text style={styles.title}>System locked</Text>
          <Text style={styles.reason}>{sub?.reason}</Text>
          <Text style={styles.help}>
            Contact the system controller to renew or reactivate the subscription.
          </Text>
          <Button label="Sign out" tone="secondary" onPress={signOut} />
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: "center",
    maxWidth: 420,
    width: "100%",
    ...shadow,
  },
  glyph: { fontSize: 44 },
  title: { fontSize: font.h1, fontWeight: "800", color: colors.danger },
  reason: {
    fontSize: font.body,
    color: colors.text,
    textAlign: "center",
    fontWeight: "600",
  },
  help: {
    fontSize: font.small,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 19,
  },
});
