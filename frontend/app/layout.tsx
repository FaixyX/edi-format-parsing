import type { Metadata } from "next";
import { ThemeProvider } from "@/components/common/theme-provider";
import { ClientWrapper } from "@/components/common/ClientWrapper";
// import { Toaster } from "@/components/ui/toaster";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import { CacheCleaner } from "@/components/common/CacheCleaner";

export const metadata: Metadata = {
    title: "billup - Healthcare Billing Control Panel",
    description:
        "billup is a comprehensive control panel application for managing healthcare agency billing, monitoring EDI file processing, and automating form submissions with Google Sheets integration.",
    icons: {
        icon: "/favicon.ico",
    },
    verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
        ? {
              google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
          }
        : undefined,
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className="antialiased">
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <ClientWrapper>
                        <CacheCleaner />
                        {children}
                    </ClientWrapper>
                    <Toaster
                        position="bottom-right"
                        richColors
                        closeButton
                        // pauseWhenPageIsHidden
                    />
                </ThemeProvider>
            </body>
        </html>
    );
}
