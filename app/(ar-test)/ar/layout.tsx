import type { Metadata } from 'next'
import { Noto_Sans_Arabic } from 'next/font/google'

const notoArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-arabic',
  display: 'swap',
})

export const metadata: Metadata = {
  robots: 'noindex, nofollow', // test pages — don't index
}

export default function ArabicTestLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div dir="rtl" lang="ar-AE" className={`${notoArabic.variable} font-arabic`}>
      {children}
    </div>
  )
}
