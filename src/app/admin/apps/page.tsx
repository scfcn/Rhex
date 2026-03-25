import { redirect } from "next/navigation"

import { AdminShell } from "@/components/admin-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { HOST_APPS } from "@/lib/apps"
import { requireAdminUser } from "@/lib/admin"

export default async function AdminAppsPage() {
  const admin = await requireAdminUser()
  if (!admin) {
    redirect("/login?redirect=/admin/apps")
  }

  return (
    <AdminShell currentTab="settings" adminName={admin.nickname ?? admin.username}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>应用</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            {HOST_APPS.map((app) => (
              <div key={app.id} className="rounded-[24px] border border-border p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{app.category}</p>
                    <h3 className="mt-2 text-lg font-semibold">{app.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{app.description}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  <a href={app.href} className="inline-flex h-10 items-center justify-center rounded-full border border-border px-4 transition-colors hover:bg-accent hover:text-accent-foreground">打开应用</a>
                  <a href={app.adminHref} className="inline-flex h-10 items-center justify-center rounded-full border border-border px-4 transition-colors hover:bg-accent hover:text-accent-foreground">应用后台</a>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  )
}
