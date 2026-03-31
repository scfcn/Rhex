import { redirect } from "next/navigation"
import { readSearchParam } from "@/lib/search-params"

export default async function PointsPage(props: PageProps<"/points">) {
  const searchParams = await props.searchParams;
  const page = Math.max(1, Number(readSearchParam(searchParams?.page) ?? "1") || 1)
  redirect(`/settings?tab=points&page=${page}`)
}
