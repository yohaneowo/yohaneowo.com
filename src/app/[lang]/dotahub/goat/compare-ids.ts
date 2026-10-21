// Shared by the server pages and the compare tray (a client module's exports are only references on
// the server, so the plain values live here).
export const MAX_COMPARE = 4;

export const compareHref = (ids: number[]) => `/dotahub/goat/compare?ids=${ids.join(",")}`;
