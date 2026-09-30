"use client";

import dynamic from "next/dynamic";
import type { MapViewProps } from "./MapView";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-paper-200" aria-hidden="true" />,
});

/** Loads the map in the browser only; Leaflet needs a window to measure itself against. */
export function MapLoader(props: MapViewProps) {
  return <MapView {...props} />;
}
