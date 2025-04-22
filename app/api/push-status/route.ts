import { NextResponse } from "next/server"

export async function GET() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY

  const isConfigured = !!vapidPublicKey && !!vapidPrivateKey

  return NextResponse.json({
    pushNotificationsConfigured: isConfigured,
    publicKeyAvailable: !!vapidPublicKey,
    // Don't expose the private key, just whether it exists
    privateKeyAvailable: !!vapidPrivateKey,
  })
}
