"use client";

import { useEffect, useState } from "react";
import type { EnquiryState } from "@/lib/actions/enquiry";
import { identifyLead, track, visitId } from "@/lib/analytics";

/** The visit's recording id, sent with a form so the office can watch how the enquiry came about. */
export function VisitField() {
  const [id, setId] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- known only in the browser, once the page is running
  useEffect(() => setId(visitId()), []);
  return <input type="hidden" name="sessionId" value={id} />;
}

/** Counts a sent form once, and ties the visitor to it by its register number only. */
export function useCountSent(state: EnquiryState, form: "enquire" | "sell", ref: string) {
  useEffect(() => {
    if (state.status !== "success") return;
    track("enquiry_sent", { form, ...(ref ? { ref } : {}) });
    identifyLead(state.leadId, ref);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
}
