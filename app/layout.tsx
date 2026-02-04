import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "sunsun",
  description: "Enterprise AI Chat Platform with Multi-Model Support",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
