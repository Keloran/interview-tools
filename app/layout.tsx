import type {Metadata} from "next";
import {Geist, Geist_Mono} from "next/font/google";
import "./globals.css";
import {ClerkProvider} from "@clerk/nextjs";
import {ReactNode} from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import ClientProviders from "@/components/ClientProviders";
import GuestBanner from "@/components/GuestBanner";
import ErrorReporter from "@/components/ErrorReporter";
import SiteFooter from "@/components/SiteFooter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Interview Planner",
  description: "interviews.tools",
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
                                     children,
                                   }: Readonly<{
  children: ReactNode;
}>) {
  return (
    <ClerkProvider>
      <ClientProviders>
        <html lang="en" className="dark">
          <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
            <ErrorReporter />
            <main className="min-h-dvh bg-background p-4 pb-24 md:p-8 md:pb-24">
              <div className="mx-auto max-w-6xl">
                <div className="mb-6 md:mb-8 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-balance">
                      <Link href="/" className="transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        Interview Planner
                      </Link>
                    </h1>
                    <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">Manage your interview schedule, and see what companies you have applied with in the past</p>
                  </div>
                  <Navbar />
                </div>
                <GuestBanner />
                {children}
                <SiteFooter />
              </div>
            </main>
          </body>
        </html>
      </ClientProviders>
    </ClerkProvider>
  );
}
