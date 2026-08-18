import { CollectionListScreen } from "@/components/collection/CollectionListScreen";

// The collection list (screen 04's slice-1 slice): client-rendered from the
// on-device copy with no server round trip in the read path (PLAN.md's
// offline boundary). Runs fully signed out, per DESIGN.md note 2.
export default function CollectionPage() {
  return <CollectionListScreen />;
}
