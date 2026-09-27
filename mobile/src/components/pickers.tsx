import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { prettyDate, shiftIso } from "@/lib/dates";
import type { Shop } from "@/lib/supabase";
import { colors, font, radius, spacing } from "@/lib/theme";

export function ShopPicker({
  shops,
  value,
  onChange,
}: {
  shops: Shop[];
  value: number | null;
  onChange: (shopId: number) => void;
}) {
  if (shops.length === 0) return null;
  return (
    <View style={styles.block}>
      <Text style={styles.label}>Shop</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chipRow}>
          {shops.map((shop) => {
            const active = shop.shop_id === value;
            return (
              <Pressable
                key={shop.shop_id}
                onPress={() => onChange(shop.shop_id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {shop.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Date entry that works identically on Android, iOS and web:
 * a YYYY-MM-DD field with day-stepper buttons either side.
 */
export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
}) {
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.dateRow}>
        <Pressable
          onPress={() => onChange(shiftIso(value, -1))}
          accessibilityRole="button"
          accessibilityLabel="Previous day"
          style={styles.step}
        >
          <Text style={styles.stepText}>‹</Text>
        </Pressable>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.dateInput}
        />
        <Pressable
          onPress={() => onChange(shiftIso(value, 1))}
          accessibilityRole="button"
          accessibilityLabel="Next day"
          style={styles.step}
        >
          <Text style={styles.stepText}>›</Text>
        </Pressable>
      </View>
      <Text style={styles.pretty}>{prettyDate(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 6 },
  label: { fontSize: font.small, fontWeight: "600", color: colors.textMuted },
  chipRow: { flexDirection: "row", gap: spacing.sm, paddingVertical: 2 },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: font.small, fontWeight: "600", color: colors.textMuted },
  chipTextActive: { color: colors.onPrimary },

  dateRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: font.body,
    color: colors.text,
    backgroundColor: colors.surface,
    textAlign: "center",
  },
  step: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { fontSize: 24, color: colors.primary, marginTop: -3 },
  pretty: { fontSize: font.tiny, color: colors.textFaint },
});
