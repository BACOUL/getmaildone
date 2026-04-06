import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GetMailDone",
  description: "Stop writing emails. Just get them done.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
