"use client";

import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  CloudOff,
  Download,
  Globe,
  Hand,
  Layers,
  Loader2,
  LocateFixed,
  MapPin,
  Maximize,
  PencilRuler,
  RectangleHorizontal,
  RotateCw,
  Ruler,
  Save,
  Target,
  Trash2,
  Undo2,
  Upload,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { attachSurvey, copySurveySizeToListing, createPropertyFromSurvey, deleteSurvey, removeSurveyPhoto, saveSurvey, uploadSurveyPhotos } from "@/lib/actions/surveys";
import { PROPERTY_TYPES, type LatLng, type SurveyCorner, type SurveyGeometry } from "@/lib/db/enums";
import type { ActionState } from "@/lib/forms";
import { centroid, convertArea, cornerLabel, formatCoords, formatFeet, fromLocalMetres, googleEarthLink, rectangleCorners, SQFT_PER_SQM, toLocalMetres } from "@/lib/geo";
import { describeImport, EarthFileError, mergeImport, readEarthFile } from "@/lib/earth-import";
import { en } from "@/lib/i18n/dictionaries/en";
import { measureFt, shortId, summariseSurvey, surveyCentre } from "@/lib/survey";
import { formatMetres, fromFeet } from "@/lib/units";
import { cn, formatNumber } from "@/lib/utils";
import { LengthEntry, MetresEntry, UnitSwitch, useLengthUnit } from "../MeasureInput";
import { PhotoManager } from "../PhotoManager";
import { ConfirmButton, FormStatus, Notice, SubmitButton } from "../ui";
import { PlaceSearch } from "./PlaceSearch";
import SurveyMap, { type SurveyMapApi, type SurveyMode } from "./SurveyMap";
import { useGps } from "./useGps";
import { regionLabel, type RegionOption } from "@/lib/regions";
import { ActionForm } from "@/components/ActionForm";

export type SurveyTargetChoice = { key: string; refText: string; label: string; group: "Properties" | "Projects" | "Sites" };

export type SurveyToolProps = {
  survey: { id: number; title: string; notes: string; geometry: SurveyGeometry; photos: string[]; updatedAt: number };
  target: { key: string; refText: string; label: string; href: string } | null;
  targets: SurveyTargetChoice[];
  /** The district registers a new property can go into, with the main one first. */
  regions: RegionOption[];
  defaultPrefix: string;
  centre: LatLng;
};

type Draft = { title: string; notes: string; geometry: SurveyGeometry; at: number };
type SaveState = "saved" | "dirty" | "saving" | "offline" | "error";

const draftKey = (id: number) => `rsp-survey-${id}`;

function readDraft(id: number, serverTime: number): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(id));
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft;
    // Only changes made after the last save on the server are worth offering back.
    if (!draft || !(draft.at > serverTime + 1500) || !draft.geometry) return null;
    // A draft kept before pins had names has none.
    return { ...draft, geometry: { ...draft.geometry, pinLabel: draft.geometry.pinLabel ?? "" } };
  } catch {
    return null;
  }
}

const modes: { id: SurveyMode; label: string; icon: LucideIcon }[] = [
  { id: "move", label: "Move", icon: Hand },
  { id: "pin", label: "Pin", icon: MapPin },
  { id: "boundary", label: "Boundary", icon: PencilRuler },
  { id: "measure", label: "Measure", icon: Ruler },
  { id: "point", label: "Point", icon: Target },
];

const hints: Record<SurveyMode, string> = {
  move: "Drag the map to look around. Pick a tool to start marking.",
  pin: "Tap the map where the property is, or stand on it and use your location. This one pin is the property's location on the website.",
  boundary: "Walk to each corner and add it from your location, or tap the corners on the satellite image.",
  measure: "Tap two places to measure the distance between them. Tap a corner, a point or the pin to measure from exactly there.",
  point: "Tap to mark something worth noting, such as a borewell or the entrance.",
};

/** Turns every corner around the middle of the plot. Positive angles turn clockwise. */
function rotate(corners: SurveyCorner[], degrees: number): SurveyCorner[] {
  if (corners.length < 2 || !degrees) return corners;
  const origin = centroid(corners);
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const turned = toLocalMetres(corners, origin).map((p) => ({ x: p.x * cos + p.y * sin, y: -p.x * sin + p.y * cos }));
  return fromLocalMetres(turned, origin).map((p, i) => ({ ...corners[i], lat: Number(p.lat.toFixed(7)), lng: Number(p.lng.toFixed(7)), src: "map" as const, acc: null }));
}

export default function SurveyTool({ survey, target, targets, regions, defaultPrefix, centre }: SurveyToolProps) {
  const router = useRouter();
  const gps = useGps();
  const mapApi = useRef<SurveyMapApi | null>(null);

  const [geometry, setGeometry] = useState<SurveyGeometry>(survey.geometry);
  const [title, setTitle] = useState(survey.title);
  const [notes, setNotes] = useState(survey.notes);
  const [mode, setMode] = useState<SurveyMode>(survey.geometry.corners.length || survey.geometry.pin ? "move" : "pin");
  const [layer, setLayer] = useState<"satellite" | "map">("satellite");
  const [selected, setSelected] = useState<number | null>(null);
  const [pending, setPending] = useState<LatLng | null>(null);
  const [open, setOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [message, setMessage] = useState<{ tone: "error" | "success" | "info"; text: string } | null>(null);
  const [sampling, setSampling] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(() => readDraft(survey.id, survey.updatedAt));
  // Width and depth are held in feet, whichever unit they are typed in.
  const [rect, setRect] = useState<{ width: number | null; depth: number | null; bearing: string }>({ width: 30, depth: 40, bearing: "0" });
  const unit = useLengthUnit();
  const [turn, setTurn] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInput = useRef<HTMLInputElement | null>(null);
  const [busy, startBusy] = useTransition();

  const history = useRef<SurveyGeometry[]>([]);
  const turnBase = useRef<SurveyCorner[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ geometry, title, notes });
  const saving = useRef(false);
  const again = useRef(false);

  useEffect(() => {
    latest.current = { geometry, title, notes };
  });

  const summary = useMemo(() => summariseSurvey(geometry.corners), [geometry.corners]);
  const middle = useMemo(() => surveyCentre(geometry), [geometry]);
  // What the pin is called when no name has been typed for it: the listing it belongs to.
  const pinDefault = target?.refText ?? title.trim();

  // ---------------------------------------------------------------- saving

  const persist = useCallback(async () => {
    if (saving.current) {
      again.current = true;
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSaveState("offline");
      return;
    }
    saving.current = true;
    setSaveState("saving");
    const snapshot = latest.current;
    try {
      const result = await saveSurvey(survey.id, snapshot);
      if (result.ok) {
        try {
          localStorage.removeItem(draftKey(survey.id));
        } catch {
          // Storage can be unavailable in private browsing.
        }
        setSaveState(again.current ? "dirty" : "saved");
      } else {
        setSaveState("error");
        setMessage({ tone: "error", text: result.error });
      }
    } catch {
      // The request never reached the server. The work is still in the draft on this phone.
      setSaveState("offline");
    } finally {
      saving.current = false;
      if (again.current) {
        again.current = false;
        void persist();
      }
    }
  }, [survey.id]);

  /** Records that something changed: keeps a copy on the device and schedules a save. */
  const touch = useCallback(
    (next: { geometry?: SurveyGeometry; title?: string; notes?: string }) => {
      const state = { ...latest.current, ...next };
      latest.current = state;
      try {
        localStorage.setItem(draftKey(survey.id), JSON.stringify({ ...state, at: Date.now() } satisfies Draft));
      } catch {
        // No storage: the scheduled save below still runs.
      }
      setSaveState("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void persist();
      }, 2500);
    },
    [persist, survey.id],
  );

  useEffect(() => {
    const online = () => {
      if (timer.current) clearTimeout(timer.current);
      void persist();
    };
    const leaving = (e: BeforeUnloadEvent) => {
      if (saving.current || timer.current) e.preventDefault();
    };
    window.addEventListener("online", online);
    window.addEventListener("beforeunload", leaving);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("beforeunload", leaving);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [persist]);

  const saveNow = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    void persist();
  };

  // ---------------------------------------------------------------- editing

  const update = useCallback(
    (next: SurveyGeometry, record = true) => {
      if (record) {
        history.current.push(latest.current.geometry);
        if (history.current.length > 60) history.current.shift();
        setCanUndo(true);
      }
      setGeometry(next);
      touch({ geometry: next });
    },
    [touch],
  );

  const undo = () => {
    const previous = history.current.pop();
    if (!previous) return;
    setCanUndo(history.current.length > 0);
    setSelected(null);
    setPending(null);
    setGeometry(previous);
    touch({ geometry: previous });
  };

  /** Brings in a plot drawn in Google Earth, for when it could not be walked with the phone. */
  const importEarth = async (file: File | undefined) => {
    if (!file) return;
    setImporting(true);
    try {
      const found = await readEarthFile(file);
      update(mergeImport(latest.current.geometry, found));
      setSelected(null);
      setPending(null);
      setMode("move");
      setMessage({ tone: "success", text: `Imported ${describeImport(found)} from ${file.name}. Undo puts back what was there before.` });
      // On a phone the panel covers most of the map: fold it away so the plot can be seen.
      setOpen(false);
      setTimeout(() => mapApi.current?.fit(), 350);
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof EarthFileError ? error.message : "That file could not be read. Save the drawing from Google Earth as KML or KMZ and try again." });
    } finally {
      setImporting(false);
      if (importInput.current) importInput.current.value = "";
    }
  };

  const chooseMode = (next: SurveyMode) => {
    setMode(next);
    setPending(null);
    setSelected(null);
    setMessage(null);
    turnBase.current = null;
    setTurn(0);
    if (next !== "move" && gps.status === "off") gps.start();
  };

  const onTap = useCallback(
    (p: LatLng) => {
      const g = latest.current.geometry;
      if (mode === "pin") update({ ...g, pin: p, accuracyM: null });
      else if (mode === "boundary") {
        update({ ...g, corners: [...g.corners, { ...p, src: "map", lenFt: null }] });
        setSelected(g.corners.length);
      } else if (mode === "measure") {
        if (!pending) setPending(p);
        else {
          update({ ...g, measures: [...g.measures, { id: shortId(), a: pending, b: p, label: "", lenFt: null }] });
          setPending(null);
          setOpen(true);
        }
      } else if (mode === "point") {
        update({ ...g, points: [...g.points, { id: shortId(), label: "", ...p }] });
        setOpen(true);
      } else setSelected(null);
    },
    [mode, pending, update],
  );

  /** Stands still for a few seconds, averages the GPS readings and hands back the position. */
  const readPosition = async (what: string): Promise<{ lat: number; lng: number; acc: number } | null> => {
    setMessage(null);
    setSampling(`Reading GPS for ${what}. Hold still`);
    const fix = await gps.sample((n) => setSampling(`Reading GPS for ${what}. Hold still (${n})`));
    setSampling(null);
    if (!fix) {
      setMessage({
        tone: "error",
        text: gps.status === "denied" ? "Location permission was refused. Allow it for this site in the browser settings." : "No GPS reading arrived. Step into the open, away from buildings and trees, and try again.",
      });
      return null;
    }
    const out = { lat: Number(fix.lat.toFixed(7)), lng: Number(fix.lng.toFixed(7)), acc: Math.round(fix.acc * 10) / 10 };
    if (out.acc > 12) setMessage({ tone: "info", text: `Marked, but the GPS is only accurate to about ${Math.round(out.acc)} m here. Check the position against the satellite image.` });
    mapApi.current?.flyTo(out);
    return out;
  };

  const addFromGps = async () => {
    const g0 = latest.current.geometry;
    if (mode === "pin") {
      const p = await readPosition("the pin");
      if (p) update({ ...latest.current.geometry, pin: { lat: p.lat, lng: p.lng }, accuracyM: p.acc });
    } else if (mode === "boundary") {
      const p = await readPosition(`corner ${cornerLabel(g0.corners.length)}`);
      if (p) {
        const g = latest.current.geometry;
        update({ ...g, corners: [...g.corners, { lat: p.lat, lng: p.lng, acc: p.acc, src: "gps", lenFt: null }] });
        setSelected(g.corners.length);
      }
    } else if (mode === "point") {
      const p = await readPosition("the point");
      if (p) {
        const g = latest.current.geometry;
        update({ ...g, points: [...g.points, { id: shortId(), label: "", lat: p.lat, lng: p.lng }] });
        setOpen(true);
      }
    } else if (mode === "measure") {
      const p = await readPosition("the measurement");
      if (!p) return;
      const here = { lat: p.lat, lng: p.lng };
      if (!pending) setPending(here);
      else {
        const g = latest.current.geometry;
        update({ ...g, measures: [...g.measures, { id: shortId(), a: pending, b: here, label: "", lenFt: null }] });
        setPending(null);
        setOpen(true);
      }
    }
  };

  const locate = () => {
    gps.start();
    if (gps.fix) mapApi.current?.flyTo(gps.fix);
  };

  const placeRectangle = () => {
    const width = rect.width;
    const depth = rect.depth;
    if (!width || !depth) {
      setMessage({ tone: "error", text: "Enter the width and the depth." });
      return;
    }
    const g = latest.current.geometry;
    // Start from the pin if there is one, otherwise from whatever the map is looking at.
    const anchor = g.pin ?? mapApi.current?.centre() ?? centre;
    const bearing = Number(rect.bearing) || 0;
    const corners = rectangleCorners(anchor, width, depth, bearing).map((c, i) => ({
      lat: Number(c.lat.toFixed(7)),
      lng: Number(c.lng.toFixed(7)),
      src: "map" as const,
      lenFt: i % 2 === 0 ? width : depth,
    }));
    update({ ...g, corners });
    setSelected(null);
    setTurn(0);
    turnBase.current = null;
    setMessage({ tone: "info", text: "Rectangle placed. Drag the square handle in its middle to move it, and use the slider to turn it until it lines up with the road." });
    // On a phone the panel covers most of the map: fold it away so the plot can be seen and moved.
    setOpen(false);
    setTimeout(() => mapApi.current?.fit(), 350);
  };

  const onTurn = (value: number) => {
    const g = latest.current.geometry;
    if (!turnBase.current) {
      turnBase.current = g.corners;
      history.current.push(g);
      setCanUndo(true);
    }
    setTurn(value);
    update({ ...g, corners: rotate(turnBase.current, value) }, false);
  };

  const removeCorner = (index: number) => {
    const g = latest.current.geometry;
    const corners = g.corners.filter((_, i) => i !== index);
    // The side that ended at the removed corner no longer exists as measured.
    const before = (index - 1 + corners.length) % Math.max(corners.length, 1);
    if (corners[before]) corners[before] = { ...corners[before], lenFt: null };
    update({ ...g, corners });
    setSelected(null);
  };

  const setSideLength = (index: number, feet: number | null) => {
    const g = latest.current.geometry;
    update({ ...g, corners: g.corners.map((c, i) => (i === index ? { ...c, lenFt: feet } : c)) });
  };

  // ---------------------------------------------------------------- listing

  const [targetKey, setTargetKey] = useState(target?.key ?? "");
  const act = (run: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) =>
    startBusy(async () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      await persist();
      const result = await run();
      setMessage(result.ok ? { tone: "success", text: result.message ?? "Done." } : { tone: "error", text: result.error });
      if (result.ok) router.refresh();
    });

  const [createState, createAction, creating] = useActionState<ActionState, FormData>(createPropertyFromSurvey.bind(null, survey.id), undefined);
  const uploadPhotos = useMemo(() => uploadSurveyPhotos.bind(null, survey.id), [survey.id]);
  const removePhoto = useMemo(() => removeSurveyPhoto.bind(null, survey.id), [survey.id]);

  const status: Record<SaveState, { text: string; icon: LucideIcon; tone: string }> = {
    saved: { text: "Saved", icon: Check, tone: "text-success-700" },
    dirty: { text: "Unsaved", icon: Save, tone: "text-warning-700" },
    saving: { text: "Saving", icon: Loader2, tone: "text-ink-600" },
    offline: { text: "Kept on this phone", icon: CloudOff, tone: "text-warning-700" },
    error: { text: "Not saved", icon: CloudOff, tone: "text-danger-700" },
  };
  const Status = status[saveState];
  const gpsLabel =
    gps.status === "on" && gps.fix
      ? `GPS ±${Math.round(gps.fix.acc)} m`
      : gps.status === "searching"
        ? "Finding GPS"
        : gps.status === "denied"
          ? "Location blocked"
          : gps.status === "unavailable"
            ? "No GPS on this device"
            : "GPS off";
  const gpsGood = gps.status === "on" && gps.fix != null && gps.fix.acc <= 8;
  const groups = ["Properties", "Projects", "Sites"] as const;

  // ---------- the pin: where the property is, and the name written on it
  const pinSection = (
    <section>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="label-mono">Pin</h2>
        <span className="text-[11.5px] text-ink-500">the property&apos;s location</span>
      </div>
      {geometry.pin ? (
        <>
          <label htmlFor="pin-name" className="mt-2 block text-[11.5px] font-semibold text-ink-700">
            Name on the pin
          </label>
          <input
            id="pin-name"
            key={geometry.pinLabel}
            defaultValue={geometry.pinLabel}
            onBlur={(e) => {
              const name = e.target.value.trim().slice(0, 60);
              if (name !== latest.current.geometry.pinLabel) update({ ...latest.current.geometry, pinLabel: name });
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            placeholder={pinDefault || "e.g. The site"}
            maxLength={60}
            className="field mt-1 !px-2.5 !py-1.5 text-[13.5px]"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="num text-[13px] text-ink-700">
              {formatCoords(geometry.pin.lat, geometry.pin.lng)}
              {geometry.accuracyM ? <span className="ml-2 text-ink-500">±{Math.round(geometry.accuracyM)} m</span> : null}
            </p>
            <button type="button" onClick={() => update({ ...latest.current.geometry, pin: null, accuracyM: null })} className="text-[13px] font-semibold text-danger-700 hover:underline">
              Remove
            </button>
          </div>
          <p className="mt-2 text-[12.5px] leading-snug text-ink-500">
            {target ? (
              <>
                Saved as the location of <span className="num font-semibold text-ink-700">{target.refText}</span>: this is where the website shows it. {geometry.pinLabel ? "" : `Leave the name blank and the pin reads ${target.refText}. `}Drag the pin to move it.
              </>
            ) : (
              "When this survey is attached to a listing, this pin becomes the listing's location. Drag the pin to move it."
            )}
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-[12.5px] leading-snug text-ink-500">
            {geometry.corners.length >= 3
              ? "No pin yet, so the middle of the plot stands in as the location. Drop a pin to set the exact spot and give it a name."
              : target
                ? `No pin yet. ${target.refText} has no location, and no map on the website, until it has one.`
                : "No pin yet. Choose the Pin tool and tap the map where the property is."}
          </p>
          {geometry.corners.length >= 3 ? (
            <button
              type="button"
              onClick={() => {
                const c = centroid(latest.current.geometry.corners);
                update({ ...latest.current.geometry, pin: { lat: Number(c.lat.toFixed(7)), lng: Number(c.lng.toFixed(7)) }, accuracyM: null });
              }}
              className="btn-outline btn-sm mt-2.5"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" /> Put the pin in the middle of the plot
            </button>
          ) : null}
        </>
      )}
    </section>
  );

  return (
    <div className="flex h-dvh flex-col bg-paper-100 lg:h-dvh lg:flex-row">
      {/* ------------------------------------------------ map */}
      <div className="relative min-h-0 flex-1">
        <SurveyMap
          geometry={geometry}
          mode={mode}
          layer={layer}
          selected={selected}
          gps={gps.fix}
          pending={pending}
          pinTag={geometry.pinLabel || pinDefault}
          initialCentre={centre}
          onTap={onTap}
          onChange={update}
          onSelect={(i) => {
            setSelected(i);
            if (i != null) setOpen(true);
          }}
          onReady={(api) => (mapApi.current = api)}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex items-start justify-between gap-2 p-2.5 sm:p-3">
          <div className="pointer-events-auto flex min-w-0 items-center gap-2 rounded-[3px] bg-navy-900/92 py-1.5 pl-1.5 pr-3 text-paper-50 shadow-card">
            <Link href="/admin/surveys" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[2px] hover:bg-paper-0/10" aria-label="Back to surveys">
              <ArrowLeft className="h-[18px] w-[18px]" />
            </Link>
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-semibold leading-tight">{title || "Untitled survey"}</span>
              <span className="num block truncate text-[11px] leading-tight text-gold-200">{target ? target.refText : "Not attached to a listing"}</span>
            </span>
          </div>
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            <span className={cn("inline-flex items-center gap-1.5 rounded-[3px] bg-paper-0 px-2.5 py-1.5 text-[12px] font-semibold shadow-card", Status.tone)} aria-live="polite">
              <Status.icon className={cn("h-3.5 w-3.5", saveState === "saving" && "animate-spin")} aria-hidden="true" />
              {Status.text}
            </span>
            <span className={cn("num inline-flex items-center gap-1.5 rounded-[3px] bg-paper-0 px-2.5 py-1.5 text-[11.5px] font-medium shadow-card", gpsGood ? "text-success-700" : "text-ink-600")}>
              <span className={cn("h-2 w-2 rounded-full", gps.status === "on" ? (gpsGood ? "bg-success-600" : "bg-warning-600") : "bg-ink-300")} />
              {gpsLabel}
            </span>
          </div>
        </div>

        {/* Under the title: a way to take the map to a place without dragging it there. */}
        <div className="absolute left-2.5 top-[62px] z-[500] sm:left-3 sm:top-[66px]">
          <PlaceSearch onPick={(p) => mapApi.current?.flyTo(p, 18)} />
        </div>

        <div className="absolute bottom-24 right-2.5 z-[500] flex flex-col gap-2 sm:right-3 lg:bottom-28">
          <button type="button" onClick={() => setLayer((l) => (l === "satellite" ? "map" : "satellite"))} className="flex h-11 w-11 items-center justify-center rounded-[3px] bg-paper-0 text-navy-900 shadow-card" aria-label={layer === "satellite" ? "Show the street map" : "Show the satellite image"}>
            <Layers className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => mapApi.current?.fit()} className="flex h-11 w-11 items-center justify-center rounded-[3px] bg-paper-0 text-navy-900 shadow-card" aria-label="Fit the survey in view">
            <Maximize className="h-5 w-5" />
          </button>
          <button type="button" onClick={locate} className={cn("flex h-11 w-11 items-center justify-center rounded-[3px] shadow-card", gps.status === "on" ? "bg-navy-900 text-gold-200" : "bg-paper-0 text-navy-900")} aria-label="Go to my location">
            <LocateFixed className="h-5 w-5" />
          </button>
        </div>

        {sampling ? (
          <div className="absolute inset-x-0 top-24 z-[600] flex justify-center px-4" role="status">
            <span className="inline-flex items-center gap-2 rounded-[3px] bg-navy-900 px-4 py-3 text-[14px] font-semibold text-paper-50 shadow-lift">
              <Loader2 className="h-4 w-4 animate-spin text-gold-300" aria-hidden="true" />
              {sampling}
            </span>
          </div>
        ) : null}

        {/* On a phone the panel folds away after some actions, so the outcome is shown over the map. Tap to dismiss. */}
        {message && !open && !sampling ? (
          <div className="absolute inset-x-0 top-24 z-[600] flex justify-center px-4 lg:hidden">
            <button
              type="button"
              role="status"
              onClick={() => setMessage(null)}
              className={cn("max-w-md rounded-[3px] px-4 py-3 text-left text-[13.5px] font-medium leading-snug text-paper-50 shadow-lift", message.tone === "error" ? "bg-danger-700" : "bg-navy-900")}
            >
              {message.text}
            </button>
          </div>
        ) : null}
      </div>

      {/* ------------------------------------------------ panel */}
      <aside data-survey-panel className={cn("z-[700] flex shrink-0 flex-col border-t border-navy-900/15 bg-paper-0 lg:h-dvh lg:w-[400px] lg:border-l lg:border-t-0", open ? "h-[72dvh]" : "h-auto", "lg:!h-dvh")}>
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex h-7 w-full shrink-0 items-center justify-center text-ink-400 lg:hidden" aria-expanded={open} aria-label={open ? "Show less" : "Show details"}>
          {open ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
        </button>

        <div className="shrink-0 px-3 pb-3 sm:px-4 lg:pt-4">
          <div className="grid grid-cols-5 gap-1 rounded-[3px] bg-paper-100 p-1" role="tablist" aria-label="Tools">
            {modes.map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={mode === m.id}
                onClick={() => chooseMode(m.id)}
                className={cn("flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[2px] text-[11px] font-semibold transition-colors", mode === m.id ? "bg-navy-900 text-gold-200" : "text-ink-600 hover:bg-paper-200")}
              >
                <m.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                {m.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-stretch gap-2">
            {mode === "move" ? (
              <p className="flex-1 self-center text-[13px] leading-snug text-ink-600">{hints.move}</p>
            ) : (
              <button type="button" onClick={addFromGps} disabled={Boolean(sampling) || gps.status === "unavailable"} className="btn-primary flex-1 !px-3">
                <LocateFixed className="h-4 w-4 shrink-0" aria-hidden="true" />
                {mode === "pin" ? "Pin my location" : mode === "boundary" ? `Add corner ${cornerLabel(geometry.corners.length)} here` : mode === "measure" ? (pending ? "End at my location" : "Start at my location") : "Mark my location"}
              </button>
            )}
            <button type="button" onClick={undo} disabled={!canUndo} className="btn-outline !px-3.5" aria-label="Undo">
              <Undo2 className="h-4 w-4" />
            </button>
            <button type="button" onClick={saveNow} disabled={saveState === "saved" || saveState === "saving"} className="btn-outline !px-3.5" aria-label="Save now">
              <Save className="h-4 w-4" />
            </button>
          </div>
          {mode !== "move" ? <p className="mt-2 text-[12.5px] leading-snug text-ink-500">{mode === "measure" && pending ? "Now tap the other end." : hints[mode]}</p> : null}
        </div>

        <div className={cn("min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain border-t border-navy-900/10 px-3 py-4 sm:px-4", !open && "hidden lg:block")}>
          {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

          {draft ? (
            <div className="rounded-[3px] border border-warning-600/30 bg-warning-100 p-3.5 text-[13.5px] text-warning-700">
              <p className="font-semibold">Changes that were never saved are still on this device.</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={() => {
                    history.current.push(latest.current.geometry);
                    setCanUndo(true);
                    setGeometry(draft.geometry);
                    setTitle(draft.title);
                    setNotes(draft.notes);
                    touch({ geometry: draft.geometry, title: draft.title, notes: draft.notes });
                    setDraft(null);
                    setTimeout(() => mapApi.current?.fit(), 50);
                  }}
                >
                  Restore them
                </button>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={() => {
                    try {
                      localStorage.removeItem(draftKey(survey.id));
                    } catch {
                      // Nothing to remove.
                    }
                    setDraft(null);
                  }}
                >
                  Discard
                </button>
              </div>
            </div>
          ) : null}

          {mode === "pin" ? pinSection : null}

          {/* ---------- figures */}
          {summary.areaSqft ? (
            <section>
              <h2 className="label-mono">Measured</h2>
              <dl className="mt-2 grid grid-cols-2 gap-px border border-navy-900/12 bg-navy-900/12">
                <div className="col-span-2 bg-paper-0 px-3.5 py-3">
                  <dt className="text-[11.5px] text-ink-500">Area</dt>
                  <dd className="num mt-0.5 text-[1.5rem] font-semibold leading-tight text-navy-900">{formatNumber(Math.round(summary.areaSqft))} sq ft</dd>
                  <dd className="num mt-1 text-[12px] text-ink-600">
                    {(summary.areaSqft / SQFT_PER_SQM).toFixed(1)} sq m · {convertArea(summary.areaSqft, "guntas").toFixed(2)} guntas · {convertArea(summary.areaSqft, "cents").toFixed(2)} cents · {convertArea(summary.areaSqft, "acres").toFixed(3)} acres
                  </dd>
                </div>
                <div className="bg-paper-0 px-3.5 py-3">
                  <dt className="text-[11.5px] text-ink-500">Perimeter</dt>
                  <dd className="num mt-0.5 text-[15px] font-semibold text-navy-900">{summary.perimeterFt ? formatFeet(summary.perimeterFt) : ""}</dd>
                </div>
                <div className="bg-paper-0 px-3.5 py-3">
                  <dt className="text-[11.5px] text-ink-500">Shape</dt>
                  <dd className="num mt-0.5 text-[15px] font-semibold text-navy-900">{summary.dimension ? `${summary.dimension} ft` : `${geometry.corners.length} corners`}</dd>
                </div>
              </dl>
            </section>
          ) : null}

          {/* ---------- boundary tools */}
          {mode === "boundary" ? (
            <section className="space-y-4">
              <div className="rounded-[3px] border border-navy-900/12 bg-paper-50 p-3.5">
                <p className="flex items-center gap-2 text-[13.5px] font-semibold text-navy-900">
                  <RectangleHorizontal className="h-4 w-4 text-gold-600" aria-hidden="true" /> Regular site
                  <UnitSwitch className="ml-auto" />
                </p>
                <p className="mt-1 text-[12.5px] leading-snug text-ink-600">For a 30 × 40 or similar, this is more exact than walking the corners: phone GPS is off by a few metres, which is a lot on a small plot.</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <label className="text-[11.5px] font-semibold text-ink-700">
                    Width ({unit})
                    <LengthEntry valueFt={rect.width} onChangeFt={(feet) => setRect((r) => ({ ...r, width: feet }))} className="field num mt-1 !px-2.5 !py-2" />
                  </label>
                  <label className="text-[11.5px] font-semibold text-ink-700">
                    Depth ({unit})
                    <LengthEntry valueFt={rect.depth} onChangeFt={(feet) => setRect((r) => ({ ...r, depth: feet }))} className="field num mt-1 !px-2.5 !py-2" />
                  </label>
                  <label className="text-[11.5px] font-semibold text-ink-700">
                    Frontage runs
                    <select value={rect.bearing} onChange={(e) => setRect((r) => ({ ...r, bearing: e.target.value }))} className="field mt-1 !py-2 !pl-2.5 text-[13px]">
                      <option value="0">North</option>
                      <option value="45">North-East</option>
                      <option value="90">East</option>
                      <option value="135">South-East</option>
                      <option value="180">South</option>
                      <option value="225">South-West</option>
                      <option value="270">West</option>
                      <option value="315">North-West</option>
                    </select>
                  </label>
                </div>
                <button type="button" onClick={placeRectangle} className="btn-outline btn-sm mt-3">
                  {geometry.corners.length ? "Replace the boundary with this" : "Place it on the map"}
                </button>
              </div>

              {geometry.corners.length >= 3 ? (
                <div>
                  <label htmlFor="turn" className="flex items-center justify-between text-[12.5px] font-semibold text-ink-700">
                    <span className="inline-flex items-center gap-1.5">
                      <RotateCw className="h-3.5 w-3.5 text-gold-600" aria-hidden="true" /> Turn the plot
                    </span>
                    <span className="num text-ink-500">{turn > 0 ? "+" : ""}{turn}°</span>
                  </label>
                  <input
                    id="turn"
                    type="range"
                    min={-180}
                    max={180}
                    step={0.5}
                    value={turn}
                    onChange={(e) => onTurn(Number(e.target.value))}
                    onPointerUp={() => {
                      turnBase.current = null;
                      setTurn(0);
                    }}
                    onKeyUp={() => {
                      turnBase.current = null;
                      setTurn(0);
                    }}
                    className="mt-2 w-full accent-navy-800"
                  />
                </div>
              ) : null}

              {selected != null && geometry.corners[selected] ? (
                <div className="flex items-center justify-between gap-3 rounded-[3px] border border-navy-900/12 px-3.5 py-2.5">
                  <p className="text-[13px] text-ink-700">
                    Corner <span className="num font-semibold text-navy-900">{cornerLabel(selected)}</span>
                    <span className="num ml-2 text-[11.5px] text-ink-500">
                      {geometry.corners[selected].src === "gps" ? `GPS ±${Math.round(geometry.corners[selected].acc ?? 0)} m` : "placed on the map"}
                    </span>
                  </p>
                  <button type="button" onClick={() => removeCorner(selected)} className="btn-danger btn-sm">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remove
                  </button>
                </div>
              ) : null}

              {geometry.corners.length ? (
                <button type="button" onClick={() => update({ ...latest.current.geometry, corners: [] })} className="text-[13px] font-semibold text-danger-700 hover:underline">
                  Clear the whole boundary
                </button>
              ) : null}
            </section>
          ) : null}

          {/* ---------- sides */}
          {summary.sides.length ? (
            <section>
              <div className="flex items-center justify-between gap-2">
                <h2 className="label-mono">Sides</h2>
                <UnitSwitch />
              </div>
              <p className="mt-1 text-[12.5px] leading-snug text-ink-500">
                GPS is only good to a few feet. Type the true length of each side from your tape or the title deed, and that is the figure the website shows. Drag a corner on the map to correct the shape.
              </p>
              <ul className="mt-2 divide-y divide-navy-900/8 border-y border-navy-900/10">
                {summary.sides.map((s) => (
                  <li key={s.index} className="grid grid-cols-[3.5rem_1fr_6.5rem] items-center gap-2 py-2">
                    <span className="num text-[13px] font-semibold text-navy-900">
                      {s.from}
                      <span className="text-ink-300"> → </span>
                      {s.to}
                    </span>
                    <span className="num text-[12.5px] text-ink-500">map {unit === "m" ? `${fromFeet(s.gpsFt, "m")} m` : formatFeet(s.gpsFt)}</span>
                    <LengthEntry
                      valueFt={s.measuredFt}
                      onCommitFt={(feet) => setSideLength(s.index, feet)}
                      placeholder={`taped ${unit}`}
                      aria-label={`Measured length of side ${s.from} to ${s.to}`}
                      className="field num !px-2.5 !py-1.5 text-right text-[13.5px]"
                    />
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[12.5px] leading-snug text-ink-500">
                The area the website shows is the Area box on the listing itself. Correct it there if the deed gives a different figure.{" "}
                {target ? (
                  <Link href={target.href} className="font-semibold text-navy-800 underline decoration-gold-500 decoration-2 underline-offset-2">
                    Open {target.refText}
                  </Link>
                ) : null}
              </p>
            </section>
          ) : null}

          {mode === "pin" ? null : pinSection}

          {/* ---------- measurements */}
          {geometry.measures.length ? (
            <section>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="label-mono">Measurements</h2>
                <span className="text-[11.5px] text-ink-500">distances, in metres</span>
              </div>
              <ul className="mt-2 space-y-2">
                {geometry.measures.map((m) => (
                  <li key={m.id} className="grid grid-cols-[1fr_5.5rem_2.5rem] items-center gap-2">
                    <input
                      defaultValue={m.label}
                      onBlur={(e) => e.target.value.trim() !== m.label && update({ ...latest.current.geometry, measures: latest.current.geometry.measures.map((k) => (k.id === m.id ? { ...k, label: e.target.value.trim().slice(0, 80) } : k)) })}
                      placeholder="Where does it go? e.g. Main road"
                      aria-label="Name of the measurement"
                      className="field !px-2.5 !py-1.5 text-[13.5px]"
                    />
                    <MetresEntry
                      valueFt={m.lenFt ?? null}
                      onCommitFt={(feet) => update({ ...latest.current.geometry, measures: latest.current.geometry.measures.map((k) => (k.id === m.id ? { ...k, lenFt: feet } : k)) })}
                      placeholder={formatMetres(measureFt(m))}
                      aria-label="Measured distance in metres"
                      className="field num !px-2.5 !py-1.5 text-right text-[13.5px]"
                    />
                    <button type="button" onClick={() => update({ ...latest.current.geometry, measures: latest.current.geometry.measures.filter((k) => k.id !== m.id) })} className="flex h-9 w-9 items-center justify-center rounded-[3px] text-danger-700 hover:bg-danger-100" aria-label="Remove this measurement">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* ---------- points */}
          {geometry.points.length ? (
            <section>
              <h2 className="label-mono">Points</h2>
              <ul className="mt-2 space-y-2">
                {geometry.points.map((p) => (
                  <li key={p.id} className="grid grid-cols-[1fr_2.5rem] items-center gap-2">
                    <input
                      defaultValue={p.label}
                      onBlur={(e) => e.target.value.trim() !== p.label && update({ ...latest.current.geometry, points: latest.current.geometry.points.map((k) => (k.id === p.id ? { ...k, label: e.target.value.trim().slice(0, 80) } : k)) })}
                      placeholder="What is here? e.g. Borewell"
                      aria-label="Name of the point"
                      className="field !px-2.5 !py-1.5 text-[13.5px]"
                    />
                    <button type="button" onClick={() => update({ ...latest.current.geometry, points: latest.current.geometry.points.filter((k) => k.id !== p.id) })} className="flex h-9 w-9 items-center justify-center rounded-[3px] text-danger-700 hover:bg-danger-100" aria-label="Remove this point">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* ---------- details */}
          <section className="space-y-3">
            <h2 className="label-mono">Details</h2>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                touch({ title: e.target.value });
              }}
              placeholder="Name of this survey"
              maxLength={140}
              aria-label="Name of this survey"
              className="field"
            />
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                touch({ notes: e.target.value });
              }}
              rows={3}
              maxLength={4000}
              placeholder="Notes from the site: owner's name, missing boundary stones, neighbours, access"
              aria-label="Notes"
              className="field text-[14px]"
            />
          </section>

          <section>
            <h2 className="label-mono mb-2">Photos from the site</h2>
            <PhotoManager images={survey.photos} uploadAction={uploadPhotos} removeAction={removePhoto} field="photos" hint="Taken on site. They move to the listing when you create a property from this survey." />
          </section>

          {/* ---------- listing */}
          <section className="space-y-3">
            <h2 className="label-mono">Listing</h2>
            {target ? (
              <p className="text-[13.5px] text-ink-700">
                Attached to{" "}
                <Link href={target.href} className="font-semibold text-navy-900 underline decoration-gold-500 decoration-2 underline-offset-4">
                  <span className="num">{target.refText}</span> {target.label}
                </Link>
              </p>
            ) : (
              <p className="text-[13.5px] text-ink-600">Not attached yet. Attach it to a listing, or make a new property from it.</p>
            )}
            <div className="flex gap-2">
              <select value={targetKey} onChange={(e) => setTargetKey(e.target.value)} className="field min-w-0 flex-1 text-[13.5px]" aria-label="Listing to attach to">
                <option value="">No listing</option>
                {groups.map((g) => (
                  <optgroup key={g} label={g}>
                    {targets
                      .filter((t) => t.group === g)
                      .map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.refText} · {t.label}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              <button type="button" disabled={busy || targetKey === (target?.key ?? "")} onClick={() => act(() => attachSurvey(survey.id, targetKey))} className="btn-outline btn-sm shrink-0">
                {targetKey ? "Attach" : "Detach"}
              </button>
            </div>
            {target ? (
              // The location needs no button: the listing follows the pin. A whole layout has no size to copy.
              target.key.startsWith("project:") || !summary.areaSqft ? null : (
                <button type="button" disabled={busy} onClick={() => act(() => copySurveySizeToListing(survey.id))} className="btn-primary btn-sm">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                  Copy the area and dimension to the listing
                </button>
              )
            ) : (
              <ActionForm action={createAction} pending={creating} className="space-y-2.5 rounded-[3px] border border-navy-900/12 bg-paper-50 p-3.5">
                <p className="text-[13.5px] font-semibold text-navy-900">Make a new property from this survey</p>
                <FormStatus state={createState} />
                <input name="title" defaultValue={title} placeholder="Title, e.g. Corner site near Dairy Circle" maxLength={140} aria-label="Title" className="field text-[14px]" />
                {regions.length > 1 ? (
                  <select name="prefix" defaultValue={defaultPrefix} aria-label="District" className="field text-[13.5px]">
                    {regions.map((r) => (
                      <option key={r.code} value={r.code}>
                        {regionLabel(r)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input type="hidden" name="prefix" value={defaultPrefix} />
                )}
                <div className="grid grid-cols-2 gap-2">
                  <select name="type" defaultValue="residential_site" aria-label="Type" className="field text-[13.5px]">
                    {PROPERTY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {en.types[t]}
                      </option>
                    ))}
                  </select>
                  <input name="location" placeholder="Locality" maxLength={200} aria-label="Locality" className="field text-[14px]" />
                </div>
                <p className="text-[12px] leading-snug text-ink-500">It is created as a draft with the next property number. Save the survey first if the badge above says Unsaved.</p>
                <SubmitButton className="btn-sm">Create the property</SubmitButton>
              </ActionForm>
            )}
          </section>

          {/* ---------- import */}
          <section className="space-y-2.5">
            <h2 className="label-mono">Drawn in Google Earth?</h2>
            <p className="text-[12.5px] leading-snug text-ink-500">
              If the plot could not be walked with the phone, draw a polygon around it in Google Earth, save it as KML or KMZ and bring the file in here. The polygon becomes the boundary, paths become measurements and pins become points.
            </p>
            <input
              ref={importInput}
              type="file"
              accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz"
              className="sr-only"
              tabIndex={-1}
              aria-label="Google Earth file to import"
              onChange={(e) => void importEarth(e.target.files?.[0])}
            />
            <button type="button" disabled={importing} onClick={() => importInput.current?.click()} className="btn-outline btn-sm w-full !justify-start">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
              Import a KML or KMZ file
            </button>
          </section>

          {/* ---------- export */}
          <section className="space-y-2.5">
            <h2 className="label-mono">Take it further</h2>
            <p className="text-[12.5px] leading-snug text-ink-500">Save first. The files below are made from the last saved version.</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <a href={`/admin/surveys/${survey.id}/export?format=kml`} className={cn("btn-outline btn-sm !justify-start", !middle && "pointer-events-none opacity-50")}>
                <Download className="h-4 w-4" aria-hidden="true" /> KML for Google Earth
              </a>
              <a href={middle ? googleEarthLink(middle.lat, middle.lng) : "#"} target="_blank" rel="noopener noreferrer" className={cn("btn-outline btn-sm !justify-start", !middle && "pointer-events-none opacity-50")}>
                <Globe className="h-4 w-4" aria-hidden="true" /> Open Google Earth here
              </a>
              <a href={`/admin/surveys/${survey.id}/export?format=geojson`} className={cn("btn-ghost btn-sm !justify-start !px-3.5", !middle && "pointer-events-none opacity-50")}>
                <Download className="h-4 w-4" aria-hidden="true" /> GeoJSON
              </a>
              <Link href={`/admin/surveys/${survey.id}/reel`} className={cn("btn-gold btn-sm !justify-start", geometry.corners.length < 3 && "pointer-events-none opacity-50")}>
                <Clapperboard className="h-4 w-4" aria-hidden="true" /> Make a video reel
              </Link>
            </div>
            <p className="text-[12.5px] leading-snug text-ink-500">
              In Google Earth on a computer, open the menu, choose <span className="font-semibold text-ink-700">File</span>, then <span className="font-semibold text-ink-700">Import KML file</span>, and pick the downloaded file. The plot appears with every side length, ready for more measuring.
            </p>
          </section>

          <section className="border-t border-navy-900/10 pt-4">
            <ConfirmButton action={deleteSurvey.bind(null, survey.id)} label="Delete this survey" confirmLabel="Yes, delete it" />
          </section>
        </div>
      </aside>
    </div>
  );
}
