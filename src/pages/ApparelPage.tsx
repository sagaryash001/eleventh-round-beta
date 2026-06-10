import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { apiGet } from '../lib/api/client'

type Product = {
  id: string
  name: string
  slug: string | null
  description: string | null
  price_display: string | null
  category: string | null
  collection: string | null
  image_path: string | null
  gallery_images: string[] | null
  hover_image_path: string | null
  external_url: string | null
  shopify_url: string | null
  sizes: string[] | null
  colors: string[] | null
  badge: string | null
  stock_status: 'in_stock' | 'low_stock' | 'sold_out' | 'hidden'
  featured: boolean
  sort_order: number
}

async function trackClick(id: string) {
  try { await fetch(`/api/public/apparel/${id}/click`, { method: 'POST' }) } catch { /* best-effort */ }
}

const STOCK_LABEL: Record<string, string> = {
  in_stock: 'In Stock', low_stock: 'Low Stock', sold_out: 'Sold Out',
}
const STOCK_COLOR: Record<string, string> = {
  in_stock: '#00c060', low_stock: '#c9a82c', sold_out: '#c00000',
}

function ProductModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const link    = product.shopify_url || product.external_url || null
  const soldOut = product.stock_status === 'sold_out'

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = '' }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        style={{ background: '#0d0d0f', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-gray-3 hover:text-off-white transition-colors"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
          aria-label="Close"
        >
          ✕
        </button>

        <div className="grid sm:grid-cols-2">
          {/* Image */}
          <div className="relative" style={{ aspectRatio: '4/5', background: '#0a0a0c', minHeight: 240 }}>
            {product.image_path ? (
              <img
                src={product.image_path}
                alt={product.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-display text-charcoal-3 uppercase" style={{ fontSize: 48 }}>
                  {product.name.slice(0, 2)}
                </span>
              </div>
            )}
            {product.badge && (
              <div
                className="absolute top-3 left-3 font-condensed text-[9px] font-bold tracking-[0.4em] uppercase px-2.5 py-1.5"
                style={{ background: '#8b0000', color: '#f0ece4' }}
              >
                {product.badge}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="p-6 flex flex-col">
            <div className="font-condensed text-[9px] font-bold tracking-[0.4em] uppercase text-blood-glow mb-2">
              {product.collection || product.category || 'Apparel'}
            </div>
            <h2 className="font-display text-off-white uppercase mb-1" style={{ fontSize: 28, lineHeight: 0.95 }}>
              {product.name}
            </h2>
            {product.price_display && (
              <div className="font-condensed text-[22px] font-bold text-off-white mb-4">{product.price_display}</div>
            )}
            {product.description && (
              <p className="font-condensed text-gray-2 text-[13px] leading-relaxed mb-4">{product.description}</p>
            )}

            {(product.sizes ?? []).length > 0 && (
              <div className="mb-4">
                <div className="font-condensed text-[9px] font-bold tracking-[0.3em] uppercase text-gray-3 mb-2">Sizes</div>
                <div className="flex gap-1.5 flex-wrap">
                  {(product.sizes ?? []).map(s => (
                    <span key={s} className="font-condensed text-[10px] font-bold uppercase px-2 py-1 border border-charcoal-3 text-gray-2">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {(product.colors ?? []).length > 0 && (
              <div className="mb-4">
                <div className="font-condensed text-[9px] font-bold tracking-[0.3em] uppercase text-gray-3 mb-2">Colors</div>
                <div className="flex gap-1.5 flex-wrap">
                  {(product.colors ?? []).map(c => (
                    <span key={c} className="font-condensed text-[10px] uppercase px-2 py-1 border border-charcoal-3 text-gray-2">{c}</span>
                  ))}
                </div>
              </div>
            )}

            {product.stock_status && product.stock_status !== 'in_stock' && (
              <div className="font-condensed text-[10px] font-bold uppercase tracking-wide mb-4"
                style={{ color: STOCK_COLOR[product.stock_status] ?? '#4a4846' }}>
                ● {STOCK_LABEL[product.stock_status] ?? product.stock_status}
              </div>
            )}

            <div className="mt-auto pt-2">
              {link && !soldOut ? (
                <button
                  onClick={() => { trackClick(product.id); window.open(link, '_blank', 'noopener,noreferrer') }}
                  className="w-full font-condensed text-[11px] font-bold tracking-[0.3em] uppercase border py-3 transition-all duration-200"
                  style={{ borderColor: '#333', color: '#7a7672', cursor: 'pointer', background: 'transparent' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(139,0,0,0.6)'; e.currentTarget.style.color = '#f0ece4' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#7a7672' }}
                >
                  Shop Now →
                </button>
              ) : soldOut ? (
                <div className="w-full font-condensed text-[11px] font-bold tracking-[0.3em] uppercase text-center py-3 border"
                  style={{ borderColor: '#333', color: '#4a4846' }}>
                  Sold Out
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProductCard({ product, onOpen }: { product: Product; onOpen: (p: Product) => void }) {
  const [hovered, setHovered] = useState(false)
  const soldOut = product.stock_status === 'sold_out'
  const link    = product.shopify_url || product.external_url || null

  const imgSrc = (hovered && product.hover_image_path) ? product.hover_image_path : product.image_path

  return (
    <div
      className="group border border-charcoal-3 hover:border-blood/40 transition-all duration-300 overflow-hidden cursor-pointer"
      style={{ background: '#0f0f12' }}
      onClick={() => onOpen(product)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Image */}
      <div className="relative overflow-hidden" style={{ aspectRatio: '4/5', background: '#0a0a0c' }}>
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover transition-all duration-500"
            style={{ transform: hovered ? 'scale(1.04)' : 'scale(1)' }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-display text-charcoal-3 uppercase" style={{ fontSize: 'clamp(32px,4vw,56px)' }}>
              {product.name.slice(0, 2)}
            </span>
          </div>
        )}

        {/* Badge */}
        {product.badge && (
          <div className="absolute top-3 left-3 z-10 font-condensed text-[9px] font-bold tracking-[0.4em] uppercase px-2.5 py-1.5 pointer-events-none"
            style={{ background: '#8b0000', color: '#f0ece4' }}>
            {product.badge}
          </div>
        )}

        {/* Sold-out overlay */}
        {soldOut && (
          <div className="absolute inset-0 flex items-end justify-center pb-4 z-10 pointer-events-none"
            style={{ background: 'rgba(0,0,0,0.55)' }}>
            <span className="font-condensed text-[11px] font-bold uppercase tracking-[0.3em] text-off-white/70">Sold Out</span>
          </div>
        )}
      </div>

      {/* Card info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <div className="font-condensed text-[14px] font-bold text-off-white">{product.name}</div>
            {/* Color chips */}
            {(product.colors ?? []).length > 0 && (
              <div className="flex gap-1 flex-wrap mt-1">
                {(product.colors ?? []).map(c => (
                  <span key={c} className="font-condensed text-[9px] uppercase tracking-wide px-1.5 py-0.5 border border-charcoal-3 text-gray-3">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
          {product.price_display && (
            <div className="font-condensed text-[16px] font-bold text-off-white flex-shrink-0">{product.price_display}</div>
          )}
        </div>

        {/* Sizes */}
        {(product.sizes ?? []).length > 0 && (
          <div className="flex gap-1 flex-wrap mb-3">
            {(product.sizes ?? []).map(s => (
              <span key={s} className="font-condensed text-[9px] font-bold uppercase px-1.5 py-0.5 border border-charcoal-3 text-gray-3">
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Stock indicator */}
        {product.stock_status && product.stock_status !== 'in_stock' && (
          <div className="font-condensed text-[9px] font-bold uppercase tracking-wide mb-2"
            style={{ color: STOCK_COLOR[product.stock_status] ?? '#4a4846' }}>
            ● {STOCK_LABEL[product.stock_status] ?? product.stock_status}
          </div>
        )}

        {/* CTA — "Shop Now" opens link directly; everything else bubbles to card modal */}
        <button
          onClick={e => {
            if (!soldOut && link) {
              e.stopPropagation()
              trackClick(product.id)
              window.open(link, '_blank', 'noopener,noreferrer')
            }
          }}
          className="w-full font-condensed text-[10px] font-bold tracking-[0.3em] uppercase border py-2.5 transition-all duration-200"
          style={{ borderColor: '#333', color: soldOut ? '#4a4846' : '#7a7672', cursor: 'pointer', background: 'transparent' }}
          onMouseEnter={e => { if (!soldOut) { e.currentTarget.style.borderColor = 'rgba(139,0,0,0.6)'; e.currentTarget.style.color = '#f0ece4' } }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = soldOut ? '#4a4846' : '#7a7672' }}
        >
          {soldOut ? 'Sold Out' : link ? 'Shop Now →' : 'View Details'}
        </button>
      </div>
    </div>
  )
}

export default function ApparelPage() {
  const [products,    setProducts]    = useState<Product[]>([])
  const [loading,     setLoading]     = useState(true)
  const [catFilter,   setCatFilter]   = useState('all')
  const [colFilter,   setColFilter]   = useState('all')
  const [sizeFilter,  setSizeFilter]  = useState('all')
  const [colorFilter, setColorFilter] = useState('all')
  const [selected,    setSelected]    = useState<Product | null>(null)
  const openModal  = useCallback((p: Product) => setSelected(p), [])
  const closeModal = useCallback(() => setSelected(null), [])

  useEffect(() => {
    apiGet<{ ok: boolean; products: Product[] }>('/api/public/apparel')
      .then(d => setProducts(d.products ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Derive unique filter values from loaded products
  const { categories, collections, sizes, colors } = useMemo(() => {
    const cats = new Set<string>(), cols = new Set<string>()
    const szs  = new Set<string>(), cls  = new Set<string>()
    for (const p of products) {
      if (p.category)   cats.add(p.category)
      if (p.collection) cols.add(p.collection)
      for (const s of p.sizes  ?? []) szs.add(s)
      for (const c of p.colors ?? []) cls.add(c)
    }
    return { categories: [...cats], collections: [...cols], sizes: [...szs], colors: [...cls] }
  }, [products])

  const filtered = useMemo(() => {
    return products.filter(p => {
      if (catFilter   !== 'all' && p.category   !== catFilter)              return false
      if (colFilter   !== 'all' && p.collection !== colFilter)               return false
      if (sizeFilter  !== 'all' && !(p.sizes  ?? []).includes(sizeFilter))  return false
      if (colorFilter !== 'all' && !(p.colors ?? []).includes(colorFilter)) return false
      return true
    })
  }, [products, catFilter, colFilter, sizeFilter, colorFilter])

  const hasFilters = catFilter !== 'all' || colFilter !== 'all' || sizeFilter !== 'all' || colorFilter !== 'all'
  const clearFilters = () => { setCatFilter('all'); setColFilter('all'); setSizeFilter('all'); setColorFilter('all') }

  const showFilters = !loading && products.length > 0 && (categories.length > 1 || collections.length > 1 || sizes.length > 0 || colors.length > 0)

  const FilterRow = ({ label, value, onChange, options }: {
    label: string; value: string; onChange: (v: string) => void; options: string[]
  }) => {
    if (options.length === 0) return null
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-condensed text-[9px] font-bold tracking-[0.4em] uppercase text-gray-3">{label}</span>
        {['all', ...options].map(opt => (
          <button key={opt} onClick={() => onChange(opt)}
            className="font-condensed text-[10px] font-bold tracking-[0.2em] uppercase px-3 py-1.5 border transition-all"
            style={{
              background:  value === opt ? '#8b0000' : 'transparent',
              borderColor: value === opt ? '#8b0000' : '#333',
              color:       value === opt ? '#f0ece4' : '#7a7672',
            }}>
            {opt === 'all' ? 'All' : opt}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      {selected && <ProductModal product={selected} onClose={closeModal} />}
      <Navbar />

      {/* Collection bar */}
      <div className="pt-[72px]">
        <div className="flex items-center justify-between px-10 border-b border-charcoal-3"
          style={{ height: 64, background: '#080809' }}>
          <div className="sec-label" style={{ marginBottom: 0 }}>Eleventh Round · Apparel</div>
          {!loading && products.length > 0 && (
            <div className="font-condensed text-[10px] tracking-[0.3em] uppercase text-gray-3">
              {products.length} piece{products.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        <div className="red-rule" />
      </div>

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

          {/* Filters */}
          {showFilters && (
            <div className="space-y-3 mb-10 pb-8 border-b border-charcoal-3">
              <FilterRow label="Type"       value={catFilter}   onChange={setCatFilter}   options={categories} />
              <FilterRow label="Collection" value={colFilter}   onChange={setColFilter}   options={collections} />
              <FilterRow label="Size"       value={sizeFilter}  onChange={setSizeFilter}  options={sizes} />
              <FilterRow label="Color"      value={colorFilter} onChange={setColorFilter} options={colors} />
              {hasFilters && (
                <button onClick={clearFilters}
                  className="font-condensed text-[9px] font-bold uppercase tracking-wide text-blood-glow underline hover:no-underline transition-all">
                  Clear all filters
                </button>
              )}
            </div>
          )}

          {/* Grid */}
          {loading ? (
            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {[1, 2, 3].map(i => (
                <div key={i} className="border border-charcoal-3 animate-pulse" style={{ aspectRatio: '4/5', background: '#0f0f12' }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center border border-charcoal-3">
              <div className="font-condensed text-gray-3 text-[13px] tracking-wide">
                {hasFilters
                  ? <>{filtered.length === 0 && 'No products match your filters.'} <button className="text-blood-glow underline ml-1" onClick={clearFilters}>Clear filters</button></>
                  : 'No apparel available yet.'}
              </div>
            </div>
          ) : (
            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {filtered.map(product => (
                <ProductCard key={product.id} product={product} onOpen={openModal} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Brand statement */}
      <section className="py-16 px-10 bg-near-black">
        <div className="red-rule mb-16" />
        <div className="max-w-[1200px] mx-auto text-center">
          <p className="font-display text-off-white uppercase"
            style={{ fontSize: 'clamp(36px,5vw,80px)', lineHeight: 0.9 }}>
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
