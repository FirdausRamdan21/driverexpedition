"use client";

import dynamic from "next/dynamic";
import type { MultiDropMapProps } from "./MultiDropMap";

const DynamicMultiDropMap = dynamic(() => import("./MultiDropMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[400px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-sm text-slate-500">
      Memuat peta interaktif Leaflet...
    </div>
  ),
});

export function MapWrapper(props: MultiDropMapProps) {
  return <DynamicMultiDropMap {...props} />;
}
