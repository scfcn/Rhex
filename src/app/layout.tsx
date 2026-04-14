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
const rootInitStyle = `
  html[data-root-init="pending"] {
    overflow: hidden;
  }

  html[data-root-init="pending"] body {
    visibility: hidden;
    overflow: hidden;
  }

  html[data-root-init="pending"]::before {
    content: '';
    position: fixed;
    inset: 0;
    z-index: 9998;
    background: #f8fafc;
  }

  html.dark[data-root-init="pending"]::before {
    background: #10131a;
  }

  html[data-root-init="pending"]::after {
    content: '';
    position: fixed;
    top: 50%;
    left: 50%;
    z-index: 9999;
    width: 2rem;
    height: 2rem;
    border-radius: 9999px;
    border: 2px solid rgba(148, 163, 184, 0.32);
    border-top-color: #3b82f6;
    transform: translate(-50%, -50%);
    animation: root-boot-spinner 0.72s linear infinite;
  }

  html.dark[data-root-init="pending"]::after {
    border-color: rgba(71, 85, 105, 0.42);
    border-top-color: #fb923c;
  }

  @keyframes root-boot-spinner {
    to {
      transform: translate(-50%, -50%) rotate(360deg);
    }
  }
`
const rootInitScript = `
  (function () {
    try {
      ${themeInitScript}
      ${sidebarNavigationInitScript}
      ${readingHistoryInitScript}
    } finally {
      try {
        document.documentElement.setAttribute("data-root-init", "ready");
      } catch (_error) {
        // Ignore root init cleanup failures.
      }
    }
  })();
`

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
      data-root-init="pending"
      data-sidebar-display-mode={sidebarDisplayMode}
    >
      <head>
        <style>{rootInitStyle}</style>
        <Script id="site-root-init" strategy="beforeInteractive">
          {rootInitScript}
        </Script>
        <noscript>
          <style>{`html[data-root-init="pending"] { background: inherit; } html[data-root-init="pending"] body { visibility: visible !important; overflow: visible !important; } html[data-root-init="pending"]::before, html[data-root-init="pending"]::after { display: none !important; }`}</style>
        </noscript>
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

