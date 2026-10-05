import type { Metadata } from "next";
import type { ReactNode } from "react";

// The admin views are for admins and are never indexed; robots.ts disallows the path as well.
export const metadata: Metadata = {
  title: "Admin · Coral Reef Ventures",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
