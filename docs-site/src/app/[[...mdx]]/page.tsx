import { generateStaticParamsFor, importPage } from 'nextra/pages'
import { notFound } from 'next/navigation'

export const generateStaticParams = generateStaticParamsFor('mdx')

export async function generateMetadata(props: any) {
  try {
    const params = await props.params
    if (!params.mdx || params.mdx.includes('_not-found')) {
      return {}
    }
    const { metadata } = await importPage(params.mdx)
    return metadata || {}
  } catch (e) {
    return {}
  }
}

export default async function Page(props: any) {
  try {
    const params = await props.params
    if (!params.mdx || params.mdx.includes('_not-found')) {
      notFound()
    }
    const { default: MDXPage, toc } = await importPage(params.mdx)
    return <MDXPage toc={toc} />
  } catch (e) {
    notFound()
  }
}
