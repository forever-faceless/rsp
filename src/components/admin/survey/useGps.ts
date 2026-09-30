"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GpsFix = { lat: number; lng: number; acc: number; at: number };
export type GpsStatus = "off" | "searching" | "on" | "denied" | "unavailable";

const SAMPLE_MS = 5000;
const ENOUGH_SAMPLES = 6;

/**
 * Follows the phone's position. `sample()` stands still for a few seconds and averages
 * the readings, weighting the accurate ones more, which steadies a corner noticeably
 * compared with taking a single reading.
 */
export function useGps() {
  const [status, setStatus] = useState<GpsStatus>("off");
  const [fix, setFix] = useState<GpsFix | null>(null);
  const watch = useRef<number | null>(null);
  const latest = useRef<GpsFix | null>(null);
  const listeners = useRef(new Set<(f: GpsFix) => void>());

  const stop = useCallback(() => {
    if (watch.current != null && typeof navigator !== "undefined") navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    setStatus("off");
  }, []);

  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }
    if (watch.current != null) return;
    setStatus("searching");
    watch.current = navigator.geolocation.watchPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy, at: Date.now() };
        latest.current = next;
        setFix(next);
        setStatus("on");
        for (const fn of listeners.current) fn(next);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          watch.current = null;
          setStatus("denied");
        } else {
          // A timeout or a lost signal is temporary: keep watching.
          setStatus((s) => (s === "on" ? "searching" : s));
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 },
    );
  }, []);

  useEffect(
    () => () => {
      if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
    },
    [],
  );

  /** Resolves with an averaged position, or null when no reading arrives in time. */
  const sample = useCallback(
    (onProgress?: (count: number) => void): Promise<GpsFix | null> =>
      new Promise((resolve) => {
        start();
        const readings: GpsFix[] = [];
        const finish = () => {
          listeners.current.delete(collect);
          clearTimeout(timer);
          if (!readings.length) return resolve(null);
          // Drop the worst readings when there are enough good ones to choose from.
          const sorted = [...readings].sort((a, b) => a.acc - b.acc);
          const kept = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.7)));
          let wSum = 0;
          let lat = 0;
          let lng = 0;
          for (const r of kept) {
            const w = 1 / Math.max(1, r.acc) ** 2;
            wSum += w;
            lat += r.lat * w;
            lng += r.lng * w;
          }
          resolve({ lat: lat / wSum, lng: lng / wSum, acc: kept[0].acc, at: Date.now() });
        };
        const collect = (f: GpsFix) => {
          readings.push(f);
          onProgress?.(readings.length);
          if (readings.length >= ENOUGH_SAMPLES) finish();
        };
        // A phone lying still may not report again for a while, so a fresh reading counts too.
        if (latest.current && Date.now() - latest.current.at < 10_000) readings.push(latest.current);
        const timer = setTimeout(finish, SAMPLE_MS);
        listeners.current.add(collect);
      }),
    [start],
  );

  return { status, fix, start, stop, sample };
}
