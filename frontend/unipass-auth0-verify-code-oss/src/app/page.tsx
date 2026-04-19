import { Suspense } from "react";

import { VerifyPanel } from "@/components/VerifyPanel";

/**
 * Next.js App Router server component. Reads the destination email from
 * `?to=<encoded>` search param on the server to avoid a client-only
 * flash. Renders the verify UI inside a `<Suspense>` so
 * `useSearchParams()` inside the client child doesn't break static
 * prerendering (Next 14 requirement).
 */
export default function VerifyPage({
  searchParams,
}: {
  searchParams: { to?: string };
}) {
  const to = typeof searchParams.to === "string" ? searchParams.to : undefined;
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
      }}
    >
      <Suspense fallback={null}>
        <VerifyPanel to={to} />
      </Suspense>
    </main>
  );
}
