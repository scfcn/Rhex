import type { Metadata } from "next"

import { BackToTopButton } from "@/components/back-to-top-button"
import { SiteFooter } from "@/components/site-footer"
import { SiteSettingsProvider } from "@/components/site-settings-provider"
import { ConfirmProvider } from "@/components/ui/confirm-dialog"
import { ToastProvider } from "@/components/ui/toast"


import { getRssFeedUrl } from "@/lib/rss"

import { resolveSiteOrigin } from "@/lib/site-origin"
import { getSidebarNavigationInitScript } from "@/lib/sidebar-navigation-preference"
import { getSiteSettings } from "@/lib/site-settings"
import { getThemeInitScript } from "@/lib/theme"





import "./globals.css"

const themeInitScript = getThemeInitScript()
const sidebarNavigationInitScript = getSidebarNavigationInitScript()

export async function generateMetadata(): Promise<Metadata> {
  const [settings, rssUrl, siteOrigin] = await Promise.all([getSiteSettings(), getRssFeedUrl(), resolveSiteOrigin()])

  return {
    metadataBase: new URL(siteOrigin),
    title: `${settings.siteName} - ${settings.siteSlogan}`,
    description: settings.siteDescription,
    keywords: settings.siteSeoKeywords,
    alternates: {
      types: {
        "application/rss+xml": rssUrl,
      },
    },
  }
}



export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await getSiteSettings()

  return (

    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: sidebarNavigationInitScript }} />
      </head>
      <body>
        <SiteSettingsProvider markdownEmojiMap={settings.markdownEmojiMap}>
          <ToastProvider>
            <ConfirmProvider>
              {children}
              <SiteFooter />
              <BackToTopButton />
            </ConfirmProvider>
          </ToastProvider>
        </SiteSettingsProvider>




      </body>

    </html>
  )
}
