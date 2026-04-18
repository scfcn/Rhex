// ============================================================================
// loader.ts — addons runtime 门面
//
// 本文件职责（薄壳）：
//   1. 协调 internal/* 子模块，提供 loadAddonsRuntimeFresh() 扫描落地流程。
//   2. 通过 React `cache` 暴露 loadAddonsRegistry() / loadAddonsRuntime() 等稳定入口。
//   3. 保留对外 API 门面（re-export），保障 execute.ts/hooks.ts/routes.ts 等消费者零改动。
//
// 历史重构（Phase A/B）后，大多数业务细节已下沉到 runtime/internal/*：
//   - manifest-loader / permission-guard / execution-context / data-migrations
//   - route-index / map-utils / board-select / build-api-factory / registry-aggregator
// ============================================================================
import "server-only"

import { promises as fs } from "node:fs"
import path from "node:path"
import { cache } from "react"

import {
  fileExists,
  getAddonsRootDirectory,
  isValidAddonId,
  readJsonFile,
} from "@/addons-host/runtime/fs"
import { runWithAddonExecutionScope } from "@/addons-host/runtime/execution-scope"
import { normalizeAddonManifest } from "@/addons-host/runtime/manifest"
import { readAddonStateMap } from "@/addons-host/runtime/state"
import { createAddonLifecycleLog } from "@/db/addon-registry-queries"
import type { AddonManifest, LoadedAddonRuntime } from "@/addons-host/types"

// ---- 门面 re-export：保持对外 API 稳定 ----------------------------------
export {
  buildLoadedAddonsRegistry,
} from "@/addons-host/runtime/internal/registry-aggregator"
export type {
  IndexedAddonSlotCandidate,
  IndexedAddonSurfaceCandidate,
  IndexedAddonProviderCandidate,
  IndexedAddonActionHookCandidate,
  IndexedAddonWaterfallHookCandidate,
  IndexedAddonAsyncWaterfallHookCandidate,
  LoadedAddonsRegistry,
} from "@/addons-host/runtime/internal/registry-aggregator"
export { createAddonBuildApi } from "@/addons-host/runtime/internal/build-api-factory"
export { buildAddonExecutionContext } from "@/addons-host/runtime/internal/execution-context"

// ---- 内部依赖（loader 主流程自身使用）-----------------------------------
import { buildLoadedAddonsRegistry } from "@/addons-host/runtime/internal/registry-aggregator"
import type { LoadedAddonsRegistry } from "@/addons-host/runtime/internal/registry-aggregator"
import { createAddonBuildApi } from "@/addons-host/runtime/internal/build-api-factory"
import {
  buildAddonRuntimeDescriptor,
  importAddonDefinition,
  resolveAddonServerEntryPath,
} from "@/addons-host/runtime/internal/manifest-loader"
import { buildAddonPermissionCache } from "@/addons-host/runtime/internal/permission-guard"
import { applyAddonDataMigrations } from "@/addons-host/runtime/internal/data-migrations"

export async function loadAddonsRuntimeFresh(): Promise<LoadedAddonRuntime[]> {
  const addonsRoot = getAddonsRootDirectory()
  if (!(await fileExists(addonsRoot))) {
    return []
  }

  const [entries, stateMap] = await Promise.all([
    fs.readdir(addonsRoot, { withFileTypes: true }),
    readAddonStateMap(),
  ])

  const runtimes: LoadedAddonRuntime[] = []

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "zh-CN"))) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) {
      continue
    }

    const rootDir = path.join(addonsRoot, entry.name)
    const manifestPath = path.join(rootDir, "addon.json")
    if (!(await fileExists(manifestPath))) {
      continue
    }

    let manifest: AddonManifest

    try {
      manifest = normalizeAddonManifest(await readJsonFile<unknown>(manifestPath))
    } catch (error) {
      const fallbackManifest: AddonManifest = {
        id: entry.name,
        name: entry.name,
        version: "0.0.0",
        description: "Invalid addon manifest",
      }
      const state = stateMap[entry.name] ?? {}
      const descriptor = buildAddonRuntimeDescriptor(fallbackManifest, rootDir, state)
      const permissionCache = buildAddonPermissionCache(fallbackManifest)
      runtimes.push({
        ...descriptor,
        permissionSet: permissionCache.permissionSet,
        resolvedPermissions: permissionCache.resolvedPermissions,
        entryServerPath: null,
        warnings: [],
        slots: [],
        surfaces: [],
        publicPages: [],
        adminPages: [],
        publicApis: [],
        adminApis: [],
        backgroundJobs: [],
        providers: [],
        actionHooks: [],
        waterfallHooks: [],
        asyncWaterfallHooks: [],
        dataMigrations: [],
        loadError: error instanceof Error ? error.message : "invalid addon manifest",
      })
      continue
    }

    const state = stateMap[manifest.id] ?? {}
    const warnings: string[] = []
    const permissionCache = buildAddonPermissionCache(manifest)
    if (!isValidAddonId(manifest.id)) {
      warnings.push(`addon id "${manifest.id}" is not a recommended identifier`)
    }
    if (manifest.id !== entry.name) {
      warnings.push(`addon folder "${entry.name}" does not match manifest id "${manifest.id}"`)
    }

    const descriptor = buildAddonRuntimeDescriptor(manifest, rootDir, state)
    const serverEntryPath = await resolveAddonServerEntryPath(rootDir, manifest)
    const runtime: LoadedAddonRuntime = {
      ...descriptor,
      permissionSet: permissionCache.permissionSet,
      resolvedPermissions: permissionCache.resolvedPermissions,
      entryServerPath: serverEntryPath,
      warnings,
      slots: [],
      surfaces: [],
      publicPages: [],
      adminPages: [],
      publicApis: [],
      adminApis: [],
      backgroundJobs: [],
      providers: [],
      actionHooks: [],
      waterfallHooks: [],
      asyncWaterfallHooks: [],
      dataMigrations: [],
      loadError: null,
    }

    if (!runtime.enabled) {
      runtimes.push(runtime)
      continue
    }

    if (!serverEntryPath) {
      runtime.loadError = "addon server entry not found"
      runtimes.push(runtime)
      continue
    }

    try {
      const { api, snapshot } = createAddonBuildApi(manifest, warnings)
      const definition = await importAddonDefinition(serverEntryPath)
      await runWithAddonExecutionScope(runtime, {
        action: "setup",
      }, async () => {
        await definition.setup(api)
      })
      runtime.slots = snapshot.slots
      runtime.surfaces = snapshot.surfaces
      runtime.publicPages = snapshot.publicPages
      runtime.adminPages = snapshot.adminPages
      runtime.publicApis = snapshot.publicApis
      runtime.adminApis = snapshot.adminApis
      runtime.backgroundJobs = snapshot.backgroundJobs
      runtime.providers = snapshot.providers
      runtime.actionHooks = snapshot.actionHooks
      runtime.waterfallHooks = snapshot.waterfallHooks
      runtime.asyncWaterfallHooks = snapshot.asyncWaterfallHooks
      runtime.dataMigrations = snapshot.dataMigrations
      await applyAddonDataMigrations(runtime)
    } catch (error) {
      runtime.loadError = error instanceof Error ? error.message : "failed to load addon server entry"
      runtime.state = {
        ...runtime.state,
        lastErrorAt: new Date().toISOString(),
        lastErrorMessage: runtime.loadError,
      }
      await createAddonLifecycleLog({
        addonId: runtime.manifest.id,
        action: "LOAD",
        status: "FAILED",
        message: runtime.loadError,
        metadataJson: {
          entryServerPath: runtime.entryServerPath,
        },
      })
    }

    runtimes.push(runtime)
  }

  return runtimes
}

let addonsRegistryCacheVersion = 0

const loadAddonsRegistryCached = cache(async (cacheVersion: number) => {
  void cacheVersion
  const addons = await loadAddonsRuntimeFresh()
  return buildLoadedAddonsRegistry(addons)
})

export async function loadAddonsRegistry(): Promise<LoadedAddonsRegistry> {
  return loadAddonsRegistryCached(addonsRegistryCacheVersion)
}

export function clearAddonsRuntimeCache() {
  addonsRegistryCacheVersion += 1
}

export async function loadAddonsRuntime(): Promise<LoadedAddonRuntime[]> {
  return (await loadAddonsRegistry()).addons
}

export async function findLoadedAddonById(addonId: string) {
  return (await loadAddonsRegistry()).addonsById.get(addonId) ?? null
}

export async function findLoadedAddonByIdFresh(addonId: string) {
  const addons = await loadAddonsRuntimeFresh()
  return addons.find((item) => item.manifest.id === addonId) ?? null
}
