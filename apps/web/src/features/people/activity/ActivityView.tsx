"use client";

import { SegmentedControl } from "@mantine/core";
import { useState } from "react";
import { ACTIVITY_AREAS, type ActivityArea } from "../../../infrastructure/amplify/api.ts";
import { ScrollRow, titleCase } from "../../admin/shell/index.ts";
import { ActivityList } from "./ActivityList.tsx";

/** Recent Activity, by area. */
export function ActivityView() {
  const [area, setArea] = useState<ActivityArea | "all">("all");
  return (
    <>
      <ScrollRow>
        <SegmentedControl
          aria-label="Area"
          value={area}
          onChange={(value) => setArea(value as ActivityArea | "all")}
          data={[{ value: "all", label: "All" }, ...ACTIVITY_AREAS.map((a) => ({ value: a, label: titleCase(a) }))]}
        />
      </ScrollRow>
      <ActivityList query={{ area: area === "all" ? undefined : area, limit: 100 }} />
    </>
  );
}
