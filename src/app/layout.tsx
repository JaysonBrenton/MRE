/**
 * @fileoverview Root layout component
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Root layout wrapper for all pages
 * 
 * @purpose Provides the root HTML structure and layout for all pages in the application.
 *          Includes font configuration, global CSS, theme initialization script, and
 *          the Providers wrapper for NextAuth session management.
 * 
 * @relatedFiles
 * - app/globals.css (global styles and theme tokens)
 * - components/Providers.tsx (NextAuth provider)
 */

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "My Race Engineer (MRE)",
  description: "A telemetry and race analysis platform for RC racing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('mre-theme');
                  if (theme === 'light') {
                    document.documentElement.classList.add('light');
                  }
                } catch (e) {
                  // localStorage not available, use default dark theme
                }
              })();
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Suppress Next.js performance measurement errors
                // These occur when components redirect immediately, causing invalid timing
                function isPerformanceMeasurementError(message) {
                  return (
                    typeof message === 'string' &&
                    (message.includes('cannot have a negative time stamp') ||
                     message.includes("Failed to execute 'measure' on 'Performance'") ||
                     message.includes('negative time stamp'))
                  );
                }
                
                // Override console.error early to catch errors before Next.js error overlay
                const originalConsoleError = console.error;
                console.error = function() {
                  const message = Array.from(arguments)
                    .map(function(arg) {
                      return typeof arg === 'string' ? arg : String(arg);
                    })
                    .join(' ');
                  
                  if (isPerformanceMeasurementError(message)) {
                    return; // Silently ignore
                  }
                  
                  return originalConsoleError.apply(console, arguments);
                };
                
                // Override window.onerror to catch errors before Next.js intercepts them
                const originalOnError = window.onerror;
                window.onerror = function(message, source, lineno, colno, error) {
                  if (isPerformanceMeasurementError(message)) {
                    return true; // Suppress the error
                  }
                  
                  if (originalOnError) {
                    return originalOnError.call(this, message, source, lineno, colno, error);
                  }
                  
                  return false;
                };
                
                // Patch Performance.measure to catch and suppress the specific error
                if (typeof Performance !== 'undefined' && Performance.prototype.measure) {
                  const originalMeasure = Performance.prototype.measure;
                  Performance.prototype.measure = function(name, startMark, endMark) {
                    try {
                      return originalMeasure.call(this, name, startMark, endMark);
                    } catch (e) {
                      if (isPerformanceMeasurementError(e.message)) {
                        return; // Silently ignore
                      }
                      throw e; // Re-throw other errors
                    }
                  };
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--token-accent)] focus:text-[var(--token-text-primary)] focus:rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
        >
          Skip to main content
        </a>
        <ErrorBoundary>
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
