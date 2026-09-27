import { StyleSheet, Text, View } from "react-native";
import { MenuButton } from "@/components/MenuButton";
import { Screen } from "@/components/Screen";
import { Banner, Button, Card, StatRow } from "@/components/ui";
import { DateField } from "@/components/pickers";
import { useAuth } from "@/lib/auth";
import { isYoghurt } from "@/lib/products";
import { pendingCount, useShopDraft } from "@/lib/shopDraft";
import { colors, font, spacing } from "@/lib/theme";

export default function ShopHome() {
  const { user, signOut } = useAuth();
  const draft = useShopDraft();
  const pending = pendingCount(draft);
  const countable = draft.products.filter((p) => !isYoghurt(p)).length;
  const hasYoghurt = draft.products.some(isYoghurt);

  return (
    <Screen
      loading={draft.loading}
      footer={<Button label="Sign out" tone="secondary" onPress={signOut} />}
    >
      <View style={styles.hero}>
        <Text style={styles.greeting}>Welcome, {user?.display_name}</Text>
        <Text style={styles.role}>Closing balance for the day</Text>
      </View>

      <Card>
        <DateField label="Entry date" value={draft.date} onChange={draft.setDate} />
      </Card>

      {draft.firstError ? (
        <Banner
          tone="danger"
          text={`${draft.firstError.name}: ${draft.firstError.reason}`}
        />
      ) : null}

      <Text style={styles.sectionLabel}>Steps</Text>
      <MenuButton
        href="/shop/sales"
        glyph="📦"
        label="Stock Count"
        hint="Enter what is left on the shelf for each product"
        badge={pending > 0 ? String(pending) : undefined}
      />
      {hasYoghurt ? (
        <MenuButton
          href="/shop/yoghurt"
          glyph="🥤"
          label="Yoghurt"
          hint="Cups left per size, and flavour millilitres"
          tone="accent"
        />
      ) : null}
      <MenuButton
        href="/shop/money"
        glyph="💵"
        label="Closing Money"
        hint="M-Pesa, cash notes and coins"
      />
      <MenuButton
        href="/shop/review"
        glyph="✅"
        label="Review & Submit"
        hint="Check the totals, then send to the owner"
        tone="accent"
      />

      <Text style={styles.sectionLabel}>Running totals</Text>
      <Card>
        <StatRow label="Products counted" value={`${countable - pending} of ${countable}`} />
        <StatRow label="Product sales" value={draft.productCash.toFixed(2)} />
        {hasYoghurt ? (
          <StatRow label="Yoghurt cup sales" value={draft.cupCash.toFixed(2)} />
        ) : null}
        <StatRow label="Expected sales" value={draft.expected.toFixed(2)} strong />
        <StatRow label="Money entered" value={draft.received.toFixed(2)} strong />
        <StatRow
          label="Difference"
          value={draft.difference.toFixed(2)}
          tone={draft.difference < 0 ? "danger" : "accent"}
          strong
        />
      </Card>
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
