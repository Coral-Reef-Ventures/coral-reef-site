"use client";

import { SegmentedControl } from "@mantine/core";
import { useState } from "react";
import { SUBMISSION_STATUSES, type SubmissionStatus } from "../../../infrastructure/amplify/api.ts";
import { getAdminApi } from "../../../infrastructure/amplify/adminClient.ts";
import { ErrorNotice, titleCase, useLoad } from "../../admin/shell/index.ts";
import { SubmissionsTable } from "./SubmissionsTable.tsx";

export function SubmissionsView() {
  const [status, setStatus] = useState<SubmissionStatus>("new");
  const [result] = useLoad(() => getAdminApi().listSubmissions(status), [status]);
  return (
    <>
      <SegmentedControl
        aria-label="Status"
        mb="md"
        value={status}
        onChange={(value) => setStatus(value as SubmissionStatus)}
        data={SUBMISSION_STATUSES.map((s) => ({ value: s, label: titleCase(s) }))}
      />
      {result.state === "error" ? <ErrorNotice message={result.message} /> : null}
      {result.state === "ready" ? <SubmissionsTable rows={result.data} now={new Date()} /> : null}
    </>
  );
}
