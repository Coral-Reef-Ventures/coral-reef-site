import "@coralreefventures/site/base.css";
import "./theme.css";
import "@markset-lang/render-html/css/markset.css";
import "./door.css";

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { rootMetadata, rootViewport, SiteFooter, SiteHeader } from "../lib/site.tsx";
import { SchemeControl, schemeScript } from "../lib/scheme.tsx";

export const metadata: Metadata = rootMetadata();

// The shell is light-only; the door follows the reader's scheme through color-scheme, so the browser chrome does too.
export const viewport: Viewport = { ...rootViewport(), colorScheme: "light dark" };

/**
 * The frame every page shares: the skip link, the header, the scheme control, the page, the footer. System fonts only:
 * nothing loads from another origin. The theme's variables are a generated stylesheet (app/theme.css), so no page needs a provider or a
 * script to have them, and the scheme script is the only script the frame carries.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-mantine-color-scheme="light">
      <body>
        <script>{schemeScript}</script>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SiteHeader />
        <div className="door-tools">
          <SchemeControl />
        </div>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
