import './globals.css'

export const metadata = {
  title: 'AnchorVault Documentation',
  description: 'Detailed developer portal and technical specifications for AnchorVault yield-routing on-chain Stellar protocol.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
      </body>
    </html>
  )
}
