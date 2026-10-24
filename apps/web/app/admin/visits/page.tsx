import { AdminFrame } from "../AdminFrame.tsx";
import { VisitsView } from "../../../src/features/visits/page-counts/index.ts";

export default function Page() {
  return (
    <AdminFrame title="Visits">
      <VisitsView />
    </AdminFrame>
  );
}
