import { RegionsPanel } from "@/components/admin/RegionsPanel";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { PageHeader } from "@/components/admin/ui";
import { updateSettings } from "@/lib/actions/settings";
import { countRegionUse, countRegisterFigures, getSettings, listRegions } from "@/lib/db/queries";

export const metadata = { title: "Company settings" };

export default async function SettingsPage() {
  const [settings, regions, use, figures] = await Promise.all([getSettings(), listRegions(), countRegionUse(), countRegisterFigures()]);
  return (
    <>
      <PageHeader
        title="Company settings"
        description="Contact details, the districts you list in, property numbering and the wording of the home page."
        actions={
          <a href="#districts" className="btn-outline btn-sm">
            Districts and codes
          </a>
        }
      />
      <SettingsForm settings={settings} regions={regions} figures={figures} action={updateSettings} />
      <div className="mt-6">
        <RegionsPanel regions={regions} mainCode={settings.propertyPrefix} usage={Object.fromEntries(use)} />
      </div>
    </>
  );
}
