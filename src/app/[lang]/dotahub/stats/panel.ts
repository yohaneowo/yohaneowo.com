// The economy and IMP pages put their filters in a panel left of the content (FilterBar). From
// 1712px the empty space beside DotaHub's 1280px content holds it; between 1520 and 1712px the
// content moves right, giving up the space on its right, so the panel's 216px fit on the left.
// The shift is computed from 100vw, which counts the scrollbar too, so the right edge keeps 24px.
// A plain module (not "use client") so the server pages can use it.
export const SIDE_PANEL_PAGE =
  "flex flex-col gap-6 min-[1520px]:max-[1711px]:mr-[calc((1280px_-_100vw)/2_+_24px)] min-[1520px]:max-[1711px]:ml-[calc(216px_-_(100vw_-_1280px)/2)]";
