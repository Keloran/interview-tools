import type {Metadata} from "next";
import {Geist, Geist_Mono} from "next/font/google";
import "./globals.css";
import {ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton,} from "@clerk/nextjs";
import {ReactNode} from "react";
import {Button} from "@/components/ui/button";
import {Companies} from "@/components/Company";
import ClientProviders from "@/components/ClientProviders";

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
            <main className="min-h-screen bg-background p-4 md:p-8">
              <div className="mx-auto max-w-6xl">
                <div className="mb-8 flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight text-balance">Interview Planner</h1>
                    <p className="text-muted-foreground mt-2">Manage your interview schedule, and see what companies you have applied with in the past</p>
                  </div>
                  <Navbar />
                </div>
                <SignedOut>
                  <div className="mb-4 rounded-md border border-dashed p-3 text-sm text-muted-foreground bg-muted/30">
                    You are using Guest Mode. Your interviews are saved to this browser only and will sync to your account after you sign in.
                  </div>
                </SignedOut>
                {children}
              </div>
            </main>
          </body>
        </html>
      </ClientProviders>
    </ClerkProvider>
  );
}

const Navbar = () => {
  return (
    <>
      <Companies />
      <SignedOut>
        <SignInButton>
          <Button className={"cursor-pointer"}>Sign In</Button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton />
      </SignedIn>
    </>
  );
};