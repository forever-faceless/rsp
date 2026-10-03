"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { WhatsAppIcon } from "@/components/site/PhoneLinks";

type Props = { base: string; slug: string; published: boolean; label: string };

function LinkRow({ title, note, url, label }: { title: string; note: string; url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the link is still there to select by hand.
    }
  };
  return (
    <div className="rounded-[4px] border border-navy-900/12 bg-paper-50 p-4">
      <p className="text-[14px] font-semibold text-navy-900">{title}</p>
      <p className="mt-0.5 text-[12.5px] text-ink-500">{note}</p>
      <input readOnly value={url} onFocus={(ev) => ev.target.select()} aria-label={title} className="field num mt-3 !bg-paper-0 text-[13px]" data-share-url />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={copy} className="btn-primary btn-sm">
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
          {copied ? "Copied" : "Copy link"}
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent(`${label}\n${url}`)}`} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
          <WhatsAppIcon className="h-3.5 w-3.5" /> WhatsApp
        </a>
        <a href={url} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Open
        </a>
      </div>
    </div>
  );
}

/** The addresses to hand out for one listing: straight to the quick enquiry, or to the full listing. */
export function ShareLinks({ base, slug, published, label }: Props) {
  const [lang, setLang] = useState<"en" | "kn">("en");
  const [from, setFrom] = useState("instagram");
  if (!published) {
    return <p className="text-[14px] text-ink-600">Tick Published and save first. Until then the links would show a page that does not exist.</p>;
  }
  const tag = from ? `?from=${from}` : "";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-[12.5px] font-semibold text-ink-700">
          Language of the page
          <select value={lang} onChange={(ev) => setLang(ev.target.value as "en" | "kn")} className="field mt-1 !py-2 text-[14px]">
            <option value="en">English</option>
            <option value="kn">ಕನ್ನಡ</option>
          </select>
        </label>
        <label className="text-[12.5px] font-semibold text-ink-700">
          Where it is shared
          <select value={from} onChange={(ev) => setFrom(ev.target.value)} className="field mt-1 !py-2 text-[14px]">
            <option value="instagram">Instagram</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="facebook">Facebook</option>
            <option value="">Not marked</option>
          </select>
        </label>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <LinkRow
          title="Quick enquiry link"
          note="Opens straight on the questions and the number, with the property beside them. For people who have already seen the post."
          url={`${base}/${lang}/properties/${slug}/interest${tag}`}
          label={label}
        />
        <LinkRow title="Full listing link" note="The whole listing page: photos, plan, map and distances." url={`${base}/${lang}/properties/${slug}`} label={label} />
      </div>
      <p className="text-[12.5px] text-ink-500">Enquiries that come through the quick enquiry link show where they came from on the Leads page.</p>
    </div>
  );
}
