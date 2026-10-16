import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { LOCALES, hasLocale } from "@/i18n/config";
import { LocaleProvider } from "@/i18n/locale-provider";
import { getDictionary } from "@/i18n/server";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return {
    title: {
      default: "yohaneowo",
      template: "%s · yohaneowo",
    },
    description: t.site.description,
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <html
      lang={lang === "zh" ? "zh-Hans" : "en"}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <LocaleProvider lang={lang}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <SiteHeader />
            {/* Full-bleed pages (CoinHub) mark their root with data-fullbleed to drop the width and padding. */}
            <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8 has-[[data-fullbleed]]:max-w-none has-[[data-fullbleed]]:p-0">
              {children}
            </main>
          </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
