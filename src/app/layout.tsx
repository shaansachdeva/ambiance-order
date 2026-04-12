import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import SessionProvider from "@/components/SessionProvider";
import { LanguageProvider } from "@/contexts/LanguageContext";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Ambiance - Order Management",
  description: "Order & Production Tracking System",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Pre-fetch session server-side so the client never starts from null.
  // This eliminates the "loading flash" where role defaults to SALES for a split second.
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        {/* refetchOnWindowFocus ensures permissions saved by admin take effect
            the next time the affected user brings the tab into focus */}
        <SessionProvider session={session} refetchOnWindowFocus refetchInterval={300}>
          <LanguageProvider>{children}</LanguageProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
