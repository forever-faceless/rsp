import type { Region } from "@/lib/db/schema";

/** What a form needs to know about a district: its code, a name to show and the number it will issue next. */
export type RegionOption = { code: string; name: string; nameKn: string; nextNo: number };

export function regionOptions(regions: Region[]): RegionOption[] {
  return regions.map((r) => ({ code: r.code, name: r.nameEn || r.code, nameKn: r.nameKn || r.nameEn || r.code, nextNo: r.nextNo }));
}

/** The district shown when a code is picked, as in "HSN · Hassan". */
export function regionLabel(r: Pick<RegionOption, "code" | "name">): string {
  return r.name && r.name !== r.code ? `${r.code} · ${r.name}` : r.code;
}
