import { ExternalLink, MapPinned, Pencil, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { PropertyQuickControls } from "@/components/admin/PropertyQuickControls";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { ListingStatusBadge } from "@/components/site/StatusBadge";
import { listAllProperties, listBrokers, listPropertyCorners } from "@/lib/db/queries";
import { en } from "@/lib/i18n/dictionaries/en";
import { formatPropertyNo, refSlug } from "@/lib/refs";
import { formatArea, formatINRShort } from "@/lib/utils";

export const metadata = { title: "Properties" };

export default async function PropertiesAdminPage() {
  const properties = await listAllProperties();
  const [surveyed, brokers] = await Promise.all([listPropertyCorners(properties.map((p) => p.id)), listBrokers()]);
  const brokerName = new Map(brokers.map((b) => [b.id, b.name]));

  return (
    <>
      <PageHeader
        title="Properties"
        description="Listings that stand on their own: a single site, a house, land or a building. Sites inside a layout are kept under Projects."
        actions={
          <Link href="/admin/properties/new" className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden="true" /> New property
          </Link>
        }
      />

      {properties.length ? (
        <ul className="space-y-3">
          {properties.map((p) => (
            <li key={p.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <div className="bg-grid relative h-20 w-full shrink-0 overflow-hidden bg-paper-100 sm:w-28">
                {p.images[0] ? <Image src={p.images[0]} alt="" fill sizes="120px" className="object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="ref">{formatPropertyNo(p.prefix, p.propertyNo)}</span>
                  <ListingStatusBadge status={p.status} label={en.status.listing[p.status]} />
                  {p.published ? null : <span className="badge bg-paper-200 text-ink-700">Draft</span>}
                  {p.featured ? <span className="badge bg-gold-100 text-gold-800">Featured</span> : null}
                  <span className={p.source === "broker" ? "badge bg-navy-900 text-gold-200" : "badge bg-paper-200 text-ink-700"}>
                    {p.source === "broker" ? `Broker${p.brokerId && brokerName.get(p.brokerId) ? `: ${brokerName.get(p.brokerId)}` : ""}` : "Seller"}
                  </span>
                  {surveyed.has(p.id) ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-success-700">
                      <MapPinned className="h-3.5 w-3.5" aria-hidden="true" /> Surveyed
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 truncate text-[15px] font-semibold text-navy-900">{p.titleEn}</p>
                <p className="num mt-0.5 truncate text-[13px] text-ink-600">
                  {[en.types[p.type], p.locationEn, p.dimension ? `${p.dimension} ft` : "", p.areaSqft ? formatArea(p.areaSqft, p.areaUnit) : "", p.price ? formatINRShort(p.price) : "", p.callForPrice ? "shown as Call for price" : ""].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <PropertyQuickControls id={p.id} status={p.status} published={p.published} />
                {p.published ? (
                  <a href={`/en/properties/${refSlug(p.prefix, p.propertyNo)}`} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm" aria-label="View on the website">
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                ) : null}
                <Link href={`/admin/properties/${p.id}`} className="btn-outline btn-sm">
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No properties yet"
          text="Add one here, or start with a field survey on the site and turn it into a listing afterwards."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/admin/properties/new" className="btn-primary btn-sm">
                <Plus className="h-4 w-4" aria-hidden="true" /> New property
              </Link>
              <Link href="/admin/surveys/new" className="btn-outline btn-sm">
                <MapPinned className="h-4 w-4" aria-hidden="true" /> New survey
              </Link>
            </div>
          }
        />
      )}
    </>
  );
}
