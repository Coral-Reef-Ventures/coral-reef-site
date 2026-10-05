import { Suspense } from "react";
import { AdminShell } from "../../../src/features/admin/shell/index.ts";
import { SubmissionDetail } from "../../../src/features/interest/submissions/index.ts";

export default function Page() {
  return (
    <AdminShell title="Submission">
      <Suspense>
        <SubmissionDetail />
      </Suspense>
    </AdminShell>
  );
}
