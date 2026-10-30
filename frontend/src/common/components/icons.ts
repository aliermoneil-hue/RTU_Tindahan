/**
 * ICON PATHS
 * ---------------------------------------------------------------
 * These are the exact line icons used by the prototype (24x24 grid,
 * drawn with a stroke, no fill). Each value is the inside of an <svg>.
 *
 * To ADD an icon: add a new line here, then use <Icon name="yourName" />.
 * The strings are written by us (never user input), so rendering them
 * with dangerouslySetInnerHTML in Icon.tsx is safe.
 */
export const ICON_PATHS = {
  search: "<circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m20 20-3.5-3.5\"/>",
  bell: "<path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8\"/><path d=\"M10 20a2 2 0 0 0 4 0\"/>",
  heart: "<path d=\"M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z\"/>",
  home: "<path d=\"m3 11 9-8 9 8\"/><path d=\"M5 10v10h14V10\"/>",
  grid: "<rect x=\"3\" y=\"3\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\" rx=\"1.5\"/>",
  bag: "<path d=\"M5 8h14l-1 12H6z\"/><path d=\"M9 8V6a3 3 0 0 1 6 0v2\"/>",
  tag: "<path d=\"M3 12V4h8l10 10-8 8z\"/><circle cx=\"7.5\" cy=\"8.5\" r=\"1.2\"/>",
  mega: "<path d=\"M3 11v3l12 5V6z\"/><path d=\"M15 9a4 4 0 0 1 0 6\"/><path d=\"M6 14v5\"/>",
  user: "<circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21a8 8 0 0 1 16 0\"/>",
  shield: "<path d=\"M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z\"/><path d=\"m9 12 2 2 4-4\"/>",
  cart: "<circle cx=\"9\" cy=\"20\" r=\"1.4\"/><circle cx=\"18\" cy=\"20\" r=\"1.4\"/><path d=\"M2 3h3l2.4 12h11L21 7H6\"/>",
  check: "<path d=\"m5 12 5 5 9-10\"/>",
  menu: "<path d=\"M4 6h16M4 12h16M4 18h16\"/>",
  x: "<path d=\"m6 6 12 12M18 6 6 18\"/>",
  plus: "<path d=\"M12 5v14M5 12h14\"/>",
  send: "<path d=\"m22 2-11 11\"/><path d=\"m22 2-7 20-4-9-9-4z\"/>",
  pin: "<path d=\"M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12z\"/><circle cx=\"12\" cy=\"9\" r=\"2.5\"/>",
  clock: "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/>",
  star: "<path d=\"m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z\"/>",
  store: "<path d=\"M4 9 5.5 4h13L20 9\"/><path d=\"M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9\"/><path d=\"M5 12v8h14v-8\"/>",
  book: "<path d=\"M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z\"/><path d=\"M20 4h-4a2 2 0 0 0-2 2\"/><path d=\"M20 4v14h-6\"/>",
  arrow: "<path d=\"M5 12h14M13 6l6 6-6 6\"/>",
  back: "<path d=\"M19 12H5M11 6l-6 6 6 6\"/>",
  upload: "<path d=\"M12 16V4M7 9l5-5 5 5\"/><path d=\"M4 20h16\"/>",
  lock: "<rect x=\"5\" y=\"11\" width=\"14\" height=\"10\" rx=\"2\"/><path d=\"M8 11V8a4 4 0 0 1 8 0v3\"/>",
  chev: "<path d=\"m6 9 6 6 6-6\"/>",
  msg: "<path d=\"M4 5h16v11H9l-5 4z\"/>",
  eye: "<path d=\"M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
  moon: "<path d=\"M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z\"/>",
  flag: "<path d=\"M5 21V4h11l-1.5 4L16 12H5\"/>",
  bowl: "<path d=\"M3 11h18a9 9 0 0 1-18 0z\"/><path d=\"M8 7c0-2 2-2 2-4M13 7c0-2 2-2 2-4\"/>",
  note: "<rect x=\"5\" y=\"3\" width=\"14\" height=\"18\" rx=\"2\"/><path d=\"M9 8h6M9 12h6M9 16h3\"/>",
  key: "<circle cx=\"8\" cy=\"15\" r=\"4\"/><path d=\"m11 12 8-8M16 7l3 3\"/>",
  calc: "<rect x=\"5\" y=\"3\" width=\"14\" height=\"18\" rx=\"2\"/><path d=\"M8 7h8M8 12h2M12 12h2M16 12h0M8 16h2M12 16h2\"/>",
  cup: "<path d=\"M5 6h12v6a6 6 0 0 1-12 0z\"/><path d=\"M17 8h2a2 2 0 0 1 0 4h-2\"/>",
  print: "<path d=\"M7 9V3h10v6\"/><rect x=\"4\" y=\"9\" width=\"16\" height=\"8\" rx=\"2\"/><path d=\"M7 14h10v7H7z\"/>",
  shirt: "<path d=\"m8 3-5 4 3 3 2-1v12h8V9l2 1 3-3-5-4a4 4 0 0 1-8 0z\"/>",
  info: "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 11v5M12 8h0\"/>",
  trash: "<path d=\"M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13\"/>",
  edit: "<path d=\"M4 20h4L19 9l-4-4L4 16z\"/>",
  logout: "<path d=\"M9 4H5v16h4\"/><path d=\"M16 8l4 4-4 4M20 12H9\"/>",
  dots: "<circle cx=\"5\" cy=\"12\" r=\"1.7\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"12\" cy=\"12\" r=\"1.7\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"19\" cy=\"12\" r=\"1.7\" fill=\"currentColor\" stroke=\"none\"/>",
} as const

export type IconName = keyof typeof ICON_PATHS
