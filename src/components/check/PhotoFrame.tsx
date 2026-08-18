"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useT } from "@/lib/i18n";
import { getPhoto } from "@/lib/device/collection";

// Renders the user's own cached photograph, never a community one (DESIGN.md
// note 1, F5). With no photo attached, this renders the 45 degree no-photo
// hatch instead of an empty box, with a decorative marking (aria-hidden)
// plus a real, visible lead and next action (C20), per C6 and
// .forge/directions/5-chromatic-3-verdicts.jpg.
export function PhotoFrame({
  photoId,
  title,
}: {
  photoId: string | null;
  title: string;
}) {
  const t = useT();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    // Nothing to fetch: the guard branch below already renders the
    // no-photo state from the initial `useState(null)`, so there is no
    // second setState call needed for the "no photo" case here.
    if (!photoId) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    getPhoto(photoId).then((photo) => {
      if (cancelled || !photo) return;
      objectUrl = URL.createObjectURL(photo.blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoId]);

  if (url) {
    return (
      <div className="photoFrame">
        {/* A device-local blob URL, never a remote asset: Next's image
            optimizer has nothing to fetch or cache here. */}
        <Image src={url} alt={t("photo.owned.alt", { title })} fill unoptimized sizes="100vw" />
      </div>
    );
  }

  return (
    // No role="img" here: the icon is decorative (aria-hidden) but the
    // lead and action below are real content, not a caption standing in
    // for a picture, so they belong in the accessibility tree as ordinary
    // text rather than flattened into a single image label (C20). A
    // screen reader reads the two sentences themselves; a sighted
    // collector reads them too, which is the defect this replaces (the
    // no-photo state previously carried its only text behind
    // clip-path: inset(50%), so nobody sighted ever saw it).
    <div className="photoFrame np">
      <svg width="24" height="24" viewBox="0 0 28 28" aria-hidden="true">
        <path
          d="M4 8 L20 8 L24 12 V24 H4 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle cx="10" cy="16" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <p className="npLead">{t("photo.none.lead")}</p>
      <p className="npAction">{t("photo.none.action")}</p>
    </div>
  );
}
