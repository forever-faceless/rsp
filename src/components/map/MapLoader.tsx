"use client";

import dynamic from "next/dynamic";
import { preconnect } from "react-dom";
import { SATELLITE_TILES, STREET_TILES } from "@/lib/tiles";
import type { MapViewProps } from "./MapView";

/** The address of a tile server, from its tile URL template. */
function origin(template: string, sub = "a"): string | null {
  try {
    return new URL(template.replace("{s}", sub).replace(/\{[a-z]\}/g, "0")).origin;
  } catch {
    return null;
  }
}

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-paper-200" aria-hidden="true" />,
});

/** Loads the map in the browser only; Leaflet needs a window to measure itself against. */
export function MapLoader(props: MapViewProps) {
  // The imagery servers are greeted while Leaflet is still loading, so the first tiles come sooner.
  const source = props.base === "satellite" ? SATELLITE_TILES : STREET_TILES;
  for (const sub of source.subdomains ? source.subdomains.split("") : [""]) {
    const at = origin(source.url, sub);
    if (at) preconnect(at);
  }
  return <MapView {...props} />;
}
