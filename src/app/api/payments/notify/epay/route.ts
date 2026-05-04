import { handleEpayPaymentNotification } from "@/lib/payment-gateway"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const payload: Record<string, string> = {}
    searchParams.forEach((value, key) => {
      payload[key] = value
    })
    const success = await handleEpayPaymentNotification(payload)
    return new Response(success ? "success" : "failure", {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    })
  } catch (error) {
    console.error("[api/payments/notify/epay] unexpected error", error)
    return new Response("failure", {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    })
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? ""
    let payload: Record<string, string> = {}

    if (contentType.includes("application/json")) {
      const json = await request.json() as Record<string, unknown>
      for (const [key, value] of Object.entries(json)) {
        payload[key] = String(value ?? "")
      }
    } else {
      const body = await request.text()
      payload = Object.fromEntries(new URLSearchParams(body).entries())
    }

    const success = await handleEpayPaymentNotification(payload)
    return new Response(success ? "success" : "failure", {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    })
  } catch (error) {
    console.error("[api/payments/notify/epay] unexpected error", error)
    return new Response("failure", {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    })
  }
}
