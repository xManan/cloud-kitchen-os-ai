/**
 * Optional URL prefix, e.g. "/cloud-kitchen-os", set with NEXT_PUBLIC_BASE_PATH at build time.
 * Next.js prefixes links, router pushes and assets itself; raw fetch calls go through `withBase`.
 */
export function normaliseBasePath(raw: string | undefined) {
  const trimmed = (raw ?? "").trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}` : "";
}

export const BASE_PATH = normaliseBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

export const withBase = (path: string) => `${BASE_PATH}${path}`;
