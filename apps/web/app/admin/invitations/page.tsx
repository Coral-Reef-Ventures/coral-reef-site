import { AdminFrame } from "../AdminFrame.tsx";
import { InvitationsView } from "../../../src/features/access/invitations/index.ts";

export default function Page() {
  return (
    <AdminFrame title="Invitations">
      <InvitationsView />
    </AdminFrame>
  );
}
