import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MQS Lead Verifier",
  description: "myQuest Skills SDR lead classification",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <nav className="bg-gray-900 border-b border-gray-700 px-6 py-2 flex gap-6 text-sm">
          <a href="/" className="text-gray-400 hover:text-white transition-colors">Upload</a>
          <a href="/results" className="text-gray-400 hover:text-white transition-colors">Results</a>
          <a href="/check" className="text-gray-400 hover:text-white transition-colors">Check Lead</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
