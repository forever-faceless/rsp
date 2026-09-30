import {
  Building2,
  Bus,
  Factory,
  GraduationCap,
  Hospital,
  Landmark as LandmarkIcon,
  MapPin,
  Milestone,
  Plane,
  School,
  Store,
  TrainFront,
  Trees,
  type LucideIcon,
} from "lucide-react";
import type { LandmarkCategory } from "@/lib/db/enums";
import type { Landmark } from "@/lib/db/schema";
import { estimateDriveMinutes, formatDistance, formatMinutes, haversineKm } from "@/lib/geo";
import { pick, type Dictionary, type Locale } from "@/lib/i18n";

export const categoryIcons: Record<LandmarkCategory, LucideIcon> = {
  city_centre: Building2,
  bus_stand: Bus,
  railway: TrainFront,
  highway: Milestone,
  hospital: Hospital,
  school: School,
  college: GraduationCap,
  market: Store,
  temple: LandmarkIcon,
  industrial: Factory,
  park: Trees,
  airport: Plane,
  other: MapPin,
};

export type LandmarkDistance = { landmark: Landmark; km: number; distance: string; drive: string };

export function computeDistances(origin: { lat: number; lng: number }, landmarks: Landmark[], locale: Locale): LandmarkDistance[] {
  return landmarks
    .map((landmark) => {
      const km = haversineKm(origin.lat, origin.lng, landmark.lat, landmark.lng);
      const minutes = landmark.driveMinutes ?? estimateDriveMinutes(km);
      return { landmark, km, distance: formatDistance(km, locale), drive: formatMinutes(minutes, locale) };
    })
    .sort((a, b) => a.landmark.sortOrder - b.landmark.sortOrder || a.km - b.km);
}

export function LandmarkList({ items, locale, dict }: { items: LandmarkDistance[]; locale: Locale; dict: Dictionary }) {
  if (!items.length) return null;
  return (
    <ul className="divide-y divide-navy-900/8">
      {items.map(({ landmark, distance, drive }) => {
        const Icon = categoryIcons[landmark.category] ?? MapPin;
        return (
          <li key={landmark.id} className="flex items-center gap-4 py-3.5">
            <Icon className="h-5 w-5 shrink-0 text-navy-800/55" strokeWidth={1.6} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-semibold text-navy-900">{pick(landmark, "name", locale)}</p>
              <p className="text-[12.5px] text-ink-500">{dict.landmark[landmark.category]}</p>
            </div>
            <div className="text-right">
              <p className="num text-[14.5px] font-semibold text-navy-900">{distance}</p>
              <p className="text-[12.5px] text-ink-500">
                {drive} {dict.property.driveTime}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
