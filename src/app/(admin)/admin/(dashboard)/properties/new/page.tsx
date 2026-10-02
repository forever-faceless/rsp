import { MapPinned } from "lucide-react";
import Link from "next/link";
import { PropertyForm } from "@/components/admin/PropertyForm";
import { PageHeader, Section } from "@/components/admin/ui";
import { createProperty } from "@/lib/actions/properties";
import { getSettings, listBrokers, listRegions } from "@/lib/db/queries";
import { regionOptions } from "@/lib/regions";

export const metadata = { title: "New property" };

export default async function NewPropertyPage() {
  const [settings, regions, brokers] = await Promise.all([getSettings(), listRegions(), listBrokers()]);
  return (
    <>
      <PageHeader title="New property" description="Save the basics first. Photos, video, landmarks and the survey are added on the next screen." back={{ href: "/admin/properties", label: "Properties" }} />

      <div className="mb-6 flex flex-col gap-3 rounded-[4px] border border-navy-900/12 bg-navy-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <p className="text-[14.5px] font-semibold text-navy-900">Want the plot on the map, with its boundary and measurements?</p>
          <p className="mt-1 max-w-3xl text-[13.5px] leading-relaxed text-ink-700">
            Start with a field survey instead. Walk the corners with your phone, tap them on the satellite map from your desk, type the width and depth, or import a drawing from Google Earth. The survey then creates the property for you with
            the location and size already filled in. A property made here can also be mapped afterwards, from its Survey section.
          </p>
        </div>
        <Link href="/admin/surveys/new" className="btn-primary btn-sm shrink-0">
          <MapPinned className="h-4 w-4" aria-hidden="true" /> Start a survey
        </Link>
      </div>

      <Section title="Property details">
        <PropertyForm action={createProperty} submitLabel="Create property" regions={regionOptions(regions)} defaultPrefix={settings.propertyPrefix} brokers={brokers.map(({ id, name, phone, firm }) => ({ id, name, phone, firm }))} />
      </Section>
    </>
  );
}
