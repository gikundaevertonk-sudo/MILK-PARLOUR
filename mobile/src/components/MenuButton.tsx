import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, font, radius, shadow, spacing } from "@/lib/theme";

type Props = {
  /** Route to push. Every menu button opens its own full screen. */
  href: string;
  label: string;
  hint?: string;
  /** Single glyph shown in the leading tile. */
  glyph: string;
  tone?: "default" | "accent" | "danger";
  badge?: string;
};

const tones = {
  default: { bg: colors.primarySoft, fg: colors.primary },
  accent: { bg: colors.accentSoft, fg: colors.accent },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
};

export function MenuButton({ href, label, hint, glyph, tone = "default", badge }: Props) {
  const palette = tones[tone];
  return (
    <Link href={href as never} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={[styles.tile, { backgroundColor: palette.bg }]}>
          <Text style={[styles.glyph, { color: palette.fg }]}>{glyph}</Text>
        </View>
        <View style={styles.text}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{label}</Text>
            {badge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            ) : null}
          </View>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  pressed: { backgroundColor: colors.surfaceAlt, transform: [{ scale: 0.99 }] },
  tile: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  glyph: { fontSize: 20 },
  text: { flex: 1, gap: 2 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  label: { fontSize: font.h3, fontWeight: "600", color: colors.text },
  hint: { fontSize: font.small, color: colors.textMuted, lineHeight: 18 },
  chevron: { fontSize: 28, color: colors.textFaint, marginTop: -4 },
  badge: {
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: "center",
  },
  badgeText: { color: colors.onPrimary, fontSize: font.tiny, fontWeight: "700" },
});
