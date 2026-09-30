import type { Approval, BilingualItem } from "@/lib/db/enums";

/**
 * Admin forms capture bilingual lists as plain text, one item per line:
 *   English text | ಕನ್ನಡ ಪಠ್ಯ
 * The Kannada half is optional.
 */
export function parseBilingualLines(text: string): BilingualItem[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [en = "", kn = ""] = line.split("|").map((s) => s.trim());
      return { en, kn };
    })
    .filter((item) => item.en);
}

export function bilingualToLines(items: BilingualItem[] | null | undefined): string {
  return (items ?? []).map((i) => (i.kn ? `${i.en} | ${i.kn}` : i.en)).join("\n");
}

/** Approvals: "Name | ಕನ್ನಡ | Reference number" (Kannada and number optional). */
export function parseApprovalLines(text: string): Approval[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((s) => s.trim());
      const [en = "", kn = "", number = ""] = parts.length === 2 ? [parts[0], "", parts[1]] : parts;
      return { en, kn, number };
    })
    .filter((a) => a.en);
}

export function approvalsToLines(items: Approval[] | null | undefined): string {
  return (items ?? []).map((a) => [a.en, a.kn, a.number].join(" | ").replace(/(\s\|\s)+$/, "")).join("\n");
}

export type ActionState =
  | {
      error?: string;
      success?: string;
      fieldErrors?: Record<string, string>;
    }
  | undefined;

export function zodFieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function formFiles(formData: FormData, key: string): File[] {
  return formData.getAll(key).filter((f): f is File => f instanceof File && f.size > 0);
}

export function formFile(formData: FormData, key: string): File | null {
  const f = formData.get(key);
  return f instanceof File && f.size > 0 ? f : null;
}
