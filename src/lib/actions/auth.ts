"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, verifyCredentials } from "@/lib/auth";
import type { ActionState } from "@/lib/forms";

const attempts = new Map<string, { count: number; resetAt: number }>();

function throttle(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    if (attempts.size > 5000) attempts.clear();
    attempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 20;
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (throttle(username.toLowerCase())) {
    return { error: "Too many attempts. Please wait 15 minutes and try again." };
  }

  // Small constant delay blunts brute-force attempts without hurting real users.
  await new Promise((r) => setTimeout(r, 350));

  if (!verifyCredentials(username, password)) {
    return { error: "Incorrect username or password." };
  }

  await createSession(username.trim());
  redirect(next.startsWith("/admin") && !next.startsWith("/admin/login") ? next : "/admin");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/admin/login");
}
