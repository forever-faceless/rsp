import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { LandmarkEditor } from "@/components/admin/LandmarkEditor";
import { PhotoManager } from "@/components/admin/PhotoManager";
import { PropertyForm } from "@/components/admin/PropertyForm";
import { SurveyPanel } from "@/components/admin/SurveyPanel";
import { ConfirmButton, PageHeader, Section, SectionNav } from "@/components/admin/ui";
import { VideoManager } from "@/components/admin/VideoManager";
import { deleteLandmark, saveLandmark } from "@/lib/actions/landmarks";
import { addVideoLink, attachUploadedVideo, removeVideo } from "@/lib/actions/media";
import { deleteProperty, removePropertyImage, setPropertyCover, updateProperty, uploadPropertyImages } from "@/lib/actions/properties";
import { getPropertyById, getSurveyFor, listBrokers, listLandmarks } from "@/lib/db/queries";
import { siteUrl } from "@/lib/site-url";
import { ShareLinks } from "@/components/admin/ShareLinks";
import { isValidLatLng } from "@/lib/geo";
import { formatPropertyNo, refSlug } from "@/lib/refs";

export const metadata = { title: "Edit property" };

export default async function EditPropertyPage({ params, searchParams }: PageProps<"/admin/properties/[id]">) {
  const { id: rawId } = await params;
  const { created } = await searchParams;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();
  const property = await getPropertyById(id);
  if (!property) notFound();
  const [landmarks, survey, brokers] = await Promise.all([listLandmarks({ propertyId: id }), getSurveyFor({ propertyId: id }), listBrokers()]);
  const prefix = property.prefix;
  const origin = isValidLatLng(property.lat, property.lng) ? { lat: property.lat!, lng: property.lng! } : null;
  const owner = { kind: "property" as const, id };

  return (
    <>
      <PageHeader
        title={property.titleEn}
        refText={formatPropertyNo(prefix, property.propertyNo)}
        description={created ? "Created as a draft. Add photos and a survey, then tick Published when it is ready for the website." : property.published ? "Published on the website." : "Draft. Not visible on the website yet."}
        back={{ href: "/admin/properties", label: "Properties" }}
        actions={
          property.published ? (
            <a href={`/en/properties/${refSlug(prefix, property.propertyNo)}`} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> View on the website
            </a>
          ) : null
        }
      />

      <SectionNav
        items={[
          ["#details", "Details"],
          ["#share", "Share"],
          ["#survey", "Survey"],
          ["#photos", "Photos"],
          ["#videos", "Videos"],
          ["#landmarks", "Landmarks"],
        ]}
      />

      <div className="space-y-6">
        <Section id="details" title="Property details">
          <PropertyForm property={property} action={updateProperty.bind(null, id)} brokers={brokers.map(({ id: bid, name, phone, firm }) => ({ id: bid, name, phone, firm }))} />
        </Section>

        <Section id="share" title="Share" description="Links to send in a DM, a WhatsApp chat or under a post. The enquiry link opens straight on the quick enquiry for this property, with a short preview beside it.">
          <ShareLinks base={siteUrl()} slug={refSlug(prefix, property.propertyNo)} published={property.published} label={formatPropertyNo(prefix, property.propertyNo)} />
        </Section>

        <Section id="survey" title="Site survey" description="The pin that is the property's location, and the boundary as marked on the ground. They put the property on the map and draw its site plan.">
          <SurveyPanel survey={survey} targetKey={`property:${id}`} />
        </Section>

        <Section id="photos" title="Photos" description="The first photo is the cover shown on cards.">
          <PhotoManager images={property.images} uploadAction={uploadPropertyImages.bind(null, id)} removeAction={removePropertyImage.bind(null, id)} coverAction={setPropertyCover.bind(null, id)} />
        </Section>

        <Section id="videos" title="Videos">
          <VideoManager videos={property.videos} linkAction={addVideoLink.bind(null, owner)} attachAction={attachUploadedVideo.bind(null, owner)} removeAction={removeVideo.bind(null, owner)} />
        </Section>

        <Section id="landmarks" title="Nearby landmarks" description="Distances are measured from the survey pin.">
          {origin || landmarks.length ? (
            <LandmarkEditor landmarks={landmarks} origin={origin} saveAction={saveLandmark.bind(null, owner)} deleteAction={deleteLandmark} />
          ) : (
            <p className="rounded-[4px] border border-dashed border-navy-900/20 bg-paper-50 p-4 text-[14px] leading-relaxed text-ink-700">
              Landmarks can be added once the site survey has a pin.{" "}
              <a href="#survey" className="font-semibold text-navy-900 underline decoration-gold-500 decoration-2 underline-offset-4">
                Go to the survey
              </a>
            </p>
          )}
        </Section>

        <Section title="Delete" description={`Deleting retires ${formatPropertyNo(prefix, property.propertyNo)} for good: the number is never issued again. Enquiries about it are kept. To take a sold property off the list, mark it Sold or untick Published instead.`}>
          <ConfirmButton action={deleteProperty.bind(null, id)} label="Delete this property" confirmLabel="Yes, delete it" size="md" />
        </Section>
      </div>
    </>
  );
}
