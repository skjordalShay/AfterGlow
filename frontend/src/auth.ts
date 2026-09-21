import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const API = process.env.EXPO_PUBLIC_BACKEND_URL!;
const KEY = "afterglow_access_token";
const USER_KEY = "afterglow_user";

export type User = {
  id: string;
  email: string;
  first_name: string;
  zip_code?: string | null;
  about?: string | null;
  photo_url?: string | null;
  created_at: string;
};

async function saveToken(t: string) {
  if (Platform.OS === "web") localStorage.setItem(KEY, t);
  else await SecureStore.setItemAsync(KEY, t);
}

export async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") return localStorage.getItem(KEY);
  return await SecureStore.getItemAsync(KEY);
}

async function saveUser(u: User) {
  const s = JSON.stringify(u);
  if (Platform.OS === "web") localStorage.setItem(USER_KEY, s);
  else await SecureStore.setItemAsync(USER_KEY, s);
}

export async function getStoredUser(): Promise<User | null> {
  const s =
    Platform.OS === "web"
      ? localStorage.getItem(USER_KEY)
      : await SecureStore.getItemAsync(USER_KEY);
  return s ? JSON.parse(s) : null;
}

export async function signOut() {
  if (Platform.OS === "web") {
    localStorage.removeItem(KEY);
    localStorage.removeItem(USER_KEY);
  } else {
    await SecureStore.deleteItemAsync(KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  }
}

async function authCall(path: string, body: object): Promise<{ user: User; token: string }> {
  const r = await fetch(`${API}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.detail ?? "Something went wrong");
  await saveToken(data.access_token);
  await saveUser(data.user);
  return { user: data.user, token: data.access_token };
}

export function signUp(email: string, password: string, first_name: string) {
  return authCall("/auth/signup", {
    email: email.trim().toLowerCase(),
    password,
    first_name: first_name.trim(),
  });
}

export function signIn(email: string, password: string) {
  return authCall("/auth/login", {
    email: email.trim().toLowerCase(),
    password,
  });
}

export async function api<T = any>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const t = await getToken();
  const r = await fetch(`${API}/api${path}`, {
    ...(init ?? {}),
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (r.status === 401) {
    await signOut();
    throw new Error("Session expired");
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail ?? `Request failed (${r.status})`);
  return data as T;
}

export async function fetchMe(): Promise<User | null> {
  try {
    const u = await api<User>("/auth/me");
    await saveUser(u);
    return u;
  } catch {
    return null;
  }
}
