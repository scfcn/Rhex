"use client"

import Link from "next/link"
import { useRef, useState, useTransition } from "react"

import { AddonManagementActionButtons } from "@/components/admin/addon-management-action-buttons"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Modal } from "@/components/ui/modal"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import type {
  AddonAdminItem,
  AddonInstallPreviewData,
  AddonsAdminData,
} from "@/addons-host/admin-types"

interface AddonsHostAdminPageProps {
  initialData: AddonsAdminData
}

interface AdminApiPayload<TData> {
  code: number
  message?: string
  data?: TData
}

async function postAddonsHostAction(action: "sync" | "clear-cache") {
  const response = await fetch("/api/admin/addons", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action,
    }),
  })

  const result = await response.json() as AdminApiPayload<AddonsAdminData>
  if (!response.ok || result.code !== 0 || !result.data) {
    throw new Error(
      result.message
        ?? (action === "sync" ? "同步插件宿主失败" : "清除插件宿主缓存失败"),
    )
  }

  return result
}

function getStateBadgeVariant(stateLabel: "enabled" | "disabled") {
  switch (stateLabel) {
    case "enabled":
      return "default"
    case "disabled":
      return "secondary"
    default:
      return "secondary"
  }
}

function getStateLabel(stateLabel: "enabled" | "disabled") {
  switch (stateLabel) {
    case "enabled":
      return "已启用"
    case "disabled":
      return "已禁用"
    default:
      return "未知"
  }
}

function getAddonIssueText(addon: AddonAdminItem) {
  if (addon.loadError) {
    return addon.loadError
  }

  if (addon.lastErrorMessage) {
    return addon.lastErrorMessage
  }

  if (addon.warnings.length > 0) {
    return addon.warnings.join("；")
  }

  return "无"
}

function getPermissionDescription(permission: string) {
  const descriptions: Record<string, string> = {
    "config:read": "读取插件配置",
    "config:write": "修改插件配置",
    "secret:read": "读取插件敏感信息",
    "secret:write": "修改插件敏感信息",
    "database:sql": "执行数据库原生 SQL",
    "database:orm": "复用宿主 Prisma ORM 访问现有模型",
    "data:read": "读取插件数据仓库",
    "data:write": "写入插件数据仓库",
    "data:delete": "删除插件数据仓库内容",
    "data:migrate": "执行插件数据迁移",
    "background-job:register": "注册后台任务",
    "background-job:enqueue": "添加后台任务",
    "background-job:delete": "删除后台任务",
    "slot:register": "注册页面插槽扩展",
    "surface:register": "接管宿主 surface 渲染",
    "page:public": "注册前台页面",
    "page:admin": "注册后台页面",
    "api:public": "注册前台 API",
    "api:admin": "注册后台 API",
    "provider:register": "注册 provider 能力",
    "hook:register": "注册生命周期 hook",
    "post:create": "以指定账号创建帖子",
    "post:query": "读取宿主帖子数据",
    "post:like": "以指定账号确保帖子已点赞",
    "comment:create": "以指定账号创建评论",
    "comment:query": "读取宿主评论数据",
    "comment:like": "以指定账号确保评论已点赞",
    "message:send": "以指定账号发送站内私信",
    "notification:create": "创建系统通知",
    "follow:user": "以指定账号确保已关注用户",
    "points:adjust": "调整用户积分余额",
    "post:tip": "以指定账号执行帖子打赏",
    "network:external": "访问外部网络资源",
    "auth:integrate": "接入认证能力",
    "captcha:integrate": "接入验证码能力",
    "payment:integrate": "接入支付能力",
  }

  return descriptions[permission] ?? "插件声明的自定义或未归档权限"
}

function PreviewMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  )
}

export function AddonsHostAdminPage({ initialData }: AddonsHostAdminPageProps) {
  const [data, setData] = useState(initialData)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [enableAfterInstall, setEnableAfterInstall] = useState(true)
  const [installPreview, setInstallPreview] = useState<AddonInstallPreviewData | null>(null)
  const [installPreviewOpen, setInstallPreviewOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [pendingOverviewAction, setPendingOverviewAction] = useState<"sync" | "clear-cache" | null>(null)
  const [pendingInstallPhase, setPendingInstallPhase] = useState<"inspect" | "install" | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function runOverviewAction(action: "sync" | "clear-cache") {
    startTransition(() => {
      void (async () => {
        try {
          setPendingOverviewAction(action)
          const result = await postAddonsHostAction(action)
          setData(result.data!)
          toast.success(
            result.message
              ?? (action === "sync" ? "插件宿主已同步" : "插件宿主缓存已清除"),
            action === "sync" ? "同步成功" : "清除成功",
          )
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : (action === "sync" ? "同步插件宿主失败" : "清除插件宿主缓存失败"),
            action === "sync" ? "同步失败" : "清除失败",
          )
        } finally {
          setPendingOverviewAction(null)
        }
      })()
    })
  }

  function resetInstallSelection() {
    setSelectedFile(null)
    setReplaceExisting(false)
    setEnableAfterInstall(true)
    setInstallPreview(null)
    setInstallPreviewOpen(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  function inspectAddonBeforeInstall() {
    if (!selectedFile) {
      toast.warning("请先选择一个 zip 插件包", "缺少文件")
      return
    }

    startTransition(() => {
      void (async () => {
        try {
          const formData = new FormData()
          formData.set("file", selectedFile)
          formData.set("intent", "inspect")
          formData.set("replaceExisting", String(replaceExisting))
          formData.set("enableAfterInstall", String(enableAfterInstall))
          setPendingInstallPhase("inspect")

          const response = await fetch("/api/admin/addons/install", {
            method: "POST",
            body: formData,
          })

          const result = await response.json() as {
            code?: number
            message?: string
            data?: AddonInstallPreviewData
          }

          if (!response.ok || result.code !== 0 || !result.data) {
            throw new Error(result.message ?? "插件预检失败")
          }

          setInstallPreview(result.data)
          setInstallPreviewOpen(true)
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "插件预检失败", "预检失败")
        } finally {
          setPendingInstallPhase(null)
        }
      })()
    })
  }

  function installAddon() {
    if (!selectedFile) {
      toast.warning("请先选择一个 zip 插件包", "缺少文件")
      return
    }

    startTransition(() => {
      void (async () => {
        try {
          const formData = new FormData()
          formData.set("file", selectedFile)
          formData.set("replaceExisting", String(replaceExisting))
          formData.set("enableAfterInstall", String(enableAfterInstall))
          setPendingInstallPhase("install")

          const response = await fetch("/api/admin/addons/install", {
            method: "POST",
            body: formData,
          })

          const result = await response.json() as {
            code?: number
            message?: string
            data?: AddonsAdminData
          }

          if (!response.ok || result.code !== 0 || !result.data) {
            throw new Error(result.message ?? "插件安装失败")
          }

          setData(result.data)
          resetInstallSelection()
          const successTitle = result.message?.includes("升级") ? "升级成功" : "安装成功"
          toast.success(result.message ?? "插件已安装", successTitle)
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "插件安装失败", "安装失败")
        } finally {
          setPendingInstallPhase(null)
        }
      })()
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)] xl:items-start">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>安装插件</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 py-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)]">
              <div className="space-y-2">
                <p className="text-sm font-medium">插件 zip 包</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip,application/zip"
                  className="block w-full rounded-xl border border-border bg-background px-4 py-3 text-sm"
                  onChange={(event) => {
                    setSelectedFile(event.target.files?.[0] ?? null)
                    setInstallPreview(null)
                    setInstallPreviewOpen(false)
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  支持 zip 根目录直接包含 `addon.json`，也支持单层插件目录包裹。
                </p>
              </div>

              <div className="space-y-4 rounded-2xl border border-border bg-muted/30 p-4">
                <label className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">覆盖安装 / 升级</p>
                    <p className="text-xs text-muted-foreground">如果插件目录已存在，会先在 staging 校验并执行升级 hook，成功后再把旧目录移动到 `.trash`。</p>
                  </div>
                  <Switch checked={replaceExisting} onCheckedChange={setReplaceExisting} />
                </label>

                <label className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">安装后立即启用</p>
                    <p className="text-xs text-muted-foreground">关闭后仅完成安装，不加载插件页面、插槽和 API。</p>
                  </div>
                  <Switch checked={enableAfterInstall} onCheckedChange={setEnableAfterInstall} />
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={inspectAddonBeforeInstall} disabled={isPending || !selectedFile}>
                {pendingInstallPhase === "inspect" ? "检查中..." : "上传并安装"}
              </Button>
              {selectedFile ? (
                <span className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                  {selectedFile.name}
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>概览</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 py-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{data.storageMode === "database" ? "Prisma Registry" : "File Fallback"}</Badge>
              <Badge variant="outline">总数 {data.summary.total}</Badge>
              <Badge variant="default">启用 {data.summary.enabled}</Badge>
              <Badge variant="secondary">禁用 {data.summary.disabled}</Badge>
              <Badge variant="outline">异常 {data.summary.errored}</Badge>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => runOverviewAction("sync")} disabled={isPending}>
                {pendingOverviewAction === "sync" ? "同步中..." : "同步扫描"}
              </Button>
              <Button variant="outline" onClick={() => runOverviewAction("clear-cache")} disabled={isPending}>
                {pendingOverviewAction === "clear-cache" ? "清除中..." : "清除缓存"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              清除缓存会刷新插件宿主运行时缓存，并清掉已经恢复正常插件的残留“最近错误”状态。
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>插件列表</CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>插件</TableHead>
                <TableHead className="w-[140px]">作者</TableHead>
                <TableHead className="w-[100px]">版本</TableHead>
                <TableHead className="w-[180px]">状态</TableHead>
                <TableHead className="w-[320px]">最近错误 / 警告</TableHead>
                <TableHead className="w-[180px]">快捷入口</TableHead>
                <TableHead className="w-[240px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-sm text-muted-foreground">
                    当前还没有扫描到任何插件目录。
                  </TableCell>
                </TableRow>
              ) : null}

              {data.items.map((addon) => (
                <TableRow key={addon.id}>
                  <TableCell className="align-top">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{addon.name}</span>
                        <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{addon.id}</span>
                      </div>
                      <p className="max-w-xl text-sm leading-6 text-muted-foreground">{addon.description}</p>
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-sm text-muted-foreground">
                    {addon.author ?? "未填写"}
                  </TableCell>
                  <TableCell className="align-top text-sm text-muted-foreground">
                    {addon.version}
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={getStateBadgeVariant(addon.stateLabel)}>{getStateLabel(addon.stateLabel)}</Badge>
                      {addon.loadError ? <Badge variant="destructive">加载失败</Badge> : null}
                      {addon.warnings.length > 0 ? <Badge variant="outline">警告 {addon.warnings.length}</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <p className="text-sm leading-6 text-muted-foreground">{getAddonIssueText(addon)}</p>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-wrap gap-2 text-sm">
                      <Link href={`/admin/addons/${addon.id}`} className="inline-flex h-9 items-center justify-center rounded-full border border-border px-3 transition-colors hover:bg-accent hover:text-accent-foreground">
                        插件详情
                      </Link>
                      {addon.counts.publicPages > 0 ? (
                        <Link href={addon.paths.publicPage} className="inline-flex h-9 items-center justify-center rounded-full border border-border px-3 transition-colors hover:bg-accent hover:text-accent-foreground">
                          前台页
                        </Link>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex justify-end">
                      <AddonManagementActionButtons addon={addon} compact onUpdated={setData} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Modal
        open={installPreviewOpen}
        onClose={() => {
          setInstallPreviewOpen(false)
        }}
        closeDisabled={pendingInstallPhase === "install"}
        title="安装权限确认"
        description={installPreview
          ? `即将${installPreview.installAction === "upgrade" ? "升级" : "安装"}插件“${installPreview.name}”。请先确认它声明的权限。`
          : "请确认插件权限后再继续安装。"}
        footer={(
          <>
            <Button
              variant="outline"
              onClick={() => setInstallPreviewOpen(false)}
              disabled={pendingInstallPhase === "install"}
            >
              取消
            </Button>
            <Button
              onClick={installAddon}
              disabled={!installPreview || pendingInstallPhase === "install"}
            >
              {pendingInstallPhase === "install" ? "安装中..." : "确认并继续"}
            </Button>
          </>
        )}
      >
        {installPreview ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <PreviewMeta label="插件标识" value={installPreview.addonId} />
              <PreviewMeta label="版本" value={installPreview.version} />
              <PreviewMeta label="动作" value={installPreview.installAction === "upgrade" ? "升级" : "安装"} />
              <PreviewMeta label="安装后状态" value={installPreview.enableAfterInstall ? "立即启用" : "仅安装"} />
              {installPreview.existingVersion ? (
                <PreviewMeta label="当前已装版本" value={installPreview.existingVersion} />
              ) : null}
            </div>

            {installPreview.description ? (
              <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3">
                <p className="text-xs text-muted-foreground">插件说明</p>
                <p className="mt-2 text-sm leading-6">{installPreview.description}</p>
              </div>
            ) : null}

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">声明权限</p>
                <Badge variant="outline">
                  {installPreview.permissions.length > 0 ? `${installPreview.permissions.length} 项` : "未声明"}
                </Badge>
              </div>

              {installPreview.permissions.length > 0 ? (
                <div className="space-y-2">
                  {installPreview.permissions.map((permission) => (
                    <div
                      key={permission.key}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-sm">{permission.key}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {getPermissionDescription(permission.key)}
                        </p>
                      </div>
                      <Badge
                        variant={permission.risk === "sensitive" ? "destructive" : "outline"}
                        className="shrink-0"
                      >
                        {permission.risk === "sensitive" ? "高风险" : "常规"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                  该插件未在 `addon.json` 中声明任何权限。
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
