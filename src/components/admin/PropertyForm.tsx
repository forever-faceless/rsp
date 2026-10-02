"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { AREA_UNITS, FACINGS, LISTING_STATUSES, PROPERTY_TYPES, type PropertyType } from "@/lib/db/enums";
import type { Property } from "@/lib/db/schema";
import { approvalsToLines, bilingualToLines, type ActionState } from "@/lib/forms";
import { en } from "@/lib/i18n/dictionaries/en";
import { formatPropertyNo } from "@/lib/refs";
import { regionLabel, type RegionOption } from "@/lib/regions";
import { BrokerPicker, type BrokerOption } from "./BrokerPicker";
import { MeasureInput } from "./MeasureInput";
import { SizeFields } from "./SizeFields";
import { Checkbox, FormStatus, Input, Select, SubmitButton, Textarea } from "./ui";
import { ActionForm } from "@/components/ActionForm";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

type Props = { property?: Property | null; action: Action; submitLabel?: string; regions?: RegionOption[]; defaultPrefix?: string; brokers?: BrokerOption[] };

const unitLabels = { sqft: "Square feet", guntas: "Guntas", acres: "Acres", cents: "Cents" } as const;

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 border-b border-navy-900/8 pb-2">
        <h3 className="label-mono !text-navy-800">{title}</h3>
        {note ? <span className="text-xs text-ink-500">{note}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function PropertyForm({ property, action, submitLabel = "Save property", regions = [], defaultPrefix, brokers = [] }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);
  const [type, setType] = useState<PropertyType>(property?.type ?? "residential_site");
  const [prefix, setPrefix] = useState(property?.prefix ?? defaultPrefix ?? regions[0]?.code ?? "HSN");
  const e = state?.fieldErrors ?? {};
  const building = type === "house" || type === "commercial_building";
  const region = regions.find((r) => r.code === prefix);

  return (
    <ActionForm action={formAction} pending={pending} className="space-y-9">
      <FormStatus state={state} />

      <Group title="Listing">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <Select label="Type" name="type" value={type} onChange={(ev) => setType(ev.target.value as PropertyType)} options={PROPERTY_TYPES.map((t) => ({ value: t, label: en.types[t] }))} />
          <Select label="Availability" name="status" defaultValue={property?.status ?? "available"} options={LISTING_STATUSES.map((s) => ({ value: s, label: en.status.listing[s] }))} />
          {property ? (
            <Input label="Property number" name="__propertyNo" value={formatPropertyNo(property.prefix, property.propertyNo)} readOnly disabled className="num" hint="Fixed once issued." />
          ) : (
            <>
              <div>
                <Select label="District" name="prefix" value={prefix} onChange={(ev) => setPrefix(ev.target.value)} error={e.prefix} className="num" options={regions.map((r) => ({ value: r.code, label: regionLabel(r) }))} />
                <p className="help">
                  <Link href="/admin/settings#districts" className="font-semibold text-navy-800 underline decoration-gold-500 decoration-2 underline-offset-2">
                    Add a district
                  </Link>
                </p>
              </div>
              <div>
                <p className="label">Property number</p>
                <p className="field num !bg-paper-100" data-next-number>
                  {formatPropertyNo(prefix, region?.nextNo ?? 1)}
                </p>
                <p className="help">Given automatically when you save.</p>
              </div>
            </>
          )}
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Input label="Title (English)" name="titleEn" required defaultValue={property?.titleEn} error={e.titleEn} placeholder="East facing site in Vidyanagar" />
          <Input label="Title (ಕನ್ನಡ)" name="titleKn" defaultValue={property?.titleKn} lang="kn" />
          <Input label="Locality (English)" name="locationEn" defaultValue={property?.locationEn} placeholder="Vidyanagar, Hassan" />
          <Input label="Locality (ಕನ್ನಡ)" name="locationKn" defaultValue={property?.locationKn} lang="kn" />
        </div>
      </Group>

      <Group title="Size" note="A field survey can fill these in for you.">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <SizeFields widthFt={property?.widthFt} depthFt={property?.depthFt} dimension={property?.dimension} areaSqft={property?.areaSqft} errors={e} />
          <Select label="Show area in" name="areaUnit" defaultValue={property?.areaUnit ?? (type === "farm_land" ? "acres" : "sqft")} options={AREA_UNITS.map((u) => ({ value: u, label: unitLabels[u] }))} />
          <Select label="Facing" name="facing" defaultValue={property?.facing ?? ""} options={[{ value: "", label: "Not specified" }, ...FACINGS.map((f) => ({ value: f, label: en.facing[f] }))]} />
          <MeasureInput label="Road in front" name="roadWidthFt" defaultValue={property?.roadWidthFt} />
          <div>
            <p className="label invisible" aria-hidden="true">
              Corner
            </p>
            <Checkbox label="Corner property" name="corner" defaultChecked={property?.corner ?? false} />
          </div>
        </div>
        {building ? (
          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            <MeasureInput label="Built-up area" name="builtUpSqft" kind="area" defaultValue={property?.builtUpSqft} />
            <Input label="Bedrooms" name="bedrooms" type="number" min="0" inputMode="numeric" defaultValue={property?.bedrooms ?? ""} />
            <Input label="Floors" name="floors" type="number" min="0" inputMode="numeric" defaultValue={property?.floors ?? ""} />
          </div>
        ) : null}
      </Group>

      <Group title="Price">
        <div className="grid gap-5 sm:grid-cols-3">
          <Input label="Total price (₹)" name="price" type="number" min="0" step="1000" inputMode="numeric" defaultValue={property?.price ?? ""} />
          <Input label="Rate per sq ft (₹)" name="pricePerSqft" type="number" min="0" inputMode="numeric" defaultValue={property?.pricePerSqft ?? ""} />
          <Select
            label="Show on the website"
            name="priceDisplay"
            defaultValue={property?.priceDisplay ?? "both"}
            options={[
              { value: "both", label: "Total price and rate per sq ft" },
              { value: "total", label: "Total price only" },
              { value: "rate", label: "Rate per sq ft only" },
            ]}
          />
        </div>
        <p className="help">The figure you choose not to show stays here for your own reference. With nothing to show, the website says “Call for price”.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Checkbox label="Slightly negotiable" name="negotiable" defaultChecked={property?.negotiable ?? false} hint="Shown beside the price on the website, in these words." />
          <Checkbox label="Show “Call for price” on the website" name="callForPrice" defaultChecked={property?.callForPrice ?? false} hint="The figures above stay here for your own reference and are not shown to visitors." />
        </div>
      </Group>

      <Group title="Description">
        <div className="grid gap-5 md:grid-cols-2">
          <Textarea label="Description (English)" name="descriptionEn" rows={6} defaultValue={property?.descriptionEn} hint="Separate paragraphs with a blank line." />
          <Textarea label="Description (ಕನ್ನಡ)" name="descriptionKn" rows={6} defaultValue={property?.descriptionKn} lang="kn" />
          <Textarea
            label="Highlights, one per line"
            name="features"
            rows={5}
            defaultValue={bilingualToLines(property?.features)}
            hint="Format: English | ಕನ್ನಡ. The Kannada half is optional."
            placeholder={"Water and drainage on the street | ರಸ್ತೆಯಲ್ಲೇ ನೀರು ಮತ್ತು ಒಳಚರಂಡಿ"}
          />
          <Textarea
            label="Documents available, one per line"
            name="documents"
            rows={5}
            defaultValue={approvalsToLines(property?.documents)}
            hint="Format: Name | ಕನ್ನಡ | Reference number. Kannada and number are optional."
            placeholder={"E-khata | ಇ-ಖಾತೆ\nEncumbrance certificate, 30 years"}
          />
        </div>
      </Group>

      <Group title="Office only" note="Never shown on the website.">
        <BrokerPicker source={property?.source ?? "seller"} brokerId={property?.brokerId ?? null} dealTerms={property?.dealTerms ?? ""} brokers={brokers} error={e.brokerId} />
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Input label="Owner's name" name="ownerName" defaultValue={property?.ownerName} autoComplete="off" />
          <Input label="Owner's phone" name="ownerPhone" type="tel" inputMode="tel" defaultValue={property?.ownerPhone} autoComplete="off" className="num" />
          <Textarea label="Private notes" name="privateNotes" rows={3} defaultValue={property?.privateNotes} wrapperClassName="md:col-span-2" placeholder="Asking price flexibility, key holder, commission agreed" />
        </div>
      </Group>

      <div className="grid gap-3 sm:grid-cols-2">
        <Checkbox label="Published" name="published" defaultChecked={property?.published ?? false} hint="Visible on the website. Leave off while the listing is a draft." />
        <Checkbox label="Featured" name="featured" defaultChecked={property?.featured ?? false} hint="Shown first on the home page." />
      </div>

      <div className="sticky bottom-[58px] z-10 -mx-4 border-t border-navy-900/10 bg-paper-0/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:bottom-0">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
