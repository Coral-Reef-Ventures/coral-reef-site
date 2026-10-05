import { AdminFrame } from "../AdminFrame.tsx";
import { ActivityView } from "../../../src/features/people/activity/index.ts";

export default function Page() {
  return (
    <AdminFrame title="Activity">
      <ActivityView />
    </AdminFrame>
  );
}
