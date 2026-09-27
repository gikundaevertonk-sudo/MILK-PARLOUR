import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { colors, font, radius, shadow, spacing } from "@/lib/theme";

export function Card({
  title,
  note,
  children,
  tone,
}: {
  title?: string;
  note?: string;
  children?: ReactNode;
  tone?: "default" | "warn" | "danger" | "accent";
}) {
  const border =
    tone === "warn"
      ? colors.warn
      : tone === "danger"
        ? colors.danger
        : tone === "accent"
          ? colors.accent
          : colors.border;
  return (
    <View style={[styles.card, { borderColor: border }]}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {note ? <Text style={styles.cardNote}>{note}</Text> : null}
      {children}
    </View>
  );
}

export function Field({
  label,
  hint,
  error,
  ...rest
}: TextInputProps & { label: string; hint?: string; error?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textFaint}
        {...rest}
        style={[styles.input, !!error && styles.inputError, rest.style]}
      />
      {error ? (
        <Text style={styles.fieldError}>{error}</Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Button({
  label,
  onPress,
  tone = "primary",
  busy,
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "secondary" | "danger";
  busy?: boolean;
  disabled?: boolean;
}) {
  const isOff = disabled || busy;
  const palette =
    tone === "primary"
      ? { bg: colors.primary, fg: colors.onPrimary, border: colors.primary }
      : tone === "danger"
        ? { bg: colors.danger, fg: colors.onPrimary, border: colors.danger }
        : { bg: colors.surface, fg: colors.primary, border: colors.borderStrong };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isOff}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border },
        pressed && styles.buttonPressed,
        isOff && styles.buttonOff,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text style={[styles.buttonText, { color: palette.fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function StatRow({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: "default" | "danger" | "accent";
  strong?: boolean;
}) {
  const fg =
    tone === "danger" ? colors.danger : tone === "accent" ? colors.accent : colors.text;
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: fg }, strong && styles.statStrong]}>
        {value}
      </Text>
    </View>
  );
}

export function Banner({
  text,
  tone = "warn",
}: {
  text: string;
  tone?: "warn" | "danger" | "accent" | "info";
}) {
  const palette =
    tone === "danger"
      ? { bg: colors.dangerSoft, fg: colors.danger }
      : tone === "accent"
        ? { bg: colors.accentSoft, fg: colors.accent }
        : tone === "info"
          ? { bg: colors.primarySoft, fg: colors.primaryDark }
          : { bg: colors.warnSoft, fg: colors.warn };
  return (
    <View style={[styles.banner, { backgroundColor: palette.bg }]}>
      <Text style={[styles.bannerText, { color: palette.fg }]}>{text}</Text>
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow,
  },
  cardTitle: { fontSize: font.h3, fontWeight: "600", color: colors.text },
  cardNote: { fontSize: font.small, color: colors.textMuted, lineHeight: 18 },

  field: { gap: 5 },
  fieldLabel: { fontSize: font.small, fontWeight: "600", color: colors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: font.body,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputError: { borderColor: colors.danger },
  fieldHint: { fontSize: font.tiny, color: colors.textFaint },
  fieldError: { fontSize: font.tiny, color: colors.danger },

  button: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: { opacity: 0.85 },
  buttonOff: { opacity: 0.5 },
  buttonText: { fontSize: font.body, fontWeight: "700" },

  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
    gap: spacing.md,
  },
  statLabel: { fontSize: font.small, color: colors.textMuted, flexShrink: 1 },
  statValue: { fontSize: font.body, fontWeight: "600" },
  statStrong: { fontSize: font.h3, fontWeight: "700" },

  banner: { borderRadius: radius.sm, padding: spacing.md },
  bannerText: { fontSize: font.small, fontWeight: "600", lineHeight: 19 },

  empty: {
    fontSize: font.small,
    color: colors.textFaint,
    fontStyle: "italic",
    paddingVertical: spacing.sm,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
});
