import { generateStaticParamsFor, importPage } from 'nextra/pages'
import { notFound } from 'next/navigation'

export const generateStaticParams = generateStaticParamsFor('mdx')

export async function generateMetadata(props: any) {
  try {
    const params = await props.params
    const mdxPath = params.mdx || []
    if (mdxPath.includes('_not-found')) {
      return {}
    }
    const { metadata } = await importPage(mdxPath)
    return metadata || {}
  } catch (e) {
    return {}
  }
}

export default async function Page(props: any) {
  try {
    const params = await props.params
    const mdxPath = params.mdx || []
    if (mdxPath.includes('_not-found')) {
      notFound()
    }
    const { default: MDXPage, toc } = await importPage(mdxPath)
    return <MDXPage toc={toc} />
  } catch (e) {
    notFound()
  }
}
