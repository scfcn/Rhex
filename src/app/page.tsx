import type { Metadata } from "next"
import { redirect } from "next/navigation"

import {
  generateAddonHomeFeedMetadata,
  generateHomeFeedMetadata,
  HomeFeedPage,
} from "@/app/home-feed-page"
import { listAddonHomeFeedTabs } from "@/lib/addon-home-feed-providers"
import {
  buildAddonHomeFeedHref,
  buildHomeFeedHref,
  normalizeHomeFeedSort,
  parseHomeFeedPage,
} from "@/lib/home-feed-route"
import { resolveDefaultAddonHomeFeedTab } from "@/lib/home-feed-tabs"
import { readSearchParam } from "@/lib/search-params"

export async function generateMetadata(): Promise<Metadata> {
  const defaultAddonTab = resolveDefaultAddonHomeFeedTab(await listAddonHomeFeedTabs())
  if (defaultAddonTab) {
    return generateAddonHomeFeedMetadata(defaultAddonTab.slug, "/")
  }

  return generateHomeFeedMetadata("latest")
}

export default async function HomePage(props: PageProps<"/">) {
  const searchParams = await props.searchParams
  const rawSort = readSearchParam(searchParams?.sort)
  const rawPage = readSearchParam(searchParams?.page)
  const defaultAddonTab = resolveDefaultAddonHomeFeedTab(await listAddonHomeFeedTabs())

  if (rawSort !== undefined || rawPage !== undefined) {
    if (defaultAddonTab && rawSort === undefined) {
      redirect(
        buildAddonHomeFeedHref(
          defaultAddonTab.slug,
          parseHomeFeedPage(rawPage),
          true,
        ),
      )
    }

    redirect(buildHomeFeedHref(normalizeHomeFeedSort(rawSort), parseHomeFeedPage(rawPage)))
  }

  if (defaultAddonTab) {
    return <HomeFeedPage addonTabSlug={defaultAddonTab.slug} autoCheckInOnEnter />
  }

  return <HomeFeedPage sort="latest" autoCheckInOnEnter />
}



