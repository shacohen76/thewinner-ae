'use client'

import { useState } from 'react'

interface ArBuyingGuideProps {
  qaGuide: Array<{ q: string; a: string }>
  keywordAr: string
}

export default function ArBuyingGuide({ qaGuide, keywordAr }: ArBuyingGuideProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-5 border-b border-gray-100">
        <h2 className="text-xl font-bold text-gray-900">
          دليل شراء {keywordAr}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          أسئلة شائعة تساعدك في اختيار المنتج المناسب
        </p>
      </div>

      <div className="divide-y divide-gray-100">
        {qaGuide.map((qa, index) => (
          <div key={index}>
            <button
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="w-full flex items-start gap-3 p-5 text-right hover:bg-gray-50 transition-colors"
            >
              <span className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs transition-transform ${
                openIndex === index ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {openIndex === index ? '−' : '+'}
              </span>
              <span className={`text-sm font-semibold text-right flex-1 ${
                openIndex === index ? 'text-orange-600' : 'text-gray-800'
              }`}>
                {qa.q}
              </span>
            </button>
            
            {openIndex === index && (
              <div className="px-5 pb-5 pr-13">
                <p className="text-sm text-gray-600 leading-relaxed">
                  {qa.a}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
