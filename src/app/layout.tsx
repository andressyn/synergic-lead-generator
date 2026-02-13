import type { Metadata } from "next";
import { Inter } from "next/font/google";
import SessionProvider from "@/components/session-provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Synergic Lead Generator",
  description: "Find fleet management leads using Google Places",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
