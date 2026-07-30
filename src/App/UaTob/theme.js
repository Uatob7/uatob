// theme.js — UaTob v12 rider design tokens.
//
// One source of truth so every rider surface reads the same and stays legible.
// v12 fixes the "black / invisible text" problem by dropping low-opacity greys
// (rgba(255,255,255,.22/.45)) for solid, chosen colors, gives money its own
// gold hue, and uses system + monospace faces (no webfont that can silently
// fall back and mangle text).

export const C = {
  // grounds — green-black, not pure black
  bg:          '#06110D',
  bgDeep:      '#04100C',
  panel:       'rgba(14,33,26,.86)',
  panelHi:     '#12291F',

  // brand green
  green:       '#2FE08A',
  greenBright: '#5CEBA0',
  greenSoft:   '#34E39A',

  // supporting hues
  cyan:        '#3FD0EE',   // pickup / route start
  amber:       '#F5C34B',   // money / ride credit (gold)
  gold:        '#F5C34B',
  red:         '#FF6B6B',
  purple:      '#C08CF7',
  blue:        '#5AA9F0',

  // ink — high contrast, never faint
  inkBright:   '#ECF7F1',
  inkMid:      '#93A79E',
  inkDim:      '#7E938A',
  inkFade:     'rgba(126,186,162,.14)',

  // lines
  border:       'rgba(126,186,162,.16)',
  borderBright: 'rgba(47,224,138,.32)',
};

export const MONO = "ui-monospace,'SFMono-Regular',Menlo,Consolas,monospace";
export const BODY = "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
export const COND = BODY;   // headings carry weight, not a condensed webfont
