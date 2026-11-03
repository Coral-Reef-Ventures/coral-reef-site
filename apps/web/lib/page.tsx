import type { ReactNode } from "react";

import { renderSource, type Segment, segments } from "./markset.ts";

/**
 * A content file as a page: each stretch of Markset in its own document, and each `{{slot}}` replaced by the
 * component the page names for it, then `after`, Markset source the page builds itself (an article's end), as a document
 * of its own. The HTML is the build's own rendering of files and tables in this repository, not input.
 */
export const DoorDocument = ({
  file,
  slots = {},
  after,
}: {
  file: string;
  slots?: Record<string, ReactNode>;
  after?: string;
}) => (
  <div className="door" data-page={file.replace(/\.md$/, "")}>
    {segments(file, Object.keys(slots)).map((part: Segment, index) =>
      "html" in part ? (
        // biome-ignore lint/security/noDangerouslySetInnerHtml: rendered at build from this repository's own content files.
        // biome-ignore lint/suspicious/noArrayIndexKey: the stretches are a fixed list built once, and their order is their identity.
        <div key={`${file}-${index}`} className="ms-document" dangerouslySetInnerHTML={{ __html: part.html }} />
      ) : (
        <div key={`${file}-${part.slot}`} className="door-slot">
          {slots[part.slot]}
        </div>
      ),
    )}
    {after === undefined ? null : (
      <div
        className="ms-document door-after"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: rendered at build from this repository's own article table.
        dangerouslySetInnerHTML={{ __html: renderSource(after, `${file} (after)`) }}
      />
    )}
  </div>
);
