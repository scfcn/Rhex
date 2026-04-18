/**
 * @file manifest-loader.ts
 * @responsibility addon server entry 动态 import / manifest 归一化为 runtime descriptor
 * @scope Phase B.6 抽自 runtime/loader.ts: importAddonDefinition / resolveAddonServerEntryPath / buildAddonRuntimeDescriptor
 * @depends-on node:fs, node:path, node:url, ../constants, ../fs, @/addons-host/types
 * @exports DEFAULT_SERVER_ENTRY_RELATIVE_PATH, importAddonDefinition, resolveAddonServerEntryPath, buildAddonRuntimeDescriptor
 */

import { promises as fs } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import {
  ADDON_ADMIN_API_PREFIX,
  ADDON_ADMIN_PAGE_PREFIX,
  ADDON_ASSET_PUBLIC_PREFIX,
  ADDON_PUBLIC_API_PREFIX,
  ADDON_PUBLIC_PAGE_PREFIX,
} from "@/addons-host/runtime/constants"
import { fileExists, resolveSafeAddonChildPath } from "@/addons-host/runtime/fs"
import type {
  AddonDefinition,
  AddonManifest,
  AddonStateRecord,
} from "@/addons-host/types"

export const DEFAULT_SERVER_ENTRY_RELATIVE_PATH = "dist/server.mjs"

export async function importAddonDefinition(entryServerPath: string): Promise<AddonDefinition> {
  const entryStat = await fs.stat(entryServerPath)
  const entryUrl = `${pathToFileURL(entryServerPath).href}?v=${entryStat.mtimeMs}`
  const moduleExports = await import(/* webpackIgnore: true */ entryUrl)
  const candidate = (moduleExports.default ?? moduleExports) as Partial<AddonDefinition> | undefined

  if (!candidate || typeof candidate.setup !== "function") {
    throw new Error("addon server entry must export an object with setup(api)")
  }

  return candidate as AddonDefinition
}

export async function resolveAddonServerEntryPath(rootDir: string, manifest: AddonManifest) {
  const requestedEntry = manifest.entry?.server?.trim() || DEFAULT_SERVER_ENTRY_RELATIVE_PATH
  const resolvedEntry = await resolveSafeAddonChildPath(rootDir, requestedEntry)

  return (await fileExists(resolvedEntry)) ? resolvedEntry : null
}

export function buildAddonRuntimeDescriptor(manifest: AddonManifest, rootDir: string, state: AddonStateRecord) {
  const enabled = !state.uninstalledAt && (state.enabled ?? manifest.enabled ?? true)

  return {
    manifest,
    state,
    enabled,
    rootDir,
    assetRootDir: path.join(rootDir, "assets"),
    assetBaseUrl: `${ADDON_ASSET_PUBLIC_PREFIX}/${manifest.id}`,
    publicBaseUrl: `${ADDON_PUBLIC_PAGE_PREFIX}/${manifest.id}`,
    adminBaseUrl: `${ADDON_ADMIN_PAGE_PREFIX}/${manifest.id}`,
    publicApiBaseUrl: `${ADDON_PUBLIC_API_PREFIX}/${manifest.id}`,
    adminApiBaseUrl: `${ADDON_ADMIN_API_PREFIX}/${manifest.id}`,
  }
}
