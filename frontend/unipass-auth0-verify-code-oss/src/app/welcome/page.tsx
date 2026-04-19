/**
 * Placeholder landing page post-verify. Real deployments will redirect
 * into the main wallet/dashboard shell; this is just a terminal node
 * for the scaffold so the redirect target exists during smoke tests.
 */
export default function WelcomePage() {
  return (
    <main style={{ padding: "3rem", textAlign: "center" }}>
      <h1>Welcome</h1>
      <p>Your session is active.</p>
    </main>
  );
}
