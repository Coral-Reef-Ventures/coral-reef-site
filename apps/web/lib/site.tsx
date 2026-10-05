import { createSite } from "@coralreefventures/site";

import { SchemeControl } from "./scheme.tsx";

export const siteUrl = "https://coralreefventures.com";
export const contactEmail = "hello@coralreefventures.com";

/** The mark and the name: the way home. A plain image, so the header ships no client code. */
const Lockup = () => (
  <span className="door-lockup">
    {/* biome-ignore lint/performance/noImgElement: a static export has no image optimizer, and the mark is a 2 KB SVG. */}
    <img src="/icon.svg" alt="" width={28} height={28} style={{ borderRadius: "0.4rem" }} />
    <span className="door-lockup-name">Coral Reef Ventures</span>
  </span>
);

/**
 * The shell, bound to Coral Reef Ventures. The door has one page to reach, where the form and the sign-in are, and no social cards: the card builder
 * fetches a web font at build time, and this site loads nothing from another origin.
 */
export const site = createSite({
  name: "Coral Reef Ventures",
  url: siteUrl,
  description: "Open foundations and focused tools for creating software with humans and AI working together.",
  nav: [{ key: "involved", label: "Get involved", href: "/get-involved/" }],
  lockup: <Lockup />,
  actions: [],
  // In the bar at every width, after the nav and before the folded menu's button (reef 0.3.0). The slot keeps the
  // collapsed pill's size, so opening the pill moves nothing: leftward over the bar on a wide screen, downward under
  // it on a phone, where leftward would cover the lockup.
  headerTools: (
    <span className="door-scheme-slot">
      <SchemeControl />
    </span>
  ),
  footer: {
    maker: (
      <>
        Open foundations and focused products for software teams. © 2026 Coral Reef Ventures · Write to{" "}
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
      </>
    ),
    links: [{ label: "Privacy", href: "/privacy/" }],
    trademarks: [],
  },
  cards: {},
  socialCard: { background: "#141a19", text: "#ece7dc", muted: "#a9ab9f", accent: "#f29a74", mark: null },
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }] },
  themeColor: "#b8461f",
});

export const { SiteHeader, SiteFooter, rootMetadata, rootViewport } = site;
