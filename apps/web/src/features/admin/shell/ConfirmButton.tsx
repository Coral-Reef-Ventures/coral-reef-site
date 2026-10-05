"use client";

import { Button, Group } from "@mantine/core";
import { useState } from "react";

/**
 * A destructive action that asks once. The first click only opens the question, so a stray click changes nothing
 * and the person sees exactly what the second click will do.
 */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  disabled,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <Button variant="default" color="red" size="xs" disabled={disabled} onClick={() => setAsking(true)}>
        {label}
      </Button>
    );
  }
  return (
    <Group gap="xs" role="group" aria-label={`Confirm: ${confirmLabel}`}>
      <Button
        color="red"
        size="xs"
        onClick={async () => {
          setAsking(false);
          await onConfirm();
        }}
      >
        {confirmLabel}
      </Button>
      <Button variant="subtle" size="xs" onClick={() => setAsking(false)}>
        Cancel
      </Button>
    </Group>
  );
}
