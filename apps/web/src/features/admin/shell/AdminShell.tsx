"use client";

import { Alert, Anchor, Container, createTheme, Group, MantineProvider, Title } from "@mantine/core";
import "@mantine/core/styles.css";
import Link from "next/link";
import type { ReactNode } from "react";

const theme = createTheme({
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
  primaryColor: "dark",
});

export const ADMIN_LINKS = [
  { href: "/admin/", label: "Submissions" },
  { href: "/admin/invitations/", label: "Invitations" },
  { href: "/admin/activity/", label: "Activity" },
] as const;

/** The admin pages' frame: Mantine's provider, the three views and nothing that loads from another origin. */
export function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      {/* The shell's column (--site-max-width, --site-gutter), so the views line up with the header's lockup and its right edge. */}
      <Container size="var(--site-max-width)" px="var(--site-gutter)" py="md">
        <Group component="nav" aria-label="Admin" gap="md" mb="md">
          {ADMIN_LINKS.map((link) => (
            <Anchor key={link.href} component={Link} href={link.href}>
              {link.label}
            </Anchor>
          ))}
        </Group>
        <Title order={1} size="h2" mb="md">
          {title}
        </Title>
        {children}
      </Container>
    </MantineProvider>
  );
}

export function ErrorNotice({ message }: { message: string }) {
  return (
    <Alert color="red" title="Could not complete that" role="alert">
      {message}
    </Alert>
  );
}
