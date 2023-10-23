import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import Logout from "./_components/Logout";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Supabase Auth + Next13 + Prisma",
  description: "An app that implements supabase auth with Next13 App directory and prisma for db interaction.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <nav>
          <ul className="flex gap-4 pb-10">
            <li>
              <Link href="/">Home</Link>
            </li>
            <li>
              <Link href="/admin">Admin</Link>
            </li>
            <li>
              <Link href="/login">Login</Link>
            </li>
            <li>
              <Logout />
            </li>
          </ul>
        </nav>
        {children}
      </body>
    </html>
  );
}
