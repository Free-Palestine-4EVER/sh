import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import FirebaseProvider from "@/components/firebase-provider"
import PushFooHandler from "@/components/push-foo-handler"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Chat App",
  description: "Real-time chat application with PWA support",
  icons: {
    icon: [{ url: "/icons/icon-192x192.png" }],
    apple: [{ url: "/icons/apple-touch-icon.png" }],
  },
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <FirebaseProvider>
            <PushFooHandler />
            {children}
          </FirebaseProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
