"use client";

import {useEffect, useRef} from "react";

const ROADMAP_ID = "bdf5c688-ffe3-41ec-b8c4-6bac40db3fd9";
const EMBED_KEY = "tle_TBOlq3lBNxKq649ZTnoRCByG"; // public: only used to count views

// The TrackLin.es widget renders where its <script> tag sits. Added on mount (not next/script) so it
// runs again after a client-side navigation back to this page.
export default function RoadmapEmbed() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const script = document.createElement("script");
    script.src = "https://tracklin.es/embed.js";
    script.dataset.roadmap = ROADMAP_ID;
    script.dataset.key = EMBED_KEY;
    el.appendChild(script);
    return () => el.replaceChildren();
  }, []);

  return <div ref={ref} />;
}
