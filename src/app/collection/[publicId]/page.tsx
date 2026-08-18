import { CollectionItemScreen } from "@/components/collection/CollectionItemScreen";

// A single collection item (PLAN.md's offline boundary). The dynamic
// segment is named `publicId` for consistency with the rest of the app's
// routing, but the value it actually carries is the on-device copy's own
// id: an anonymous, offline-first copy has no server-issued public_id of
// its own to route by (only a matched copy's underlying variant does, and
// an Unfiled copy has no variant at all), so the copy id is the one key
// that resolves every case client-side, with no server round trip.
export default async function CollectionItemPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  return <CollectionItemScreen id={publicId} />;
}
