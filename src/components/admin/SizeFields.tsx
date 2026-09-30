"use client";

import { useState } from "react";
import { MeasureInput } from "./MeasureInput";
import { Input } from "./ui";

type Props = {
  widthFt?: number | null;
  depthFt?: number | null;
  areaSqft?: number | null;
  dimension?: string | null;
  errors?: Record<string, string>;
};

const tidy = (n: number) => String(Math.round(n * 100) / 100);
const areaOf = (w: number | null, d: number | null) => (w && d ? Math.round(w * d * 10) / 10 : null);
const labelOf = (w: number | null, d: number | null) => (w && d ? `${tidy(w)} × ${tidy(d)}` : "");

/**
 * Width, depth, the "30 × 40" label and the area, kept in step. The label and the area are
 * worked out from width and depth as they are typed. Either can be typed over, for a plot
 * that is not a plain rectangle or a deed that states another figure, and then it is left
 * alone. Emptying the box hands it back to the automatic figure.
 */
export function SizeFields({ widthFt = null, depthFt = null, areaSqft = null, dimension, errors = {} }: Props) {
  const [width, setWidth] = useState<number | null>(widthFt);
  const [depth, setDepth] = useState<number | null>(depthFt);

  const startArea = areaOf(widthFt, depthFt);
  const [ownArea, setOwnArea] = useState<{ value: number | null } | null>(areaSqft != null && (startArea == null || Math.abs(areaSqft - startArea) > 0.5) ? { value: areaSqft } : null);
  const startLabel = labelOf(widthFt, depthFt);
  const [ownLabel, setOwnLabel] = useState<{ text: string } | null>(dimension && dimension !== startLabel ? { text: dimension } : null);

  const area = ownArea ? ownArea.value : areaOf(width, depth);
  const label = ownLabel ? ownLabel.text : labelOf(width, depth);
  const both = Boolean(width && depth);

  return (
    <>
      <MeasureInput label="Width" name="widthFt" valueFt={width} onChangeFt={setWidth} error={errors.widthFt} />
      <MeasureInput label="Depth" name="depthFt" valueFt={depth} onChangeFt={setDepth} error={errors.depthFt} />
      <Input
        label="Dimension label"
        name="dimension"
        value={label}
        onChange={(e) => setOwnLabel({ text: e.target.value })}
        onBlur={() => ownLabel && ownLabel.text.trim() === "" && setOwnLabel(null)}
        placeholder="30 × 40"
        maxLength={40}
        hint={ownLabel ? "Your own wording. Empty the box to use width × depth." : "Follows width and depth. Type over it to change."}
      />
      <MeasureInput
        label="Area"
        name="areaSqft"
        kind="area"
        valueFt={area}
        onChangeFt={(value) => setOwnArea({ value })}
        onBlur={() => ownArea && ownArea.value == null && setOwnArea(null)}
        error={errors.areaSqft}
        hint={ownArea ? "Your own figure. Empty the box to work it out again." : both ? "Width × depth. Type over it if the deed differs." : "Filled in from width and depth."}
      />
    </>
  );
}
