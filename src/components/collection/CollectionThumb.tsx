"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { getPhoto } from "@/lib/device/collection";

// A 56px list thumbnail (the .thumb box already used elsewhere for a
// collection row), reading the on-device photo blob directly -- never a
// remote image, so this renders exactly the same offline as online (F12).
export function CollectionThumb({ photoId, title }: { photoId: string | null; title: string }) {
  const t = useT();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
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
      <div className="thumb">
        {/* eslint-disable-next-line @next/next/no-img-element -- a device-local blob URL, never a remote asset for Next's image optimizer to fetch */}
        <img src={url} alt={t("photo.owned.alt", { title })} />
      </div>
    );
  }

  return (
    // 56px leaves no room for the full lead/action pair PhotoFrame.tsx
    // carries (C20): "No photograph filed for this entry. Yours would be
    // the first." does not fit a thumbnail at any legible size. role="img"
    // stays here, unlike PhotoFrame: the visible label below is the same
    // short fact the aria-label already states, not a second, longer
    // statement a screen reader would need read twice, so collapsing both
    // into one accessible name loses nothing. The full statement, with its
    // next action, still lives one tap away on the item's own page, where
    // PhotoFrame.tsx renders it in full.
    <div className="thumb np" role="img" aria-label={t("photo.none.alt")}>
      <span className="thumbNoPhoto" aria-hidden="true">
        {t("photo.none.short")}
      </span>
    </div>
  );
}
