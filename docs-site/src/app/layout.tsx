import './globals.css'

export const metadata = {
  title: 'AnchorVault Documentation',
  description: 'The developer portal and technical specifications for the AnchorVault yield-routing on-chain Stellar protocol.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  )
}
