"use client";

import { Loader2, MapPin, Search, X } from "lucide-react";
import { useState } from "react";
import { parseCoordinates } from "@/lib/coords";
import type { LatLng } from "@/lib/db/enums";

type Place = { name: string; lat: number; lng: number };

/**
 * Takes the survey map to a place: a village, a road or a landmark typed by name, or a pair
 * of coordinates pasted from Google Maps or Google Earth.
 */
export function PlaceSearch({ onPick }: { onPick: (p: LatLng) => void }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Place[] | null>(null);
  const [note, setNote] = useState("");

  const clear = () => {
    setQ("");
    setResults(null);
    setNote("");
  };

  const search = async () => {
    const text = q.trim();
    setResults(null);
    // Coordinates need no lookup.
    const point = parseCoordinates(text);
    if (point) {
      setNote("");
      onPick(point);
      return;
    }
    if (text.length < 3) {
      setNote("Type a place name, or paste coordinates.");
      return;
    }
    setBusy(true);
    setNote("");
    try {
      const response = await fetch(`/api/admin/places?q=${encodeURIComponent(text)}`);
      const data = (await response.json()) as { places?: Place[]; error?: string };
      if (!response.ok) throw new Error(data.error || "The search failed.");
      const places = data.places ?? [];
      if (places.length === 0) setNote("Nothing found by that name. Try the village or the nearest town.");
      else if (places.length === 1) onPick(places[0]);
      else setResults(places);
    } catch (error) {
      setNote(error instanceof Error && error.message ? error.message : "The search failed. Check the connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-[min(19rem,calc(100vw-7.75rem))]">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
        className="flex items-center rounded-[3px] bg-paper-0 shadow-card"
      >
        <label htmlFor="place-search" className="sr-only">
          Find a place on the map
        </label>
        <input
          id="place-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find a place or paste coordinates"
          enterKeyHint="search"
          autoComplete="off"
          className="h-10 min-w-0 flex-1 rounded-l-[3px] bg-transparent pl-3 pr-1 text-[13.5px] text-navy-900 outline-none placeholder:text-ink-400"
        />
        {q ? (
          <button type="button" onClick={clear} className="flex h-10 w-8 items-center justify-center text-ink-400 hover:text-navy-900" aria-label="Clear the search">
            <X className="h-4 w-4" />
          </button>
        ) : null}
        <button type="submit" disabled={busy} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-r-[3px] bg-navy-900 text-gold-200" aria-label="Search">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </button>
      </form>

      {note ? (
        <p className="mt-1.5 rounded-[3px] bg-paper-0 px-3 py-2 text-[12.5px] leading-snug text-ink-700 shadow-card" role="status">
          {note}
        </p>
      ) : null}

      {results ? (
        <ul className="mt-1.5 max-h-[46dvh] overflow-y-auto rounded-[3px] bg-paper-0 shadow-card">
          {results.map((place) => (
            <li key={`${place.lat},${place.lng}`} className="border-t border-navy-900/8 first:border-t-0">
              <button
                type="button"
                onClick={() => {
                  onPick(place);
                  setResults(null);
                }}
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-[13px] leading-snug text-navy-900 hover:bg-navy-50"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-600" aria-hidden="true" />
                {place.name}
              </button>
            </li>
          ))}
          <li className="border-t border-navy-900/8 px-3 py-1.5 text-[11px] text-ink-400">Place names from OpenStreetMap</li>
        </ul>
      ) : null}
    </div>
  );
}
