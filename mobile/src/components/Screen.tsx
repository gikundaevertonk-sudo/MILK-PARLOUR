import type { ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, font, spacing } from "@/lib/theme";

type Props = {
  children: ReactNode;
  /** Short line under the screen title explaining what this page is for. */
  intro?: string;
  loading?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Pinned to the bottom, outside the scroll area. */
  footer?: ReactNode;
  scroll?: boolean;
};

export function Screen({
  children,
  intro,
  loading,
  onRefresh,
  refreshing,
  footer,
  scroll = true,
}: Props) {
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const body = (
    <>
      {intro ? <Text style={styles.intro}>{intro}</Text> : null}
      {children}
    </>
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} />
            ) : undefined
          }
        >
          {body}
        </ScrollView>
      ) : (
        <View style={[styles.flex, styles.content]}>{body}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  intro: {
    fontSize: font.small,
    color: colors.textMuted,
    lineHeight: 19,
    marginBottom: spacing.xs,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
});
