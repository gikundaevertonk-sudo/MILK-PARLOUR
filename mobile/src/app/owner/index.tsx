import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MenuButton } from "@/components/MenuButton";
import { Screen } from "@/components/Screen";
import { Banner, Button } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { fetchSubscription } from "@/lib/subscription";
import { colors, font, spacing } from "@/lib/theme";

export default function OwnerHome() {
  const { user, signOut } = useAuth();
  const [renewalNote, setRenewalNote] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscription().then((sub) => {
      if (sub.daysLeft != null && sub.daysLeft <= 3 && !sub.blocked) {
        setRenewalNote(
          `Subscription ends on ${sub.expiryDate} — ${sub.daysLeft} day${
            sub.daysLeft === 1 ? "" : "s"
          } left.`
        );
      }
    });
  }, []);

  return (
    <Screen
      footer={<Button label="Sign out" tone="secondary" onPress={signOut} />}
    >
      <View style={styles.hero}>
        <Text style={styles.greeting}>Welcome, {user?.display_name}</Text>
        <Text style={styles.role}>Owner dashboard</Text>
      </View>

      {renewalNote ? <Banner text={renewalNote} tone="warn" /> : null}

      <Text style={styles.sectionLabel}>Daily operations</Text>
      <MenuButton
        href="/owner/today"
        glyph="📋"
        label="Today's Entries"
        hint="What each shop has recorded for a chosen day"
      />
      <MenuButton
        href="/owner/stock-in"
        glyph="📦"
        label="Morning Stock-In"
        hint="Book stock out to a shop"
        tone="accent"
      />
      <MenuButton
        href="/owner/closing"
        glyph="🧾"
        label="Closing Balances"
        hint="Opening, sold, remaining and cash reconciliation"
      />

      <Text style={styles.sectionLabel}>Business</Text>
      <MenuButton
        href="/owner/expenses"
        glyph="💰"
        label="Expenses"
        hint="Record costs and see net performance"
      />
      <MenuButton
        href="/owner/reports"
        glyph="📈"
        label="Reports"
        hint="Sales totals by shop and product"
      />

      <Text style={styles.sectionLabel}>Setup</Text>
      <MenuButton
        href="/owner/products"
        glyph="🏷️"
        label="Products"
        hint="Names, categories, units and prices"
      />
      <MenuButton
        href="/owner/shops"
        glyph="🏪"
        label="Shop Assignments"
        hint="Which products each shop sells, and attendant logins"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 2, marginBottom: spacing.xs },
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
