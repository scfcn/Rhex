/**
 * @file build-api-factory.ts
 * @responsibility createAddonBuildApi 工厂 —— register(Slot|Surface|Page|Api|Hook|Provider|...) 家族
 * @scope Phase B.10 抽出自 runtime/loader.ts (原 lines 228-472)
 * @depends-on
 *   - @/addons-host/runtime/fs (normalizeMountedAddonPath)
 *   - @/addons-host/runtime/permissions (assertAddonPermission, resolveAddonSensitivePermissionForSlot, resolveAddonSensitivePermissionForProviderKind)
 *   - @/addons-host/hook-catalog (isKnownAddonActionHookName / isKnownAddonWaterfallHookName / isKnownAddonAsyncWaterfallHookName)
 *   - @/addons-host/surface-modes (getAddonSurfaceExecutionMode)
 *   - @/addons-host/types (Addon*Registration / AddonBuildApi / AddonManifest / AddonSlotProps)
 *   - 禁止 import ../loader (反向依赖)
 * @exports createAddonBuildApi
 */

import { normalizeMountedAddonPath } from "@/addons-host/runtime/fs"
import {
  assertAddonPermission,
  resolveAddonSensitivePermissionForProviderKind,
  resolveAddonSensitivePermissionForSlot,
} from "@/addons-host/runtime/permissions"
import {
  isKnownAddonActionHookName,
  isKnownAddonAsyncWaterfallHookName,
  isKnownAddonWaterfallHookName,
} from "@/addons-host/hook-catalog"
import { getAddonSurfaceExecutionMode } from "@/addons-host/surface-modes"
import type {
  AddonActionHookRegistration,
  AddonApiRegistration,
  AddonAsyncWaterfallHookRegistration,
  AddonBackgroundJobRegistration,
  AddonBuildApi,
  AddonDataMigrationRegistration,
  AddonManifest,
  AddonPageRegistration,
  AddonProviderRegistration,
  AddonSlotProps,
  AddonSlotRegistration,
  AddonSurfaceRegistration,
  AddonWaterfallHookRegistration,
} from "@/addons-host/types"

export function createAddonBuildApi(manifest: AddonManifest, warnings: string[]) {
  const slots: AddonSlotRegistration[] = []
  const surfaces: AddonSurfaceRegistration[] = []
  const publicPages: AddonPageRegistration[] = []
  const adminPages: AddonPageRegistration[] = []
  const publicApis: AddonApiRegistration[] = []
  const adminApis: AddonApiRegistration[] = []
  const backgroundJobs: AddonBackgroundJobRegistration[] = []
  const providers: AddonProviderRegistration[] = []
  const actionHooks: AddonActionHookRegistration[] = []
  const waterfallHooks: AddonWaterfallHookRegistration[] = []
  const asyncWaterfallHooks: AddonAsyncWaterfallHookRegistration[] = []
  const dataMigrations: AddonDataMigrationRegistration[] = []

  const api: AddonBuildApi = {
    registerSlot<TProps extends AddonSlotProps = AddonSlotProps>(
      registration: AddonSlotRegistration<TProps>,
    ) {
      assertAddonPermission(
        manifest,
        "slot:register",
        `addon "${manifest.id}" is not allowed to register slots`,
      )
      const sensitivePermission = resolveAddonSensitivePermissionForSlot(
        registration.slot,
      )
      if (sensitivePermission) {
        assertAddonPermission(
          manifest,
          sensitivePermission,
          `addon "${manifest.id}" is not allowed to attach to slot "${registration.slot}"`,
        )
      }

      slots.push({
        ...registration,
        key: registration.key.trim(),
        order: registration.order ?? 0,
      } as AddonSlotRegistration)
    },
    registerSurface(registration) {
      assertAddonPermission(
        manifest,
        "surface:register",
        `addon "${manifest.id}" is not allowed to register surfaces`,
      )
      const normalizedSurface = registration.surface.trim()
      const normalizedClientModule = typeof registration.clientModule === "string"
        ? registration.clientModule.trim()
        : ""
      const hasRender = typeof registration.render === "function"
      const surfaceMode = getAddonSurfaceExecutionMode(normalizedSurface)

      if (surfaceMode === "client" && hasRender && !normalizedClientModule) {
        throw new Error(
          `addon "${manifest.id}" surface "${normalizedSurface}" is client-only and requires clientModule`,
        )
      }

      if (!hasRender && !normalizedClientModule) {
        throw new Error(`addon "${manifest.id}" surface "${normalizedSurface}" requires render() or clientModule`)
      }

      if (surfaceMode === "client" && hasRender && normalizedClientModule) {
        warnings.push(
          `surface "${normalizedSurface}" is client-only; addon "${manifest.id}" render() will be ignored and clientModule will be used instead`,
        )
      }

      surfaces.push({
        ...registration,
        key: registration.key.trim(),
        surface: normalizedSurface,
        render: surfaceMode === "client" ? undefined : registration.render,
        clientModule: normalizedClientModule || undefined,
        priority: registration.priority ?? 0,
      } as AddonSurfaceRegistration)
    },
    registerPublicPage(registration) {
      assertAddonPermission(
        manifest,
        "page:public",
        `addon "${manifest.id}" is not allowed to register public pages`,
      )
      publicPages.push({
        ...registration,
        key: registration.key.trim(),
        path: normalizeMountedAddonPath(registration.path),
      })
    },
    registerAdminPage(registration) {
      assertAddonPermission(
        manifest,
        "page:admin",
        `addon "${manifest.id}" is not allowed to register admin pages`,
      )
      adminPages.push({
        ...registration,
        key: registration.key.trim(),
        path: normalizeMountedAddonPath(registration.path),
      })
    },
    registerPublicApi(registration) {
      assertAddonPermission(
        manifest,
        "api:public",
        `addon "${manifest.id}" is not allowed to register public APIs`,
      )
      publicApis.push({
        ...registration,
        key: registration.key.trim(),
        path: normalizeMountedAddonPath(registration.path),
        methods: (registration.methods ?? ["GET"]).map((item) => item.toUpperCase() as typeof item),
      })
    },
    registerAdminApi(registration) {
      assertAddonPermission(
        manifest,
        "api:admin",
        `addon "${manifest.id}" is not allowed to register admin APIs`,
      )
      adminApis.push({
        ...registration,
        key: registration.key.trim(),
        path: normalizeMountedAddonPath(registration.path),
        methods: (registration.methods ?? ["GET"]).map((item) => item.toUpperCase() as typeof item),
      })
    },
    registerBackgroundJob(registration) {
      assertAddonPermission(
        manifest,
        "background-job:register",
        `addon "${manifest.id}" is not allowed to register background jobs`,
      )

      backgroundJobs.push({
        ...registration,
        key: registration.key.trim(),
      } as AddonBackgroundJobRegistration)
    },
    registerProvider(registration) {
      assertAddonPermission(
        manifest,
        "provider:register",
        `addon "${manifest.id}" is not allowed to register providers`,
      )
      const sensitivePermission = resolveAddonSensitivePermissionForProviderKind(
        registration.kind,
      )
      if (sensitivePermission) {
        assertAddonPermission(
          manifest,
          sensitivePermission,
          `addon "${manifest.id}" is not allowed to register provider kind "${registration.kind}"`,
        )
      }

      providers.push({
        ...registration,
        kind: registration.kind.trim(),
        code: registration.code.trim(),
        label: registration.label.trim(),
        order: registration.order ?? 0,
      })
    },
    registerActionHook(registration) {
      assertAddonPermission(
        manifest,
        "hook:register",
        `addon "${manifest.id}" is not allowed to register action hooks`,
      )
      if (!isKnownAddonActionHookName(registration.hook)) {
        throw new Error(`unknown addon action hook "${registration.hook}"`)
      }

      actionHooks.push({
        ...registration,
        key: registration.key.trim(),
        order: registration.order ?? 0,
      })
    },
    registerWaterfallHook(registration) {
      assertAddonPermission(
        manifest,
        "hook:register",
        `addon "${manifest.id}" is not allowed to register waterfall hooks`,
      )
      if (!isKnownAddonWaterfallHookName(registration.hook)) {
        throw new Error(`unknown addon waterfall hook "${registration.hook}"`)
      }

      waterfallHooks.push({
        ...registration,
        key: registration.key.trim(),
        order: registration.order ?? 0,
      })
    },
    registerAsyncWaterfallHook(registration) {
      assertAddonPermission(
        manifest,
        "hook:register",
        `addon "${manifest.id}" is not allowed to register async waterfall hooks`,
      )
      if (!isKnownAddonAsyncWaterfallHookName(registration.hook)) {
        throw new Error(`unknown addon async waterfall hook "${registration.hook}"`)
      }

      asyncWaterfallHooks.push({
        ...registration,
        key: registration.key.trim(),
        order: registration.order ?? 0,
      })
    },
    registerDataMigration(registration) {
      assertAddonPermission(
        manifest,
        "data:migrate",
        `addon "${manifest.id}" is not allowed to register data migrations`,
      )

      dataMigrations.push({
        ...registration,
        version: Math.max(1, Math.floor(registration.version)),
      })
    },
  }

  return {
    api,
    snapshot: {
      slots,
      surfaces,
      publicPages,
      adminPages,
      publicApis,
      adminApis,
      backgroundJobs,
      providers,
      actionHooks,
      waterfallHooks,
      asyncWaterfallHooks,
      dataMigrations,
    },
  }
}