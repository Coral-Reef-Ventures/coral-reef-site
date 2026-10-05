import { InvitationsView } from "../../../src/features/access/invitations/index.ts";
import { AdminShell } from "../../../src/features/admin/shell/index.ts";

export default function Page() {
  return (
    <AdminShell title="Invitations">
      <InvitationsView />
    </AdminShell>
  );
}
