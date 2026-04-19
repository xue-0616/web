import "../design/tokens.css";
import "../design/brand.css";
import "./globals.css";

export const metadata = { title: "Solana Blinks Demo" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
