import { AdminShell } from "../../../src/features/admin/shell/index.ts";
import { ActivityView } from "../../../src/features/people/activity/index.ts";

export default function Page() {
  return (
    <AdminShell title="Activity">
      <ActivityView />
    </AdminShell>
  );
}
