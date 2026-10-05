import { type BrandTokens, createBrandTheme } from "@coralreefventures/theme";
import { coral, ink } from "@crv/brand/tokens";

/** The brand's colors by name, as the theme builder reads them. */
export const tokens: BrandTokens = {
  name: "Coral Reef Ventures",
  color: { coral: coral.light, "coral-dark": coral.dark, ink: ink.light },
};

/**
 * Coral from the brand tokens at its fixed points: the light scheme's coral is shade 7 and the dark scheme's lighter
 * tint is shade 3. The door's own stylesheet resolves every color with light-dark(), so these two shades are all the
 * shell's primary color ever needs.
 */
export const theme = createBrandTheme(tokens, {
  colors: {
    coral: [
      "#fdf3ee",
      "#fae1d6",
      "#f6c8b5",
      "coral-dark",
      "#ea7f52",
      "#d65f33",
      "#c9522a",
      "coral",
      "#9a3a19",
      "#7a2e14",
    ],
  },
  black: "ink",
  primaryColor: "coral",
  primaryShade: { light: 7, dark: 3 },
  fontVariable: "--crv-font-sans",
});
