/**
 * Coral Reef Ventures' brand tokens. Each color is a light/dark pair, written the way the door's stylesheet
 * (apps/web/app/door.css) writes it: `light-dark(light, dark)`. tokens.test.ts holds the two together.
 */

export type ColorPair = { readonly light: string; readonly dark: string };

/** The coral tile of the mark and the focus ring: one color in light, a lighter tint of it in dark. */
export const coral = { light: "#b8461f", dark: "#f29a74" } as const satisfies ColorPair;

/** Text, from the page's own tokens. */
export const ink = { light: "#2e3836", dark: "#ece7dc" } as const satisfies ColorPair;
export const inkMuted = { light: "#5b6159", dark: "#a9ab9f" } as const satisfies ColorPair;

/** Surfaces and rules. */
export const paper = { light: "#fbf5ed", dark: "#141a19" } as const satisfies ColorPair;
export const surface = { light: "#f4ece0", dark: "#1b2221" } as const satisfies ColorPair;
export const border = { light: "#ddd5c9", dark: "#333b39" } as const satisfies ColorPair;

/** The mark's own tile, which does not change with the scheme. */
export const markTile = "#b8461f";

export const tokens = { coral, ink, inkMuted, paper, surface, border } as const;

/** A pair as CSS. */
export function lightDark(pair: ColorPair): string {
  return `light-dark(${pair.light}, ${pair.dark})`;
}
