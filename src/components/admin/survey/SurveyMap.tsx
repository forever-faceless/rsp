"use client";

import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { useEffect, useRef, useState } from "react";
import type { LatLng, SurveyGeometry } from "@/lib/db/enums";
import { centroid, cornerLabel, formatFeet, midpoint } from "@/lib/geo";
import { measureDistance, surveyExtent, surveySides } from "@/lib/survey";
import { MAX_ZOOM, SATELLITE_TILES, STREET_TILES } from "@/lib/tiles";
import type { GpsFix } from "./useGps";

export type SurveyMode = "move" | "pin" | "boundary" | "measure" | "point";

export type SurveyMapApi = {
  flyTo: (p: LatLng, zoom?: number) => void;
  fit: () => void;
  centre: () => LatLng;
};

type Props = {
  geometry: SurveyGeometry;
  mode: SurveyMode;
  layer: "satellite" | "map";
  selected: number | null;
  gps: GpsFix | null;
  /** First end of a measurement that is waiting for its second tap. */
  pending: LatLng | null;
  /** The name written on the pin: the one typed in, or the listing the survey belongs to. */
  pinTag: string;
  initialCentre: LatLng;
  onTap: (p: LatLng) => void;
  onChange: (next: SurveyGeometry) => void;
  onSelect: (index: number | null) => void;
  onReady: (api: SurveyMapApi) => void;
};

const GOLD = "#d7b56d";
const NAVY = "#0d1a2d";

const round = (n: number) => Number(n.toFixed(7));
const point = (ll: Leaflet.LatLng): LatLng => ({ lat: round(ll.lat), lng: round(ll.lng) });

function cornerIcon(L: typeof Leaflet, label: string, active: boolean) {
  const bg = active ? GOLD : NAVY;
  const fg = active ? NAVY : GOLD;
  return L.divIcon({
    className: "rsp-marker",
    html: `<div style="width:30px;height:30px;border-radius:999px;background:${bg};color:${fg};border:2px solid ${active ? NAVY : "#fff"};box-shadow:0 2px 6px rgba(0,0,0,.45);font:600 12px/26px var(--font-mono);text-align:center">${label}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function dotIcon(L: typeof Leaflet, size: number, fill: string, ring: string, inner = "") {
  return L.divIcon({
    className: "rsp-marker",
    html: `<div style="width:${size}px;height:${size}px;border-radius:999px;background:${fill};border:2px solid ${ring};box-shadow:0 1px 4px rgba(0,0,0,.4);color:${NAVY};font:700 13px/${size - 4}px var(--font-sans);text-align:center">${inner}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const pinIcon = (L: typeof Leaflet) =>
  L.divIcon({
    className: "rsp-marker",
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44"><path d="M17 43c6.5-9.5 15-17 15-26A15 15 0 0 0 2 17c0 9 8.5 16.5 15 26Z" fill="${NAVY}" stroke="${GOLD}" stroke-width="2"/><rect x="11.5" y="11.5" width="11" height="11" fill="${GOLD}"/></svg>`,
    iconSize: [34, 44],
    iconAnchor: [17, 43],
  });

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The drawing surface of the survey tool. It owns nothing but the map: every edit is handed
 * back through onChange, so undo, autosave and the side panel all work from one geometry.
 */
export default function SurveyMap({ geometry, mode, layer, selected, gps, pending, pinTag, initialCentre, onTap, onChange, onSelect, onReady }: Props) {
  const holder = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const tilesRef = useRef<Leaflet.TileLayer | null>(null);
  const featuresRef = useRef<Leaflet.LayerGroup | null>(null);
  const gpsRef = useRef<Leaflet.LayerGroup | null>(null);
  const [ready, setReady] = useState(false);
  const [zoomed, setZoomed] = useState(0);

  // Latest values for handlers that are attached once. Declared first so it runs before the other effects.
  const live = useRef({ geometry, onTap, onChange, onSelect });
  useEffect(() => {
    live.current = { geometry, onTap, onChange, onSelect };
  });

  useEffect(() => {
    let cancelled = false;
    let map: Leaflet.Map | null = null;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !holder.current) return;
      map = L.map(holder.current, { zoomControl: false, maxZoom: MAX_ZOOM, zoomSnap: 0.25, doubleClickZoom: false, attributionControl: true });
      map.attributionControl.setPrefix(false);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.control.scale({ position: "bottomleft", imperial: true, metric: true, maxWidth: 120 }).addTo(map);

      // The boundary sets the view when there is one; extra lines can reach far beyond the plot.
      const frame = (animate: boolean) => {
        const g = live.current.geometry;
        const pts = g.corners.length >= 2 ? g.corners : surveyExtent(g);
        // Leave room for the corner markers, but less of it when the map itself is small.
        const size = map?.getSize();
        const pad = size ? Math.round(Math.min(90, Math.min(size.x, size.y) * 0.2)) : 60;
        if (pts.length > 1) map?.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng] as [number, number])), { padding: [pad, pad], maxZoom: 21, animate });
        else if (pts.length === 1) map?.setView([pts[0].lat, pts[0].lng], 19);
        return pts.length > 0;
      };
      if (!frame(false)) map.setView([initialCentre.lat, initialCentre.lng], 16);

      map.on("click", (e: Leaflet.LeafletMouseEvent) => live.current.onTap(point(e.latlng)));
      // Labels and handles are thinned out when the plot is small on screen, so redraw after a zoom.
      map.on("zoomend", () => setZoomed((n) => n + 1));

      leafletRef.current = L;
      mapRef.current = map;
      featuresRef.current = L.layerGroup().addTo(map);
      gpsRef.current = L.layerGroup().addTo(map);
      const api: SurveyMapApi = {
        flyTo: (p, zoom) => map?.flyTo([p.lat, p.lng], zoom ?? Math.max(map.getZoom(), 19), { duration: 0.8 }),
        fit: () => void frame(true),
        centre: () => point(map!.getCenter()),
      };
      onReady(api);
      setReady(true);
    })();
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      featuresRef.current = null;
      gpsRef.current = null;
      tilesRef.current = null;
    };
    // The map is created once; later changes arrive through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the map sized to its box as panels open and the phone rotates.
  useEffect(() => {
    const el = holder.current;
    const map = mapRef.current;
    if (!ready || !el || !map) return;
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    const source = layer === "satellite" ? SATELLITE_TILES : STREET_TILES;
    tilesRef.current?.remove();
    tilesRef.current = L.tileLayer(source.url, { attribution: source.attribution, maxNativeZoom: source.maxNativeZoom, maxZoom: MAX_ZOOM, subdomains: source.subdomains ?? "abc" }).addTo(map);
    tilesRef.current.bringToBack();
  }, [layer, ready]);

  // The cursor says what a tap will do.
  useEffect(() => {
    const el = holder.current;
    if (el) el.style.cursor = mode === "move" ? "" : "crosshair";
  }, [mode, ready]);

  // Where the phone is.
  useEffect(() => {
    const L = leafletRef.current;
    const group = gpsRef.current;
    if (!ready || !L || !group) return;
    group.clearLayers();
    if (!gps) return;
    L.circle([gps.lat, gps.lng], { radius: Math.min(gps.acc, 200), color: "#2f6fdf", weight: 1, fillColor: "#2f6fdf", fillOpacity: 0.12, interactive: false }).addTo(group);
    L.marker([gps.lat, gps.lng], {
      icon: L.divIcon({
        className: "rsp-marker",
        html: `<div style="position:relative;width:18px;height:18px"><span style="position:absolute;inset:0;border-radius:999px;background:#2f6fdf;animation:pulse-ring 1.8s ease-out infinite"></span><span style="position:absolute;inset:0;border-radius:999px;background:#2f6fdf;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
      interactive: false,
      keyboard: false,
      zIndexOffset: -100,
    }).addTo(group);
  }, [gps, ready]);

  // Everything that belongs to the survey.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const group = featuresRef.current;
    if (!ready || !L || !map || !group) return;
    group.clearLayers();
    const onImagery = layer === "satellite";
    const dim = onImagery ? "rsp-dim" : "rsp-dim rsp-dim-light";
    const { corners, measures, points, pin } = geometry;
    const editing = mode === "boundary";
    const measuring = mode === "measure";
    /**
     * A tap on a marker never reaches the map. While measuring, it is handed on as a tap at
     * the marker's exact position, so a corner, a point, the pin or the end of another
     * measurement can be one end of the new measurement.
     */
    const asEnd = (e: Leaflet.LeafletMouseEvent, at: LatLng): boolean => {
      L.DomEvent.stopPropagation(e);
      if (!measuring) return false;
      live.current.onTap({ lat: round(at.lat), lng: round(at.lng) });
      return true;
    };
    const commit = (patch: Partial<SurveyGeometry>) => live.current.onChange({ ...live.current.geometry, ...patch });
    const ring = corners.map((c) => [c.lat, c.lng] as [number, number]);

    const labelAt = (text: string, p: LatLng) =>
      L.marker([p.lat, p.lng], { icon: L.divIcon({ className: "rsp-marker", html: "", iconSize: [0, 0] }), interactive: false, keyboard: false })
        .bindTooltip(text, { permanent: true, direction: "center", className: dim })
        .addTo(group);

    // ----- boundary
    let shape: Leaflet.Polygon | Leaflet.Polyline | null = null;
    if (corners.length >= 3) shape = L.polygon(ring, { color: GOLD, weight: 3, fillColor: GOLD, fillOpacity: 0.2, lineJoin: "miter", interactive: false }).addTo(group);
    else if (corners.length === 2) shape = L.polyline(ring, { color: GOLD, weight: 3, interactive: false }).addTo(group);

    const onScreen = (a: LatLng, b: LatLng) => map.latLngToContainerPoint([a.lat, a.lng]).distanceTo(map.latLngToContainerPoint([b.lat, b.lng]));
    const sides = surveySides(corners);
    const sideLabels: Leaflet.Marker[] = [];
    sides.forEach((s) => {
      const a = corners[s.index];
      const b = corners[(s.index + 1) % corners.length];
      // While editing, the middle of a side belongs to the handle that adds a corner.
      const room = onScreen(a, b);
      if (room < (editing ? 150 : 96)) return;
      const at = editing ? { lat: a.lat + (b.lat - a.lat) * 0.27, lng: a.lng + (b.lng - a.lng) * 0.27 } : midpoint(a, b);
      sideLabels.push(labelAt(`${formatFeet(s.ft)}${s.measuredFt == null ? "" : " ✓"}`, at));
    });

    corners.forEach((c, i) => {
      const marker = L.marker([c.lat, c.lng], { icon: cornerIcon(L, cornerLabel(i), selected === i), draggable: !measuring, autoPan: true, zIndexOffset: 800, title: `Corner ${cornerLabel(i)}` }).addTo(group);
      marker.on("click", (e) => {
        if (asEnd(e, c)) return;
        live.current.onSelect(i);
      });
      marker.on("drag", () => {
        const ll = marker.getLatLng();
        ring[i] = [ll.lat, ll.lng];
        shape?.setLatLngs(ring);
        for (const l of sideLabels) l.setOpacity(0);
      });
      marker.on("dragend", () => {
        const next = live.current.geometry.corners.map((k, j) => (j === i ? { ...k, ...point(marker.getLatLng()), src: "map" as const, acc: null } : k));
        commit({ corners: next });
      });
    });

    if (editing && corners.length >= 2) {
      // A handle in the middle of every side adds a corner there.
      sides.forEach((s) => {
        const a = corners[s.index];
        const b = corners[(s.index + 1) % corners.length];
        if (onScreen(a, b) < 84) return;
        const mid = midpoint(a, b);
        const handle = L.marker([mid.lat, mid.lng], { icon: dotIcon(L, 22, "#fff", NAVY, "+"), zIndexOffset: 500, title: "Add a corner here" }).addTo(group);
        handle.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          const list = [...live.current.geometry.corners];
          // Splitting a side makes its taped length meaningless.
          list[s.index] = { ...list[s.index], lenFt: null };
          list.splice(s.index + 1, 0, { lat: round(mid.lat), lng: round(mid.lng), src: "map", lenFt: null });
          commit({ corners: list });
          live.current.onSelect(s.index + 1);
        });
      });
    }

    if (editing && corners.length >= 3 && Math.max(...sides.map((s) => onScreen(corners[s.index], corners[(s.index + 1) % corners.length]))) >= 84) {
      // Dragging the middle moves the whole plot without changing its shape.
      const c0 = centroid(corners);
      const mover = L.marker([c0.lat, c0.lng], {
        icon: L.divIcon({
          className: "rsp-marker",
          html: `<div style="width:34px;height:34px;border-radius:3px;background:${NAVY};border:2px solid ${GOLD};box-shadow:0 2px 6px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${GOLD}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3"/></svg></div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        }),
        draggable: true,
        zIndexOffset: 700,
        title: "Drag to move the whole plot",
      }).addTo(group);
      const shifted = () => {
        const ll = mover.getLatLng();
        const dLat = ll.lat - c0.lat;
        const dLng = ll.lng - c0.lng;
        return corners.map((c) => ({ ...c, lat: round(c.lat + dLat), lng: round(c.lng + dLng) }));
      };
      mover.on("drag", () => {
        shape?.setLatLngs(shifted().map((c) => [c.lat, c.lng] as [number, number]));
        for (const l of sideLabels) l.setOpacity(0);
      });
      mover.on("dragend", () => commit({ corners: shifted().map((c) => ({ ...c, src: "map" as const, acc: null })) }));
    }

    // ----- extra measurements
    measures.forEach((m) => {
      const line = L.polyline(
        [
          [m.a.lat, m.a.lng],
          [m.b.lat, m.b.lng],
        ],
        { color: onImagery ? "#fff" : NAVY, weight: 2.5, dashArray: "2 7", interactive: false },
      ).addTo(group);
      const label = labelAt(measureDistance(m), midpoint(m.a, m.b));
      (["a", "b"] as const).forEach((end) => {
        const marker = L.marker([m[end].lat, m[end].lng], { icon: dotIcon(L, 16, "#fff", NAVY), draggable: true, zIndexOffset: 600 }).addTo(group);
        // The name of the place the line runs to is a tag on that end; the distance stays on the line.
        if (end === "b" && m.label) marker.bindTooltip(esc(m.label), { permanent: true, direction: "top", offset: [0, -9], className: "rsp-tip" });
        marker.on("click", (e) => void asEnd(e, m[end]));
        marker.on("drag", () => {
          const ll = marker.getLatLng();
          const other = end === "a" ? m.b : m.a;
          line.setLatLngs([
            [ll.lat, ll.lng],
            [other.lat, other.lng],
          ]);
          label.setOpacity(0);
        });
        marker.on("dragend", () =>
          // The taped length belonged to the old position.
          commit({ measures: live.current.geometry.measures.map((k) => (k.id === m.id ? { ...k, [end]: point(marker.getLatLng()), lenFt: null } : k)) }),
        );
      });
    });

    if (pending) L.marker([pending.lat, pending.lng], { icon: dotIcon(L, 16, GOLD, NAVY), interactive: false }).addTo(group);

    // ----- labelled points and the pin
    points.forEach((p) => {
      const marker = L.marker([p.lat, p.lng], { icon: dotIcon(L, 18, GOLD, NAVY), draggable: true, zIndexOffset: 600 }).addTo(group);
      if (p.label) marker.bindTooltip(esc(p.label), { permanent: true, direction: "top", offset: [0, -10], className: "rsp-tip" });
      marker.on("click", (e) => void asEnd(e, p));
      marker.on("dragend", () => commit({ points: live.current.geometry.points.map((k) => (k.id === p.id ? { ...k, ...point(marker.getLatLng()) } : k)) }));
    });

    if (pin) {
      const marker = L.marker([pin.lat, pin.lng], { icon: pinIcon(L), draggable: true, zIndexOffset: 400, title: "Location pin" }).addTo(group);
      // The pin is the property's location, so it carries the property's name.
      if (pinTag) marker.bindTooltip(esc(pinTag), { permanent: true, direction: "bottom", offset: [0, 1], className: "rsp-tip rsp-tip-main" });
      marker.on("click", (e) => void asEnd(e, pin));
      marker.on("dragend", () => commit({ pin: point(marker.getLatLng()), accuracyM: null }));
    }
  }, [geometry, mode, layer, selected, pending, pinTag, ready, zoomed]);

  return (
    <div className="relative h-full w-full bg-navy-950">
      <div ref={holder} className="h-full w-full" />
      {!ready ? <div className="absolute inset-0 animate-pulse bg-navy-900" aria-hidden="true" /> : null}
    </div>
  );
}
