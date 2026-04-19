import { useMemo } from "react";

import { PaymentPanel } from "./components/PaymentPanel";
import { parsePayment } from "./lib/payment";

/**
 * Top-level page: reads the `?pay=` query param, parses it once, and
 * hands a typed `PaymentRequest` (or an error) down to the panel.
 *
 * All wallet interaction happens inside `<PaymentPanel>`, which takes
 * an injected `Wallet` adapter so tests can run without a real chain.
 */
export function App() {
  const parsed = useMemo(() => {
    const raw = new URLSearchParams(location.search).get("pay") ?? "";
    return parsePayment(raw);
  }, []);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem" }}>
      {parsed.ok ? (
        <PaymentPanel request={parsed.value} />
      ) : (
        <article style={{ maxWidth: "28rem", padding: "2rem", border: "1px solid #e5e7eb", borderRadius: "1rem" }}>
          <h1 style={{ margin: 0 }}>Invalid payment link</h1>
          <p style={{ color: "#6b7280" }}>Error: <code>{parsed.error}</code></p>
        </article>
      )}
    </main>
  );
}
