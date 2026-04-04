import { adminPost, getAdminClientErrorMessage } from "@/lib/admin-client"

export async function saveAdminSiteSettings(payload: Record<string, unknown>) {
  try {
    const result = await adminPost("/api/admin/site-settings", payload, {
      defaultSuccessMessage: "保存成功",
      defaultErrorMessage: "保存失败",
    })

    return {
      ok: true,
      message: result.message,
    }
  } catch (error) {
    return {
      ok: false,
      message: getAdminClientErrorMessage(error, "保存失败"),
    }
  }
}
