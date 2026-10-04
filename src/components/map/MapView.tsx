"use client";

import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { Maximize2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LatLng, ListingStatus } from "@/lib/db/enums";
import { centroid, midpoint } from "@/lib/geo";
import { SATELLITE_TILES, STREET_TILES } from "@/lib/tiles";
import { cn } from "@/lib/utils";

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  sub?: string;
  href?: string;
  linkText?: string;
  status?: ListingStatus;
  kind?: "main" | "listing" | "landmark" | "point";
  /** A name kept on show above the pin, rather than only when it is pointed at. */
  tag?: string;
};

export type MapPlot = {
  id: string;
  corners: LatLng[];
  label?: string;
  status?: ListingStatus;
  href?: string;
  linkText?: string;
  /** The plot this page is about: drawn in gold and with its side lengths. */
  active?: boolean;
  /** One label per side, for example "40 ft". Only drawn for the active plot. */
  sideLabels?: string[];
  /** Draws a dashed boundary with no fill, for the outer edge of a whole layout. */
  outline?: boolean;
};

/** A line on the map. `label` is written along it; `endLabel` names the place it runs to and sits on end `b`. */
export type MapLine = { id: string; a: LatLng; b: LatLng; label?: string; endLabel?: string; dashed?: boolean };

export type MapViewProps = {
  pins?: MapPin[];
  plots?: MapPlot[];
  lines?: MapLine[];
  base?: "map" | "satellite";
  toggle?: boolean;
  /** `interact` invites a phone visitor to open the map; `close` and `expand` name the full-screen buttons. */
  labels: { map: string; satellite: string; interact: string; close?: string; expand?: string };
  /** What the opening view frames. Landmarks can be far away, so "focus" leaves them out. */
  fit?: "focus" | "all";
  maxFitZoom?: number;
  /** How far in a visitor can zoom. Past the imagery's own detail the picture only gets softer. */
  maxZoom?: number;
  className?: string;
};

const statusColour: Record<ListingStatus, string> = { available: "#1f7a4f", reserved: "#a66a00", sold: "#566175" };
const GOLD = "#d7b56d";
const NAVY = "#0d1a2d";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function pinHtml(pin: MapPin): { html: string; size: [number, number]; anchor: [number, number] } {
  if (pin.kind === "landmark") {
    return {
      html: `<div style="width:12px;height:12px;border-radius:2px;background:#fff;border:2px solid ${NAVY};box-shadow:0 1px 3px rgba(0,0,0,.35)"></div>`,
      size: [12, 12],
      anchor: [6, 6],
    };
  }
  if (pin.kind === "point") {
    return {
      html: `<div style="width:12px;height:12px;border-radius:999px;background:${GOLD};border:2px solid ${NAVY};box-shadow:0 1px 3px rgba(0,0,0,.35)"></div>`,
      size: [12, 12],
      anchor: [6, 6],
    };
  }
  if (pin.kind === "listing") {
    const c = statusColour[pin.status ?? "available"];
    return {
      html: `<div style="width:18px;height:18px;border-radius:999px;background:${c};border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
      size: [18, 18],
      anchor: [9, 9],
    };
  }
  return {
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44"><path d="M17 43c6.5-9.5 15-17 15-26A15 15 0 0 0 2 17c0 9 8.5 16.5 15 26Z" fill="${NAVY}" stroke="${GOLD}" stroke-width="2"/><rect x="11.5" y="11.5" width="11" height="11" fill="${GOLD}"/></svg>`,
    size: [34, 44],
    anchor: [17, 43],
  };
}

function popupHtml(title: string, sub?: string, href?: string, linkText?: string): string {
  return (
    `<strong style="font-family:var(--font-mono);font-weight:600;letter-spacing:.04em">${esc(title)}</strong>` +
    (sub ? `<br/><span>${esc(sub)}</span>` : "") +
    (href ? `<br/><a href="${esc(href)}">${esc(linkText ?? "Open")} &rarr;</a>` : "")
  );
}

export default function MapView({ pins = [], plots = [], lines = [], base = "map", toggle = true, labels, fit = "focus", maxFitZoom = 19, maxZoom = 20, className }: MapViewProps) {
  // The map's place on the page, and its place in the full-screen view.
  const holder = useRef<HTMLDivElement | null>(null);
  const fullSlot = useRef<HTMLDivElement | null>(null);
  const cover = useRef<HTMLButtonElement | null>(null);
  // Leaflet lives in an element of its own, outside React's, so it can move between the two
  // without being rebuilt: the view, the tiles already loaded and any open label all come along.
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const tilesRef = useRef<Leaflet.TileLayer | null>(null);
  const featuresRef = useRef<Leaflet.LayerGroup | null>(null);
  const fittedRef = useRef("");
  const pushed = useRef(false);
  const [layer, setLayer] = useState<"map" | "satellite">(base);
  const [ready, setReady] = useState(false);
  // A phone scrolls past the map on the page; one tap opens it full screen, where one finger
  // moves it and two fingers pinch, as in a maps app. A mouse uses the map where it stands.
  const [touch, setTouch] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let map: Leaflet.Map | null = null;
    const el = document.createElement("div");
    el.className = "h-full w-full";
    holder.current?.appendChild(el);
    mapEl.current = el;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled) return;
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      map = L.map(el, {
        // Phones pinch and double-tap instead of pressing buttons.
        zoomControl: !coarse,
        scrollWheelZoom: false,
        maxZoom,
        // Zoom settles wherever the fingers or the wheel leave it, rather than jumping to a step.
        zoomSnap: 0,
        zoomDelta: 1,
        wheelPxPerZoomLevel: 90,
        bounceAtZoomLimits: false,
        dragging: !coarse,
        touchZoom: !coarse,
        doubleClickZoom: !coarse,
        boxZoom: false,
        attributionControl: true,
      });
      map.attributionControl.setPrefix(false);
      map.setView([13.0033, 76.1004], 13);
      leafletRef.current = L;
      mapRef.current = map;
      featuresRef.current = L.layerGroup().addTo(map);
      // The wheel zooms the map towards the pointer, once the pointer has come to rest on it or
      // the map has been clicked. While the page is being scrolled the wheel keeps turning, so
      // the map lets the page go by instead of swallowing the scroll.
      let rest: ReturnType<typeof setTimeout> | null = null;
      const arm = () => {
        if (rest) clearTimeout(rest);
        rest = setTimeout(() => map?.scrollWheelZoom.enable(), 250);
      };
      el.addEventListener("mouseenter", arm);
      el.addEventListener("wheel", () => map && !map.scrollWheelZoom.enabled() && arm(), { passive: true });
      el.addEventListener("mousedown", () => map?.scrollWheelZoom.enable());
      el.addEventListener("mouseleave", () => {
        if (rest) clearTimeout(rest);
        rest = null;
        map?.scrollWheelZoom.disable();
      });
      // The current zoom, readable from the page for checks.
      map.on("zoomend", () => {
        if (map) el.dataset.zoom = map.getZoom().toFixed(2);
      });
      setTouch(coarse);
      setReady(true);
    })();
    return () => {
      cancelled = true;
      map?.remove();
      el.remove();
      mapEl.current = null;
      mapRef.current = null;
      featuresRef.current = null;
      tilesRef.current = null;
      fittedRef.current = "";
    };
    // maxZoom is fixed for the life of a map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Base imagery. Tiles keep loading while the map is dragged, a wider ring of them is held
  // ready around the view, and none are fetched halfway through a pinch, which is what made
  // moving the map feel sticky on a phone.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    const source = layer === "satellite" ? SATELLITE_TILES : STREET_TILES;
    tilesRef.current?.remove();
    tilesRef.current = L.tileLayer(source.url, {
      attribution: source.attribution,
      maxNativeZoom: source.maxNativeZoom,
      maxZoom,
      subdomains: source.subdomains ?? "abc",
      updateWhenIdle: false,
      updateWhenZooming: false,
      keepBuffer: 4,
    }).addTo(map);
    tilesRef.current.bringToBack();
  }, [layer, ready, maxZoom]);

  const pinsKey = JSON.stringify(pins);
  const plotsKey = JSON.stringify(plots);
  const linesKey = JSON.stringify(lines);

  // Features and the opening view.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const group = featuresRef.current;
    if (!ready || !L || !map || !group) return;
    group.clearLayers();
    const onImagery = layer === "satellite";
    const focus: [number, number][] = [];
    const everything: [number, number][] = [];
    const hasActive = plots.some((p) => p.active);
    // Length labels, each with the two ends of the line it describes.
    const labels: { marker: Leaflet.Marker; a: LatLng; b: LatLng; text: string; set?: string }[] = [];
    // The property's pin and the name on it. A length that would sit under them is left out.
    const pinned: Leaflet.Marker[] = [];
    const label = (text: string, p: LatLng, q: LatLng, set?: string) => {
      const mid = midpoint(p, q);
      const marker = L.marker([mid.lat, mid.lng], { icon: L.divIcon({ className: "rsp-marker", html: "", iconSize: [0, 0] }), interactive: false, keyboard: false }).bindTooltip(text, {
        permanent: true,
        direction: "center",
        className: onImagery ? "rsp-dim" : "rsp-dim rsp-dim-light",
      });
      labels.push({ marker, a: p, b: q, text, set });
    };

    for (const plot of plots) {
      if (plot.corners.length < 3) continue;
      const ring = plot.corners.map((c) => [c.lat, c.lng] as [number, number]);
      if (plot.outline) {
        L.polygon(ring, { color: GOLD, weight: 2.5, dashArray: "8 6", fill: false, interactive: false, lineJoin: "miter" }).addTo(group);
        for (const p of ring) {
          everything.push(p);
          focus.push(p);
        }
        continue;
      }
      const colour = plot.active ? GOLD : statusColour[plot.status ?? "available"];
      const polygon = L.polygon(ring, {
        color: plot.active ? GOLD : onImagery ? "#ffffff" : colour,
        weight: plot.active ? 3 : 1.5,
        fillColor: colour,
        fillOpacity: plot.active ? 0.22 : 0.3,
        lineJoin: "miter",
      }).addTo(group);
      if (plot.label) {
        polygon.bindPopup(popupHtml(plot.label, undefined, plot.active ? undefined : plot.href, plot.linkText));
        if (!plot.active) polygon.bindTooltip(plot.label, { className: "rsp-tip", direction: "top", sticky: true });
      }
      if (plot.active && plot.sideLabels) {
        plot.corners.forEach((c, i) => {
          const text = plot.sideLabels?.[i];
          if (text) label(text, c, plot.corners[(i + 1) % plot.corners.length], plot.id);
        });
      }
      for (const p of ring) {
        everything.push(p);
        if (plot.active || !hasActive) focus.push(p);
      }
    }

    for (const line of lines) {
      L.polyline(
        [
          [line.a.lat, line.a.lng],
          [line.b.lat, line.b.lng],
        ],
        { color: onImagery ? "#ffffff" : NAVY, weight: line.dashed ? 1.5 : 2, dashArray: line.dashed ? "4 6" : undefined, opacity: line.dashed ? 0.65 : 0.95 },
      ).addTo(group);
      if (line.label) label(line.label, line.a, line.b);
      if (line.endLabel) {
        const name = document.createElement("span");
        name.textContent = line.endLabel;
        L.circleMarker([line.b.lat, line.b.lng], { radius: 4, color: NAVY, weight: 2, fillColor: "#ffffff", fillOpacity: 1, interactive: false }).addTo(group);
        L.marker([line.b.lat, line.b.lng], { icon: L.divIcon({ className: "rsp-marker", html: "", iconSize: [0, 0] }), interactive: false, keyboard: false })
          .bindTooltip(name, { permanent: true, direction: "top", offset: [0, -6], className: "rsp-tip" })
          .addTo(group);
      }
      // The plot itself sets the opening view; extra lines only count when there is no plot.
      if (!line.dashed && !hasActive) focus.push([line.a.lat, line.a.lng], [line.b.lat, line.b.lng]);
      everything.push([line.a.lat, line.a.lng], [line.b.lat, line.b.lng]);
    }

    for (const pin of pins) {
      const icon = pinHtml(pin);
      const marker = L.marker([pin.lat, pin.lng], {
        icon: L.divIcon({ className: "rsp-marker", html: icon.html, iconSize: icon.size, iconAnchor: icon.anchor, popupAnchor: [0, -icon.anchor[1]] }),
        title: pin.label,
        zIndexOffset: pin.kind === "main" || !pin.kind ? 600 : 0,
      }).addTo(group);
      marker.bindPopup(popupHtml(pin.label, pin.sub, pin.href, pin.linkText));
      if (pin.tag) {
        const name = document.createElement("span");
        name.textContent = pin.tag;
        // Under the tip, so the pin and its name sit evenly about the spot they mark.
        marker.bindTooltip(name, { permanent: true, className: "rsp-tip rsp-tip-main", direction: "bottom", offset: [0, 1] });
        pinned.push(marker);
      } else if (pin.kind === "landmark" || pin.kind === "point") {
        marker.bindTooltip(pin.sub ? `${pin.label} · ${pin.sub}` : pin.label, { className: "rsp-tip", direction: "top", offset: [0, -8] });
      }
      everything.push([pin.lat, pin.lng]);
      if (pin.kind !== "landmark" && !(hasActive && pin.kind === "point")) focus.push([pin.lat, pin.lng]);
    }

    // Frame the features when they change. Switching imagery redraws them but keeps the view.
    const fitKey = `${pinsKey}|${plotsKey}|${linesKey}|${fit}|${maxFitZoom}`;
    if (fitKey !== fittedRef.current) {
      fittedRef.current = fitKey;
      const target = fit === "all" || !focus.length ? everything : focus;
      // A phone opens a little further out, so the plot is seen with the roads around it.
      const cap = window.innerWidth < 640 ? Math.min(maxFitZoom, 18) : maxFitZoom;
      if (target.length === 1) map.setView(target[0], Math.min(cap, 17));
      else if (target.length > 1) map.fitBounds(L.latLngBounds(target), { padding: [56, 56], maxZoom: cap, animate: false });
    }

    // A length is only printed when its line is long enough on screen to carry it.
    const place = () => {
      const taken = pinned.flatMap((m) => [m.getElement(), m.getTooltip()?.getElement()]).flatMap((el) => (el ? [el.getBoundingClientRect()] : []));
      const frame = map.getContainer().getBoundingClientRect();
      const shown = labels.map((item) => {
        const p = map.latLngToContainerPoint([item.a.lat, item.a.lng]);
        const q = map.latLngToContainerPoint([item.b.lat, item.b.lng]);
        // Where the label would sit, and roughly how much room its text takes.
        const x = frame.left + (p.x + q.x) / 2;
        const y = frame.top + (p.y + q.y) / 2;
        const halfW = item.text.length * 3.5 + 9;
        const covered = taken.some((box) => x + halfW > box.left && x - halfW < box.right && y + 12 > box.top && y - 12 < box.bottom);
        return p.distanceTo(q) >= 58 && !covered;
      });
      labels.forEach((item, i) => {
        // The sides of one plot go together: with half of them gone, the rest would only look stray.
        const sides = item.set ? labels.map((other, j) => (other.set === item.set ? shown[j] : null)).filter((v) => v != null) : [];
        const fits = shown[i] && sides.filter((v) => !v).length * 2 < Math.max(sides.length, 1);
        if (fits && !group.hasLayer(item.marker)) item.marker.addTo(group);
        if (!fits && group.hasLayer(item.marker)) group.removeLayer(item.marker);
      });
    };
    place();
    map.on("zoomend", place);
    return () => {
      map.off("zoomend", place);
    };
    // The keys stand in for the arrays they were built from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinsKey, plotsKey, linesKey, layer, ready, fit, maxFitZoom]);

  // Keep the map sized to whichever box it is in.
  useEffect(() => {
    const el = mapEl.current;
    const map = mapRef.current;
    if (!ready || !el || !map) return;
    const resize = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    resize.observe(el);
    return () => resize.disconnect();
  }, [ready]);

  // Where the map is, and what it answers to: on a phone's page it only shows the place; full
  // screen, or under a mouse, it moves, pinches and zooms.
  useEffect(() => {
    const map = mapRef.current;
    const el = mapEl.current;
    if (!ready || !map || !el) return;
    const slot = expanded ? fullSlot.current : holder.current;
    if (slot && el.parentElement !== slot) {
      slot.appendChild(el);
      map.invalidateSize({ animate: false });
    }
    const live = expanded || !touch;
    for (const handler of [map.dragging, map.touchZoom, map.doubleClickZoom]) {
      if (live) handler.enable();
      else handler.disable();
    }
  }, [expanded, touch, ready]);

  // Full screen is a step in the visit's history, so the phone's back button closes it.
  const open = useCallback(() => {
    if (expanded) return;
    window.history.pushState(null, "", window.location.href);
    pushed.current = true;
    setExpanded(true);
  }, [expanded]);
  const close = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else setExpanded(false);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    const onPop = () => {
      pushed.current = false;
      setExpanded(false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") close();
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = before;
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded, close]);

  // Two fingers on the map on the page mean the visitor wants the map, not a bigger page.
  useEffect(() => {
    const btn = cover.current;
    if (!btn) return;
    const onTouch = (ev: TouchEvent) => {
      if (ev.touches.length < 2) return;
      ev.preventDefault();
      open();
    };
    btn.addEventListener("touchstart", onTouch, { passive: false });
    return () => btn.removeEventListener("touchstart", onTouch);
  }, [open, touch, ready, expanded]);

  const layerToggle = (place: string) =>
    toggle && ready ? (
      <div className={cn("absolute z-[1001] flex overflow-hidden rounded-[3px] border border-navy-900/20 bg-paper-0 text-[12px] font-semibold shadow-card", place)}>
        {(["map", "satellite"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setLayer(key)}
            aria-pressed={layer === key}
            className={cn("px-3 py-2 transition-colors", layer === key ? "bg-navy-900 text-gold-200" : "text-navy-800 hover:bg-navy-50")}
          >
            {labels[key]}
          </button>
        ))}
      </div>
    ) : null;

  return (
    <div className={cn("relative isolate h-full w-full overflow-hidden bg-paper-200", className)} data-map>
      <div ref={holder} className="h-full w-full" />
      {!ready ? <div className="absolute inset-0 animate-pulse bg-paper-200" aria-hidden="true" /> : null}

      {expanded ? null : layerToggle("right-2.5 top-2.5")}

      {ready && touch && !expanded ? (
        // On a phone the whole map is one button that opens it; the page scrolls past it as usual.
        <button ref={cover} type="button" onClick={open} className="absolute inset-0 z-[1000] flex items-end justify-center bg-transparent pb-4" aria-label={labels.interact} data-map-open>
          <span className="inline-flex items-center gap-2 rounded-[3px] bg-navy-900/90 px-3.5 py-2 text-[12.5px] font-semibold text-paper-0 shadow-card">
            <Maximize2 className="h-4 w-4 text-gold-300" aria-hidden="true" />
            {labels.interact}
          </span>
        </button>
      ) : null}
      {ready && !touch && !expanded ? (
        <button
          type="button"
          onClick={open}
          aria-label={labels.expand ?? labels.interact}
          title={labels.expand ?? labels.interact}
          className="absolute bottom-7 right-2.5 z-[1001] inline-flex h-9 w-9 items-center justify-center rounded-[3px] border border-navy-900/20 bg-paper-0 text-navy-800 shadow-card hover:bg-navy-50"
          data-map-open
        >
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}

      {expanded
        ? createPortal(
            <div className="fixed inset-0 z-[90] bg-paper-200" role="dialog" aria-modal="true" aria-label={labels.map} data-map-full>
              <div ref={fullSlot} className="absolute inset-0" />
              {layerToggle("right-[4.25rem] top-[max(0.75rem,env(safe-area-inset-top))]")}
              <button
                type="button"
                onClick={close}
                aria-label={labels.close ?? "Close"}
                className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[1001] inline-flex h-11 w-11 items-center justify-center rounded-[3px] border border-navy-900/20 bg-paper-0 text-navy-900 shadow-card"
                data-map-close
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/** The middle of a set of plots and pins, for callers that need a fallback centre. */
export function mapCentre(plots: MapPlot[], pins: MapPin[]): LatLng | null {
  const all: LatLng[] = [...plots.flatMap((p) => p.corners), ...pins.map((p) => ({ lat: p.lat, lng: p.lng }))];
  return all.length ? centroid(all) : null;
}
