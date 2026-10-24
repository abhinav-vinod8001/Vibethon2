import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LanguageProvider } from "@/features/language/LanguageProvider";
import { isLocale, LANGUAGE_COOKIE, resolveLocale } from "@/i18n/languages";
import { translate } from "@/i18n/translate";
import "./globals.css";
import "@/features/language/entry.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveLocale((await cookies()).get(LANGUAGE_COOKIE)?.value);
  return {
    title: `JobSathi — ${translate("Find work. Share your experience.", locale)}`,
    description: translate(
      "Sign in to save your resume, apply for jobs, or hire people.",
      locale,
    ),
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const preference = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  const locale = isLocale(preference) ? preference : null;
  return (
    <html lang={locale || "en"}>
      <body className="antialiased">
        <LanguageProvider initialLocale={locale}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
