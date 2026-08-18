import { CheckScreen } from "@/components/check/CheckScreen";

// The aisle check (screen 01) is the core loop and the live URL's root:
// client-rendered from the on-device catalogue index with no server round
// trip in the read path (PLAN.md's offline boundary). Runs fully signed
// out, per DESIGN.md note 2.
export default function CheckPage() {
  return <CheckScreen />;
}
