import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase, type User } from "./supabase";

const STORAGE_KEY = "milkParlour.user";

type AuthState = {
  user: User | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setUser(JSON.parse(raw) as User);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function signIn(username: string, password: string) {
    const { data, error } = await supabase.rpc("login_check", {
      p_username: username.trim(),
      p_password: password,
    });

    if (error || !data || data.length === 0) {
      return "Invalid username or password.";
    }

    const found = data[0] as User;
    if (!["Owner", "Shop", "Controller"].includes(found.role)) {
      return "Your account does not have a valid role.";
    }

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(found));
    setUser(found);
    return null;
  }

  async function signOut() {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** Throws the caller out to login if the role does not match. */
export function useRequireRole(role: User["role"]) {
  const { user } = useAuth();
  return user && user.role === role ? user : null;
}
