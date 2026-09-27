import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Banner, Button, Field } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { colors, font, radius, shadow, spacing } from "@/lib/theme";

export default function Login() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }
    setBusy(true);
    setError(null);
    const message = await signIn(username, password);
    setBusy(false);
    if (message) {
      setError(message);
      return;
    }
    router.replace("/");
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Text style={styles.logoGlyph}>🥛</Text>
          </View>
          <Text style={styles.title}>Milk Parlour</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>
        </View>

        <View style={styles.card}>
          {error ? <Banner text={error} tone="danger" /> : null}

          <Field
            label="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Your login name"
            returnKeyType="next"
          />

          <View>
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder="Your password"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              style={styles.eye}
            >
              <Text style={styles.eyeText}>{showPassword ? "Hide" : "Show"}</Text>
            </Pressable>
          </View>

          <Button label="Sign in" onPress={submit} busy={busy} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  brand: { alignItems: "center", gap: spacing.sm },
  logo: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  logoGlyph: { fontSize: 36 },
  title: { fontSize: font.h1, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: font.body, color: colors.textMuted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow,
  },
  eye: { position: "absolute", right: spacing.md, top: 28 },
  eyeText: { color: colors.primary, fontSize: font.small, fontWeight: "700" },
});
