import { AdminFrame } from "./AdminFrame.tsx";
import { SubmissionsView } from "../../src/features/interest/submissions/index.ts";

export default function Page() {
  return (
    <AdminFrame title="Submissions">
      <SubmissionsView />
    </AdminFrame>
  );
}
