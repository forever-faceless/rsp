"use client";

import dynamic from "next/dynamic";
import type { SurveyToolProps } from "./SurveyTool";

const SurveyTool = dynamic(() => import("./SurveyTool"), {
  ssr: false,
  loading: () => (
    <div className="flex h-dvh items-center justify-center bg-navy-900 text-[14px] font-medium text-navy-200" role="status">
      Opening the survey
    </div>
  ),
});

/** The survey tool needs the browser (map, GPS, storage), so it is never rendered on the server. */
export function SurveyLoader(props: SurveyToolProps) {
  return <SurveyTool {...props} />;
}
