import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { Banner, Button, Card, Field, StatRow } from "@/components/ui";
import { yoghurtFlavours } from "@/lib/products";
import { useShopDraft } from "@/lib/shopDraft";
import { colors, font, spacing } from "@/lib/theme";
import { yoghurtCupPresets } from "@/lib/yoghurt";

export default function Yoghurt() {
  const draft = useShopDraft();
  const overCounted = draft.cupSales.filter((s) => s.counted && s.left > s.opening);

  return (
    <Screen
      intro="Enter the cups LEFT per size. One sealed pack is 25 cups. Sales are worked out from what was available."
      loading={draft.loading}
      footer={<Button label="Done" onPress={() => router.back()} />}
    >
      {overCounted.length > 0 ? (
        <Banner
          tone="warn"
          text={`More cups counted than were available for ${overCounted
            .map((s) => s.size)
            .join(", ")}. Check the morning stock-in.`}
        />
      ) : null}

      <Text style={styles.sectionLabel}>Cups left</Text>
      {yoghurtCupPresets.map((preset) => {
        const row = draft.cupRows[preset.size] ?? {
          size: preset.size,
          sealed: "",
          unsealed: "",
        };
        const sale = draft.cupSales.find((s) => s.size === preset.size);
        return (
          <Card
            key={preset.size}
            title={`${preset.size} — ${preset.price} per cup`}
            tone={sale && sale.counted && sale.left > sale.opening ? "warn" : "default"}
          >
            <View style={styles.availableBox}>
              <Text style={styles.availableValue}>{sale?.opening ?? 0} cups</Text>
              <Text style={styles.availableLabel}>available</Text>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <Field
                  label="Sealed packs left"
                  value={row.sealed}
                  onChangeText={(v) => draft.setCupRow(preset.size, { sealed: v })}
                  keyboardType="number-pad"
                  placeholder="0"
                />
              </View>
              <View style={styles.half}>
                <Field
                  label="Loose cups left"
                  value={row.unsealed}
                  onChangeText={(v) => draft.setCupRow(preset.size, { unsealed: v })}
                  keyboardType="number-pad"
                  placeholder="0"
                />
              </View>
            </View>
            {sale?.counted ? (
              <View style={styles.resultBox}>
                <Text style={styles.resultText}>
                  {sale.left} left · sold {sale.sold} cups
                </Text>
                <Text style={styles.resultCash}>{sale.cash.toFixed(2)}</Text>
              </View>
            ) : null}
          </Card>
        );
      })}

      <Card tone="accent">
        <StatRow label="Yoghurt cup sales" value={draft.cupCash.toFixed(2)} strong />
      </Card>

      <Text style={styles.sectionLabel}>Flavours remaining (ml)</Text>
      <Card note="Bulk yoghurt left per flavour. These add up to the yoghurt quantity.">
        {yoghurtFlavours.map((flavour) => (
          <Field
            key={flavour}
            label={flavour}
            value={draft.flavours[flavour] ?? ""}
            onChangeText={(v) => draft.setFlavour(flavour, v)}
            keyboardType="decimal-pad"
            placeholder="0"
          />
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: font.tiny,
    fontWeight: "800",
    color: colors.textFaint,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: spacing.md,
  },
  availableBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  availableValue: { fontSize: font.h2, fontWeight: "800", color: colors.primaryDark },
  availableLabel: {
    fontSize: font.tiny,
    color: colors.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  row: { flexDirection: "row", gap: spacing.sm },
  half: { flex: 1 },
  resultBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  resultText: { fontSize: font.small, fontWeight: "600", color: colors.accent },
  resultCash: { fontSize: font.h3, fontWeight: "800", color: colors.accent },
});
