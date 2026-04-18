import { notFound } from 'next/navigation'
import fs from 'fs'
import path from 'path'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import ArProductCard from '@/components/ArProductCard'
import ArBuyingGuide from '@/components/ArBuyingGuide'

export const revalidate = 86400 // 24h cache, same as English pages

// Generate static params from ar-content folder
export async function generateStaticParams() {
  const arContentDir = path.join(process.cwd(), 'ar-content')
  if (!fs.existsSync(arContentDir)) return []
  
  const files = fs.readdirSync(arContentDir)
    .filter(f => f.endsWith('.json') && !f.startsWith('_'))
  
  return files.map(f => ({
    slug: f.replace('.json', '')
  }))
}

// Load Arabic content from JSON file
function getArContent(slug: string) {
  const filePath = path.join(process.cwd(), 'ar-content', `${slug}.json`)
  if (!fs.existsSync(filePath)) return null
  
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw)
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const content = getArContent(params.slug)
  if (!content) return {}
  
  return {
    title: `${content.page_title_ar} | TheWinner`,
    description: content.page_title_ar,
    robots: 'noindex, nofollow',
    alternates: {
      languages: {
        'en-AE': `/best/${params.slug}`,
        'ar-AE': `/ar/best/${params.slug}`,
      }
    }
  }
}

export default async function ArabicKeywordPage({ params }: { params: { slug: string } }) {
  const content = getArContent(params.slug)
  if (!content) notFound()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-orange-500">
            TheWinner
          </Link>
          <Link 
            href={`/best/${params.slug}`}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-orange-500 transition-colors"
          >
            <span>EN</span>
            <span className="text-gray-300">|</span>
            <span className="font-semibold text-orange-500">عربي</span>
          </Link>
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="max-w-6xl mx-auto px-4 py-3">
        <nav className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/" className="hover:text-orange-500">الرئيسية</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-400">{content.category_name_ar}</span>
          <span className="text-gray-300">/</span>
          <span className="text-gray-700">{content.keyword_text_ar}</span>
        </nav>
      </div>

      {/* Page Title */}
      <div className="max-w-6xl mx-auto px-4 pb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          {content.page_title_ar}
        </h1>
        <p className="mt-2 text-gray-500 text-sm">
          آخر تحديث: أبريل 2026
        </p>
      </div>

      {/* Product Cards */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="space-y-4">
          {content.products.map((product: any, index: number) => (
            <ArProductCard
              key={product.asin}
              product={product}
              rank={index + 1}
              ctaText={content.cta_text_ar}
            />
          ))}
        </div>
      </div>

      {/* Buying Guide */}
      {content.qa_guide_ar && content.qa_guide_ar.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 py-12">
          <ArBuyingGuide 
            qaGuide={content.qa_guide_ar}
            keywordAr={content.keyword_text_ar}
          />
        </div>
      )}

      {/* Amazon Disclosure (Arabic) */}
      <footer className="bg-gray-100 border-t border-gray-200 mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-xs text-gray-500 leading-relaxed">
          <p>
            بصفتنا شريكاً في برنامج Amazon للتسويق بالعمولة، نحصل على عمولة من المشتريات المؤهلة.
            الأسعار والتوافر عرضة للتغيير. يُرجى مراجعة Amazon.ae للحصول على أحدث المعلومات.
          </p>
          <div className="mt-4 flex items-center justify-center gap-4">
            <Link href={`/best/${params.slug}`} className="text-orange-500 hover:underline">
              English Version
            </Link>
            <span className="text-gray-300">|</span>
            <Link href="/" className="text-gray-500 hover:text-orange-500">
              TheWinner.ae
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
