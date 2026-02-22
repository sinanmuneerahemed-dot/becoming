import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { AuthProvider } from "@/providers/AuthProvider";

import NotificationManager from "@/components/NotificationManager";
import "./globals.css";

export const metadata: Metadata = {
  title: "BECOMING",
  description: "Reflect. Act. Review.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192x192.png" }],
  },
  appleWebApp: {
    capable: true,
    title: "BECOMING",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0F172A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="relative min-h-screen overflow-x-hidden">
        <AuthProvider>
          <NotificationManager />

          <main className="relative z-10">{children}</main>
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: "rgba(10, 10, 26, 0.9)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#fff",
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
