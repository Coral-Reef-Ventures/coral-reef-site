import { AdminFrame } from "../AdminFrame.tsx";
import { Suspense } from "react";
import { SubmissionDetail } from "../../../src/features/interest/submissions/index.ts";

export default function Page() {
  return (
    <AdminFrame title="Submission">
      <Suspense>
        <SubmissionDetail />
      </Suspense>
    </AdminFrame>
  );
}
