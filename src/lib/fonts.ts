import { Anek_Kannada, Archivo, Hanken_Grotesk, IBM_Plex_Mono, Noto_Sans_Kannada } from "next/font/google";

/** Headlines. The width axis lets display type run wide, closer to the lettering in the logo. */
export const displayLatin = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-display-latin",
  display: "swap",
});

export const sansLatin = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans-latin",
  display: "swap",
});

/** Property numbers, coordinates and measurements, set like entries in a register. */
export const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono-latin",
  display: "swap",
});

export const displayKannada = Anek_Kannada({
  subsets: ["kannada"],
  axes: ["wdth"],
  variable: "--font-display-kannada",
  display: "swap",
  preload: false,
});

export const sansKannada = Noto_Sans_Kannada({
  subsets: ["kannada"],
  variable: "--font-sans-kannada",
  display: "swap",
  preload: false,
});

export const fontClassNames = [displayLatin.variable, sansLatin.variable, mono.variable, displayKannada.variable, sansKannada.variable].join(" ");
