import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MenuButton } from "@/components/MenuButton";
import { Screen } from "@/components/Screen";
import { Banner, Button, Card, StatRow } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { prettyDate } from "@/lib/dates";
import { fetchSubscription, type SubscriptionState } from "@/lib/subscription";
import { colors, font, spacing } from "@/lib/theme";

export default function ControllerHome() {
  const { user, signOut } = useAuth();
  const [sub, setSub] = useState<SubscriptionState | null>(null);

  const load = useCallback(() => {
    fetchSubscription().then(setSub);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen
      onRefresh={load}
      footer={<Button label="Sign out" tone="secondary" onPress={signOut} />}
    >
      <View style={styles.hero}>
        <Text style={styles.greeting}>Welcome, {user?.display_name}</Text>
        <Text style={styles.role}>Controller</Text>
      </View>

      {sub?.blocked ? (
        <Banner
          tone="danger"
          text={`${sub.reason} Owner and shop logins are locked out until you renew.`}
        />
      ) : sub?.daysLeft != null && sub.daysLeft <= 3 ? (
        <Banner
          tone="warn"
          text={`Subscription ends in ${sub.daysLeft} day${sub.daysLeft === 1 ? "" : "s"}.`}
        />
      ) : null}

      <Card title="Subscription status">
        <StatRow
          label="Expiry date"
          value={sub?.expiryDate ? prettyDate(sub.expiryDate) : "—"}
        />
        <StatRow
          label="Status"
          value={sub?.isActive ? "Active" : "Inactive"}
          tone={sub?.isActive ? "accent" : "danger"}
          strong
        />
      </Card>

      <Text style={styles.sectionLabel}>Manage</Text>
      <MenuButton
        href="/controller/subscription"
        glyph="🔑"
        label="Subscription"
        hint="Change the expiry date or activate the system"
      />
      <MenuButton
        href="/controller/clear-data"
        glyph="🧹"
        label="Clear Data"
        hint="Wipe closing balances or stock-in for a date range"
        tone="danger"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 2 },
  greeting: { fontSize: font.h1, fontWeight: "800", color: colors.text },
  role: { fontSize: font.small, color: colors.textMuted },
  sectionLabel: {
    fontSize: font.tiny,
    fontWeight: "800",
    color: colors.textFaint,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: spacing.md,
  },
});
