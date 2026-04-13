import type { Metadata } from "next"
import Script from "next/script"
import { Suspense, type CSSProperties } from "react"

import { BackToTopButton } from "@/components/back-to-top-button"
import { ConditionalSiteFooter } from "@/components/conditional-site-footer"
import { GlobalNavigationProgress } from "@/components/global-navigation-progress"
import { SiteFooter } from "@/components/site-footer"
import { SiteSettingsProvider } from "@/components/site-settings-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { ConfirmProvider } from "@/components/ui/alert-dialog"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"


import { getRssFeedUrl } from "@/lib/rss"

import { getReadingHistoryInitScript } from "@/lib/local-reading-history"
import { resolveSiteIconPath } from "@/lib/site-branding"
import { resolveSiteOrigin } from "@/lib/site-origin"
import { getSidebarNavigationDisplayModeAttribute, getSidebarNavigationInitScript } from "@/lib/sidebar-navigation-preference"
import { getSiteSettings } from "@/lib/site-settings"
import { getThemeInitScript } from "@/lib/theme"
import { buildVipNameColorStyleVariables } from "@/lib/vip-name-colors"





import "./globals.css"
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const sidebarNavigationInitScript = getSidebarNavigationInitScript()
const readingHistoryInitScript = getReadingHistoryInitScript()
const themeInitScript = getThemeInitScript()
const rootInitScript = `${themeInitScript}${sidebarNavigationInitScript}${readingHistoryInitScript}`

export async function generateMetadata(): Promise<Metadata> {
  const [settings, rssUrl, siteOrigin] = await Promise.all([getSiteSettings(), getRssFeedUrl(), resolveSiteOrigin()])
  const resolvedSiteIconPath = resolveSiteIconPath(settings.siteIconPath)
  const supportsAppleIcon = !/\.svg(?:$|[?#])/i.test(resolvedSiteIconPath)

  return {
    metadataBase: new URL(siteOrigin),
    title: `${settings.siteName} - ${settings.siteSlogan}`,
    description: settings.siteDescription,
    keywords: settings.siteSeoKeywords,
    icons: supportsAppleIcon
      ? {
          icon: resolvedSiteIconPath,
          shortcut: resolvedSiteIconPath,
          apple: resolvedSiteIconPath,
        }
      : {
          icon: resolvedSiteIconPath,
          shortcut: resolvedSiteIconPath,
        },
    alternates: {
      types: {
        "application/rss+xml": rssUrl,
      },
    },
  }
}



export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await getSiteSettings()
  const vipNameColorStyle = buildVipNameColorStyleVariables(settings.vipNameColors) as CSSProperties
  const sidebarDisplayMode = getSidebarNavigationDisplayModeAttribute(settings.leftSidebarDisplayMode)

  return (

    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={cn("font-sans", geist.variable)}
      data-sidebar-display-mode={sidebarDisplayMode}
    >
      <head>
        <Script id="site-root-init" strategy="beforeInteractive">
          {rootInitScript}
        </Script>

      </head>
      <body style={vipNameColorStyle}>
        <ThemeProvider>
          <SiteSettingsProvider
            markdownEmojiMap={settings.markdownEmojiMap}
            markdownImageUploadEnabled={settings.markdownImageUploadEnabled}
            leftSidebarDisplayMode={settings.leftSidebarDisplayMode}
            vipLevelIcons={settings.vipLevelIcons}
          >
            <TooltipProvider>
              <Suspense fallback={null}>
                <GlobalNavigationProgress />
              </Suspense>
              <ConfirmProvider>
                {children}
                <ConditionalSiteFooter>
                  <SiteFooter />
                </ConditionalSiteFooter>
                <BackToTopButton />
              </ConfirmProvider>
              <Toaster richColors position="top-right" />
            </TooltipProvider>
          </SiteSettingsProvider>
        </ThemeProvider>




      </body>

    </html>
  )
}

