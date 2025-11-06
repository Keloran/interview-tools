import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import {
  ClerkProvider,
  UserButton,
  SignInButton,
  SignedOut,
  SignedIn,
} from "@clerk/nextjs";
import {ReactNode} from "react";
import {Button} from "@/components/ui/button";

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
};

export default function RootLayout({
                                     children,
                                   }: Readonly<{
  children: ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          <main className="min-h-screen bg-background p-4 md:p-8">
            <div className="mx-auto max-w-6xl">
              <div className="mb-8 flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-balance">Calendar</h1>
                  <p className="text-muted-foreground mt-2">Manage your schedule and events</p>
                </div>
                <Navbar />
              </div>
              {children}
            </div>
          </main>
        </body>
      </html>
    </ClerkProvider>
  );
}

const Navbar = () => {
  return (
    <>
        <SignedOut>
          <SignInButton>
            <Button className={"cursor-pointer"}>
              Sign In
            </Button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
    </>
  );
};