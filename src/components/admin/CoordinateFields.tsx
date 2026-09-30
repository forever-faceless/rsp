"use client";

import { ExternalLink, Loader2, LocateFixed, MapPin } from "lucide-react";
import { useState } from "react";
import { parseAngle, parseCoordinates } from "@/lib/coords";
import { googleMapsLink, isValidLatLng } from "@/lib/geo";
import { Input } from "./ui";

type Props = {
  lat: number | null;
  lng: number | null;
  label: string;
  hint?: string;
  required?: boolean;
  names?: { lat: string; lng: string };
};

/**
 * Latitude and longitude, filled in one of three ways: from the phone's GPS while standing
 * on the spot, by pasting coordinates copied from Google Maps or Google Earth in whichever
 * form they come, or typed by hand.
 */
export function CoordinateFields({ lat, lng, label, hint, required = false, names = { lat: "lat", lng: "lng" } }: Props) {
  const [latV, setLat] = useState(lat == null ? "" : String(lat));
  const [lngV, setLng] = useState(lng == null ? "" : String(lng));
  const [paste, setPaste] = useState("");
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState("");

  const applyPaste = (value: string) => {
    setPaste(value);
    const found = parseCoordinates(value);
    if (found) {
      setLat(String(found.lat));
      setLng(String(found.lng));
      setNote(`Read as ${found.lat.toFixed(5)}, ${found.lng.toFixed(5)}.`);
    } else if (value.trim() === "") {
      setNote("");
    }
  };

  /** Shown when the paste box is left with something in it that could not be read. */
  const checkPaste = () => {
    if (paste.trim() && !parseCoordinates(paste)) setNote("Those coordinates could not be read. Both 13.0230, 76.1270 and 13°01'16.39\"N 76°05'39.43\"E work.");
  };

  /** A whole pair pasted into one box fills both; a single angle in degrees, minutes and seconds becomes a decimal. */
  const typeInto = (which: "lat" | "lng", value: string) => {
    const both = /[°,\s]/.test(value.trim()) ? parseCoordinates(value) : null;
    if (both) {
      setLat(String(both.lat));
      setLng(String(both.lng));
      return;
    }
    (which === "lat" ? setLat : setLng)(value);
  };
  const settle = (which: "lat" | "lng") => {
    const value = which === "lat" ? latV : lngV;
    if (!value.includes("°")) return;
    const angle = parseAngle(value);
    if (angle != null) (which === "lat" ? setLat : setLng)(String(angle));
  };

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setNote("This browser cannot read the location.");
      return;
    }
    setLocating(true);
    setNote("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(7));
        setLng(pos.coords.longitude.toFixed(7));
        setNote(`Location read, accurate to about ${Math.round(pos.coords.accuracy)} m.`);
        setLocating(false);
      },
      (err) => {
        setNote(err.code === err.PERMISSION_DENIED ? "Location permission was refused. Allow it in the browser settings and try again." : "Could not read the location. Step into the open and try again.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  const nLat = Number(latV);
  const nLng = Number(lngV);
  const valid = latV !== "" && lngV !== "" && isValidLatLng(nLat, nLng);

  return (
    <fieldset className="rounded-[4px] border border-navy-900/12 bg-paper-50 p-4 sm:p-5">
      <legend className="flex items-center gap-1.5 px-2 text-[13.5px] font-semibold text-navy-900">
        <MapPin className="h-4 w-4 text-gold-600" aria-hidden="true" /> {label}
      </legend>
      {hint ? <p className="mb-4 text-[13px] text-ink-600">{hint}</p> : null}
      <div className="grid gap-4 md:grid-cols-[1.3fr_1fr_1fr]">
        <Input
          label="Paste from Google Maps or Google Earth"
          name="__coords_paste"
          value={paste}
          onChange={(e) => applyPaste(e.target.value)}
          onBlur={checkPaste}
          placeholder={`13.0230, 76.1270  or  13°01'16.39"N 76°05'39.43"E`}
          hint="Copy the coordinates in either form and paste them here. A Google Maps link works too."
          autoComplete="off"
        />
        <Input label="Latitude" name={names.lat} value={latV} onChange={(e) => typeInto("lat", e.target.value)} onBlur={() => settle("lat")} required={required} className="num" />
        <Input label="Longitude" name={names.lng} value={lngV} onChange={(e) => typeInto("lng", e.target.value)} onBlur={() => settle("lng")} required={required} className="num" />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" onClick={locate} disabled={locating} className="btn-outline btn-sm">
          {locating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <LocateFixed className="h-4 w-4" aria-hidden="true" />}
          Use my current location
        </button>
        {valid ? (
          <a href={googleMapsLink(nLat, nLng)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-navy-800 hover:underline">
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Check this point in Google Maps
          </a>
        ) : null}
        {note ? <span className="text-[13px] text-ink-600">{note}</span> : null}
      </div>
    </fieldset>
  );
}
