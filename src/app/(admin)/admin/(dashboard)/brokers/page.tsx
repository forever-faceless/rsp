import { ConfirmButton, EmptyState, PageHeader, Section, SubmitButton } from "@/components/admin/ui";
import { deleteBroker, saveBroker } from "@/lib/actions/brokers";
import { listBrokers } from "@/lib/db/queries";

export const metadata = { title: "Brokers" };

/** The office's own list of brokers. Never shown on the website. */
export default async function BrokersPage() {
  const brokers = await listBrokers();
  return (
    <>
      <PageHeader
        title="Brokers"
        description="Brokers who bring properties to the office. Pick one on a property's form under Office only; a broker added there appears here too. None of this is ever shown on the website."
      />

      <div className="space-y-6">
        <Section title="Add a broker">
          <form action={saveBroker.bind(null, null)} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
            <BrokerFields />
            <SubmitButton className="btn-sm">Add broker</SubmitButton>
          </form>
        </Section>

        {brokers.length ? (
          <ul className="space-y-3">
            {brokers.map((b) => (
              <li key={b.id} className="card p-4 sm:p-5" data-broker-row>
                <form action={saveBroker.bind(null, b.id)} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
                  <BrokerFields broker={b} />
                  <SubmitButton className="btn-sm" variant="outline">
                    Save
                  </SubmitButton>
                </form>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[13px] text-ink-600">{b.listings === 1 ? "1 property listed through this broker" : `${b.listings} properties listed through this broker`}</p>
                  <ConfirmButton action={deleteBroker.bind(null, b.id)} label="Remove" confirmLabel="Yes, remove" />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No brokers yet" text="Add one here, or choose Broker on a property's form and add them there." />
        )}
      </div>
    </>
  );
}

function BrokerFields({ broker }: { broker?: { name: string; phone: string; firm: string; notes: string } }) {
  return (
    <>
      <label className="text-[12.5px] font-semibold text-ink-700">
        Name
        <input name="name" required minLength={2} maxLength={120} defaultValue={broker?.name} autoComplete="off" className="field mt-1" />
      </label>
      <label className="text-[12.5px] font-semibold text-ink-700">
        Mobile number
        <input name="phone" type="tel" inputMode="tel" maxLength={20} defaultValue={broker?.phone} autoComplete="off" className="field num mt-1" />
      </label>
      <label className="text-[12.5px] font-semibold text-ink-700">
        Firm
        <input name="firm" maxLength={120} defaultValue={broker?.firm} autoComplete="off" className="field mt-1" />
      </label>
      <label className="text-[12.5px] font-semibold text-ink-700 md:order-last md:col-span-4">
        Notes
        <input name="notes" maxLength={2000} defaultValue={broker?.notes} autoComplete="off" placeholder="Areas they cover, usual commission" className="field mt-1" />
      </label>
    </>
  );
}
