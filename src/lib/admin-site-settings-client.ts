export async function saveAdminSiteSettings(payload: Record<string, unknown>) {
  const response = await fetch("/api/admin/site-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  const result = await response.json().catch(() => null) as { message?: string } | null

  return {
    ok: response.ok,
    message: result?.message ?? (response.ok ? "保存成功" : "保存失败"),
  }
}
