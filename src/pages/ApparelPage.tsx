import React, { useState, useEffect, useMemo } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { apiGet } from '../lib/api/client'

type Product = {
  id: string
  name: string
  description: string | null
  price_display: string | null
  category: string | null
  image_path: string | null
  external_url: string | null
  featured: boolean
  sort_order: number
}

async function trackClick(id: string) {
  try {
    await fetch(`/api/public/apparel/${id}/click`, { method: 'POST' })
  } catch {
    // best-effort — never block navigation
  }
}

function ProductCard({ product }: { product: Product }) {
  const handleClick = () => {
    if (!product.external_url) return
    trackClick(product.id)
    window.open(product.external_url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      className="group border border-charcoal-3 hover:border-blood/40 transition-all duration-300 overflow-hidden cursor-pointer"
      style={{ background: '#0f0f12' }}
      onClick={handleClick}
    >
      {/* Image */}
      <div className="relative overflow-hidden" style={{ aspectRatio: '4/5', background: '#0a0a0c' }}>
        {product.image_path ? (
          <img
            src={product.image_path}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-display text-charcoal-3 uppercase" style={{ fontSize: 'clamp(32px,4vw,56px)' }}>
              {product.name.slice(0, 2)}
            </span>
          </div>
        )}
        {product.featured && (
          <div className="absolute top-3 left-3 z-10 font-condensed text-[9px] font-bold tracking-[0.4em] uppercase px-2.5 py-1.5 pointer-events-none"
            style={{ background: '#8b0000', color: '#f0ece4' }}>
            Featured
          </div>
        )}
      </div>

      {/* Card info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <div className="font-condensed text-[14px] font-bold text-off-white">{product.name}</div>
            {product.category && (
              <div className="font-condensed text-[10px] text-gray-3 mt-0.5 uppercase tracking-wide">{product.category}</div>
            )}
          </div>
          {product.price_display && (
            <div className="font-condensed text-[16px] font-bold text-off-white flex-shrink-0">{product.price_display}</div>
          )}
        </div>
        {product.description && (
          <p className="font-condensed text-[11px] text-gray-3 leading-relaxed mb-3 line-clamp-2">{product.description}</p>
        )}
        {product.external_url && (
          <div className="w-full font-condensed text-[10px] font-bold tracking-[0.3em] uppercase border border-charcoal-3 group-hover:border-blood/60 group-hover:text-off-white text-gray-3 py-2.5 transition-all duration-200 text-center">
            Shop Now →
          </div>
        )}
      </div>
    </div>
  )
}

export default function ApparelPage() {
  const [products,       setProducts]       = useState<Product[]>([])
  const [loading,        setLoading]        = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('all')

  useEffect(() => {
    apiGet<{ ok: boolean; products: Product[] }>('/api/public/apparel')
      .then(d => setProducts(d.products ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))] as string[]
    return cats
  }, [products])

  const filtered = useMemo(() => {
    if (categoryFilter === 'all') return products
    return products.filter(p => p.category === categoryFilter)
  }, [products, categoryFilter])

  return (
    <div className="min-h-screen bg-black">
      <Navbar />

      {/* Slim collection bar */}
      <div className="pt-[72px]">
        <div
          className="flex items-center justify-between px-10 border-b border-charcoal-3"
          style={{ height: 64, background: '#080809' }}
        >
          <div className="sec-label" style={{ marginBottom: 0 }}>Eleventh Round · Apparel</div>
          {!loading && products.length > 0 && (
            <div className="font-condensed text-[10px] tracking-[0.3em] uppercase text-gray-3">
              {products.length} piece{products.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        <div className="red-rule" />
      </div>

      {/* Shop section */}
      <section id="shop" className="pt-10 pb-20 px-10">
        <div className="max-w-[1200px] mx-auto">

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
            <div>
              <div className="sec-label mb-2">Collection</div>
              <h2 className="font-display text-off-white uppercase" style={{ fontSize: 'clamp(32px,4vw,60px)', lineHeight: 0.92 }}>
                Eleventh Round<br />Apparel
              </h2>
            </div>
          </div>

          {/* Category filter — only shown when products exist */}
          {!loading && categories.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mb-10 pb-8 border-b border-charcoal-3">
              <span className="font-condensed text-[9px] font-bold tracking-[0.4em] uppercase text-gray-3">Type</span>
              {(['all', ...categories] as string[]).map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className="font-condensed text-[10px] font-bold tracking-[0.2em] uppercase px-4 py-2 border transition-all"
                  style={{
                    background:  categoryFilter === cat ? '#8b0000' : 'transparent',
                    borderColor: categoryFilter === cat ? '#8b0000' : '#333',
                    color:       categoryFilter === cat ? '#f0ece4' : '#7a7672',
                  }}
                >
                  {cat === 'all' ? 'All' : cat}
                </button>
              ))}
            </div>
          )}

          {/* Product grid */}
          {loading ? (
            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {[1, 2, 3].map(i => (
                <div key={i} className="border border-charcoal-3 animate-pulse" style={{ aspectRatio: '4/5', background: '#0f0f12' }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center border border-charcoal-3">
              <div className="font-condensed text-gray-3 text-[13px] tracking-wide">
                {categoryFilter !== 'all'
                  ? <>No products in this category. <button className="text-blood-glow underline ml-1" onClick={() => setCategoryFilter('all')}>Show all</button></>
                  : 'No apparel available yet.'}
              </div>
            </div>
          ) : (
            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {filtered.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Brand statement */}
      <section className="py-16 px-10 bg-near-black">
        <div className="red-rule mb-16" />
        <div className="max-w-[1200px] mx-auto text-center">
          <p
            className="font-display text-off-white uppercase"
            style={{ fontSize: 'clamp(36px,5vw,80px)', lineHeight: 0.9 }}
          >
            Not Merch.<br />
            <span className="text-blood-glow">Identity.</span>
          </p>
          <p className="font-condensed font-light text-gray-2 text-[15px] leading-relaxed max-w-lg mx-auto mt-6">
            Every piece represents something real.
            Worn by fighters who train with purpose and move with discipline.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  )
}
