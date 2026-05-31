import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'

export default async function MdxLayout({ children }: { children: React.ReactNode }) {
  const pageMap = await getPageMap()
  return (
    <Layout
      pageMap={pageMap}
      navbar={
        <Navbar 
          logo={
            <span style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#7B39FC' }}>⚓</span> AnchorVault Docs
            </span>
          } 
          projectLink="https://github.com/shriyashsoni/anchorvault"
        />
      }
      footer={<Footer>AnchorVault © {new Date().getFullYear()} - Yield Routing Protocol.</Footer>}
      docsRepositoryBase="https://github.com/shriyashsoni/anchorvault/tree/main/docs-site"
      sidebar={{ defaultMenuCollapseLevel: 1 }}
    >
      {children}
    </Layout>
  )
}
