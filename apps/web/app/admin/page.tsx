import { SubmissionsView } from "../../src/features/interest/submissions/index.ts";
import { AdminShell } from "../../src/features/admin/shell/index.ts";

export default function Page() {
  return (
    <AdminShell title="Submissions">
      <SubmissionsView />
    </AdminShell>
  );
}
