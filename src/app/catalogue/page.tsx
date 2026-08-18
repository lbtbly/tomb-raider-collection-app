import { Suspense } from "react";
import { CatalogueIndexScreen } from "@/components/catalogue/CatalogueIndexScreen";

// The offline catalogue index (PLAN.md's offline boundary): client-rendered
// from the on-device copy with no server round trip in the read path. The
// Doors component's "search by title" link carries a `?q=` param
// (verdict.notInCollection.doors.search), which is why this needs its own
// Suspense boundary around the client component that reads it.
export default function CataloguePage() {
  return (
    <Suspense fallback={null}>
      <CatalogueIndexScreen />
    </Suspense>
  );
}
