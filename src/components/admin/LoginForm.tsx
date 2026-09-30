"use client";

import { useActionState } from "react";
import { login } from "@/lib/actions/auth";
import type { ActionState } from "@/lib/forms";
import { FormStatus, Input, SubmitButton } from "./ui";
import { ActionForm } from "@/components/ActionForm";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(login, undefined);
  return (
    <ActionForm action={action} pending={pending} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <Input label="Username" name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required />
      <Input label="Password" name="password" type="password" autoComplete="current-password" required />
      <FormStatus state={state} />
      <SubmitButton className="w-full">Sign in</SubmitButton>
    </ActionForm>
  );
}
