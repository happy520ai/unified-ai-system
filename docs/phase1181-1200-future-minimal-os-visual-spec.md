# Phase1181-1200 Future Minimal OS Visual Spec

## Layout

The first screen behaves like an OS mission entry, not a backend dashboard. It keeps five visible priorities: product identity, mission command input, one primary CTA, Normal / God / Tianshu mode choices, and a bottom safety dock.

## Color Tokens

Use white, cold gray, and light blue. Surfaces are translucent white with low-noise borders. Accent is blue to violet only on the primary CTA and selected mode.

## Spacing and Typography

Use generous spacing, system font stack, clear hierarchy, and no viewport-scaled body text. Headline is large; cards and docks stay compact.

## Elevation

Use soft shadows for the shell and command surface. Avoid heavy dark sidebars, heavy panels, or dense HUD effects.

## Interaction States

Mission input receives a soft blue glow on focus. Mode cards lift subtly on hover/focus. Reduced motion disables decorative transitions.

## Copy Rules

Copy is short, plain Chinese. First screen must not expose raw engineering wording. Advanced Provider / Evidence / Diagnostics details stay folded by default.

## Safety Copy Rules

The UI may say what it will not do: no Provider call, no secret read, no deploy, no default chat-chain change. It must not offer these as actions.
