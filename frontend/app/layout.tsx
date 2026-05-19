import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "./components/ThemeProvider";
import { OddsFormatProvider } from "./components/OddsFormatProvider";

export const metadata: Metadata = {
  title: "Odds Tracker",
  description: "Real-time sports betting odds tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="bg-slate-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100 min-h-screen">
        <ThemeProvider>
          <OddsFormatProvider>{children}</OddsFormatProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
