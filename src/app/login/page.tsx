import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { LoginForm } from "@/components/login-form"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { readSearchParam } from "@/lib/search-params"
import { getSiteSettings } from "@/lib/site-settings"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `登录 - ${settings.siteName}`,
    description: `登录 ${settings.siteName}，继续浏览帖子、参与讨论并管理你的账户。`,
  }
}

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams
  const [user, settings] = await Promise.all([getCurrentUser(), getSiteSettings()])
  const authError = readSearchParam(searchParams?.authError) ?? ""

  if (user) {
    redirect("/")
  }

  return (
    <div className="min-h-screen ">
      <SiteHeader />
      <main className="mx-auto max-w-[520px] px-4 py-10 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>登录论坛</CardTitle>
          </CardHeader>
          <CardContent>
            {authError ? <p className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{authError}</p> : null}
            <LoginForm settings={settings} />
            <div className="mt-4 space-y-2 text-center text-sm text-muted-foreground">
              <p>
                忘记密码？<Link href="/forgot-password" className="font-medium text-foreground hover:underline">找回密码</Link>
              </p>
              <p>
                还没有账户？<Link href="/register" className="font-medium text-foreground hover:underline">去注册</Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
