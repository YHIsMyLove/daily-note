import { Providers } from '@/components/Providers'
import './globals.css'

export const metadata = {
  title: 'Daily Note',
  description: 'Daily note-taking application',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
