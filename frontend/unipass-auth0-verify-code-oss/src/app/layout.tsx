import "../design/tokens.css";
import "./globals.css";

export const metadata = {
  title: "UniPass · Verify",
  description: "Enter the one-time code we emailed to you.",
  // Sensitive flow — don't let crawlers index this page.
  robots: "noindex, nofollow",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
