import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { Button, Card, Empty, Field } from "@/components/ui";
import {
  isYoghurt,
  openingUnit,
  priceNote,
  trimNumber,
} from "@/lib/products";
import { countedLabel, useShopDraft } from "@/lib/shopDraft";
import { colors, font, spacing } from "@/lib/theme";

export default function StockCount() {
  const draft = useShopDraft();
  const items = draft.products.filter((p) => !isYoghurt(p));

  const grouped = items.reduce<Record<string, typeof items>>((groups, product) => {
    (groups[product.category || "Products"] ||= []).push(product);
    return groups;
  }, {});

  return (
    <Screen
      intro="Enter what is LEFT on the shelf. Sold and cash are worked out from the opening stock."
      loading={draft.loading}
      footer={<Button label="Done" onPress={() => router.back()} />}
    >
      {items.length === 0 ? (
        <Card>
          <Empty text="No products are assigned to this shop yet." />
        </Card>
      ) : null}

      {Object.entries(grouped).map(([category, products]) => (
        <View key={category} style={styles.group}>
          <Text style={styles.groupTitle}>{category}</Text>
          {products.map((product) => {
            const opening = draft.openings.get(product.product_id) ?? 0;
            const count = draft.counts[product.product_id] ?? {
              primary: "",
              secondary: "",
            };
            const result = draft.results.get(product.product_id);
            const labels = countedLabel(product);

            return (
              <Card
                key={product.product_id}
                title={product.name}
                note={priceNote(product)}
                tone={result?.kind === "error" ? "danger" : "default"}
              >
                <View style={styles.openingBox}>
                  <Text style={styles.openingValue}>
                    {trimNumber(opening)} {openingUnit(product)}
                  </Text>
                  <Text style={styles.openingLabel}>opening stock</Text>
                </View>
                <Text style={styles.carryNote}>
                  {draft.carryNotes.get(product.product_id)}
                </Text>

                {labels.secondary ? (
                  <View style={styles.row}>
                    <View style={styles.half}>
                      <Field
                        label={labels.primary}
                        value={count.primary}
                        onChangeText={(v) =>
                          draft.setCount(product.product_id, { primary: v })
                        }
                        keyboardType="number-pad"
                        placeholder="0"
                      />
                    </View>
                    <View style={styles.half}>
                      <Field
                        label={labels.secondary}
                        value={count.secondary}
                        onChangeText={(v) =>
                          draft.setCount(product.product_id, { secondary: v })
                        }
                        keyboardType="number-pad"
                        placeholder="0"
                      />
                    </View>
                  </View>
                ) : (
                  <Field
                    label={labels.primary}
                    value={count.primary}
                    onChangeText={(v) =>
                      draft.setCount(product.product_id, { primary: v })
                    }
                    keyboardType="decimal-pad"
                    placeholder="0"
                  />
                )}

                {result?.kind === "ok" ? (
                  <View style={styles.resultBox}>
                    <Text style={styles.resultText}>
                      Sold {trimNumber(result.sold)} {openingUnit(product)}
                    </Text>
                    <Text style={styles.resultCash}>{result.cash.toFixed(2)}</Text>
                  </View>
                ) : result?.kind === "error" ? (
                  <Text style={styles.errorText}>{result.reason}</Text>
                ) : null}
              </Card>
            );
          })}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  groupTitle: {
    fontSize: font.tiny,
    fontWeight: "800",
    color: colors.textFaint,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: spacing.sm,
  },
  openingBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  openingValue: { fontSize: font.h2, fontWeight: "800", color: colors.primaryDark },
  openingLabel: {
    fontSize: font.tiny,
    color: colors.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  carryNote: { fontSize: font.tiny, color: colors.textFaint, lineHeight: 16 },
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
  errorText: { fontSize: font.small, color: colors.danger, fontWeight: "600" },
});
