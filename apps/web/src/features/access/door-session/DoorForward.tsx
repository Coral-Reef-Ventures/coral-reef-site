"use client";

import { useEffect } from "react";

import { forwardFor } from "./forward.ts";

/**
 * On the home page: sends a visit meant for the sign-in or the form on to /get-involved/ (see forwardFor). Renders
 * nothing, and does nothing on an ordinary visit.
 */
export const DoorForward = () => {
  useEffect(() => {
    const target = forwardFor(window.location.search, window.location.hash);
    if (target !== null) window.location.replace(target);
  }, []);
  return null;
};
