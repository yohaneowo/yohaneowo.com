// The economy and IMP pages put their filters in a panel left of the content (FilterBar). From
// 1568px the empty space beside DotaHub's 1280px content holds it; between 1520 and 1568px the
// content moves right (its width unchanged, into the empty space on its right) so the panel's
// 144px fit on the left. The shift is computed from 100vw, which counts the scrollbar too.
// A plain module (not "use client") so the server pages can use it.
export const SIDE_PANEL_PAGE =
  "flex flex-col gap-6 min-[1520px]:max-[1567px]:mr-[calc((100vw_-_1280px)/2_-_144px)] min-[1520px]:max-[1567px]:ml-[calc(144px_-_(100vw_-_1280px)/2)]";
