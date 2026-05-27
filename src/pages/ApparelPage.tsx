import React, { useState, useMemo, useEffect } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import ProductImageViewer from '../components/apparel/ProductImageViewer'
import CartDrawer from '../components/apparel/CartDrawer'
import { useCart } from '../context/CartContext'

// ── Product catalogue (Resilience Line only) ──────────────────────────────────
type Product = {
  id: string
  name: string
  variant: string
  category: 'hoodie' | 'joggers' | 'tee'
  price: number
  images: string[]
  sizes: string[]
  description: string
  tag: string
}

const SIZES_ALL    = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const SIZES_BOTTOMS = ['XS/28', 'S/30', 'M/32', 'L/34', 'XL/36', 'XXL/38']

const P = '/apparel/products'

const PRODUCTS: Product[] = [
  {
    id: 'joggers-onyx',
    name: 'Classic Joggers',
    variant: 'Onyx',
    category: 'joggers',
    price: 40,
    images: [`${P}/black-joggers-1.png`, `${P}/black-joggers-2.png`, `${P}/black-joggers-3.png`, `${P}/black-joggers-4.png`],
    sizes: SIZES_BOTTOMS,
    description: 'Heavyweight French terry construction. Tapered fit, ribbed cuffs, deep pockets. Built to move. The foundational piece of the Resilience Line.',
    tag: 'Best Seller',
  },
  {
    id: 'joggers-bone',
    name: 'Classic Joggers',
    variant: 'Bone',
    category: 'joggers',
    price: 40,
    images: [`${P}/white-joggers-1.png`, `${P}/white-joggers-2.png`, `${P}/white-joggers-3.png`, `${P}/white-joggers-4.png`],
    sizes: SIZES_BOTTOMS,
    description: 'Same heavyweight construction as the Onyx — in a clean off-white that holds its own. Pairs with every piece in the line.',
    tag: 'New',
  },
  {
    id: 'hoodie-onyx',
    name: 'Heavyweight Hoodie',
    variant: 'Onyx',
    category: 'hoodie',
    price: 45,
    images: [`${P}/black-hoodie-1.png`, `${P}/black-hoodie-2.png`, `${P}/black-hoodie-3.png`, `${P}/black-hoodie-4.png`],
    sizes: SIZES_ALL,
    description: '16oz premium fleece. Dropped shoulders, double-lined hood, heavyweight ribbing. Worn during camp, worn after. Built for longevity.',
    tag: 'Signature',
  },
  {
    id: 'hoodie-bone',
    name: 'Heavyweight Hoodie',
    variant: 'Bone',
    category: 'hoodie',
    price: 45,
    images: [`${P}/white-hoodie-1.png`, `${P}/white-hoodie-2.png`, `${P}/white-hoodie-3.png`, `${P}/white-hoodie-4.png`],
    sizes: SIZES_ALL,
    description: 'The Bone Hoodie. Clean, minimal, and unmistakably Eleventh Round. The off-white tone was built to wear in with time.',
    tag: 'Signature',
  },
  {
    id: 'tee-white',
    name: 'Resilience Tee',
    variant: 'White',
    category: 'tee',
    price: 35,
    images: [`${P}/white-tee-1.png`, `${P}/white-tee-2.png`, `${P}/white-tee-3.png`, `${P}/white-tee-4.png`],
    sizes: SIZES_ALL,
    description: '220gsm heavyweight cotton. Slightly oversized boxy cut, reinforced neckline, minimal Eleventh Round wordmark at chest.',
    tag: 'Essential',
  },
  {
    id: 'tee-onyx',
    name: 'Resilience Tee',
    variant: 'Onyx',
    category: 'tee',
    price: 35,
    images: [`${P}/black-tee-1.png`, `${P}/black-tee-2.png`, `${P}/black-tee-3.png`, `${P}/black-tee-4.png`],
    sizes: SIZES_ALL,
    description: 'The tee that started the line. Same boxy cut and heavyweight cotton in jet black — designed to be worn until it earns its history.',
    tag: 'Essential',
  },
]

// ── Sort & filter types ────────────────────────────────────────────────────────
type SortKey      = 'default' | 'price-asc' | 'price-desc' | 'name-az'
type ColorFilter  = 'all' | 'Onyx' | 'Bone' | 'White'
type CategoryFilter = 'all' | 'hoodie' | 'joggers' | 'tee'

// ── Product modal ─────────────────────────────────────────────────────────────
function ProductModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const { add } = useCart()
  const [size, setSize] = useState('')
  const [added, setAdded] = useState(false)
  const relatedVariants = PRODUCTS.filter(p => p.name === product.name && p.id !== product.id)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  function handleAdd() {
    if (!size) return
    add({ productId: product.id, name: product.name, variant: product.variant, size, price: product.price, image: product.images[0] })
    setAdded(true)
    setTimeout(() => setAdded(false), 1800)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative w-full max-w-[920px] bg-charcoal border border-charcoal-3 overflow-hidden"
        style={{ maxHeight: '92vh', display: 'grid', gridTemplateColumns: '1fr 1fr' }}
      >
        {/* Left — image viewer */}
        <div className="relative" style={{ background: '#0a0a0c', minHeight: 500 }}>
          <div
            className="absolute inset-0 pointer-events-none z-0"
            style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(139,0,0,0.08) 0%, transparent 65%)' }}
          />
          <div style={{ position: 'absolute', inset: 0 }}>
            <ProductImageViewer images={product.images} />
          </div>
          <div className="absolute bottom-10 left-0 right-0 text-center font-condensed text-[9px] tracking-[0.4em] uppercase text-gray-3 opacity-50 pointer-events-none z-20">
            Click to advance · Hover to pause
          </div>
        </div>

        {/* Right — product details */}
        <div className="flex flex-col p-8 overflow-y-auto">
          <button
            onClick={onClose}
            className="self-end text-gray-3 hover:text-off-white transition-colors text-lg mb-4 leading-none"
          >✕</button>

          <div className="font-condensed text-[9px] font-bold tracking-[0.5em] uppercase text-blood-glow mb-2">
            {product.tag}
          </div>
          <h2 className="font-display text-off-white uppercase mb-1" style={{ fontSize: 'clamp(28px,3.5vw,44px)', lineHeight: 0.9 }}>
            {product.name}
          </h2>
          <div className="font-condensed text-[13px] text-gray-3 mb-4">{product.variant}</div>
          <div className="font-condensed text-[24px] font-bold text-off-white mb-6">${product.price}</div>

          <p className="font-body font-light text-gray-1 text-[13px] leading-relaxed mb-6">
            {product.description}
          </p>

          {/* Related variants */}
          {relatedVariants.length > 0 && (
            <div className="mb-6">
              <div className="font-condensed text-[9px] tracking-[0.4em] uppercase text-gray-3 mb-2">Other colorways</div>
              <div className="flex gap-2">
                {relatedVariants.map(v => (
                  <button
                    key={v.id}
                    onClick={() => onClose()}
                    className="font-condensed text-[10px] font-medium border px-3 py-1.5 transition-colors"
                    style={{ borderColor: '#333', color: '#7a7672' }}
                    title={`View ${v.variant}`}
                  >
                    {v.variant}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Size selector */}
          <div className="mb-6">
            <div className="font-condensed text-[9px] tracking-[0.4em] uppercase text-gray-3 mb-3">Select Size</div>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map(s => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className="font-condensed text-[11px] font-bold border px-3 py-2 transition-all"
                  style={{
                    background:  size === s ? '#8b0000' : '#141416',
                    borderColor: size === s ? '#8b0000' : '#333',
                    color:       size === s ? '#f0ece4' : '#7a7672',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            {!size && <div className="font-condensed text-[10px] text-blood-glow mt-2 opacity-75">Please select a size</div>}
          </div>

          <div className="mt-auto space-y-3">
            <button
              className="btn-primary w-full text-center transition-all"
              onClick={handleAdd}
              disabled={!size}
              style={{ opacity: size ? 1 : 0.45 }}
            >
              {added ? '✓ Added to Cart' : 'Add to Cart'}
            </button>
            <div className="flex items-center gap-2 justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="font-condensed text-[10px] text-gray-3 tracking-wide">In Stock — Ships in 3–5 business days</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Product card ──────────────────────────────────────────────────────────────
function ProductCard({ product, onClick }: { product: Product; onClick: () => void }) {
  return (
    <div
      className="group cursor-pointer border border-charcoal-3 hover:border-blood/40 transition-all duration-300 overflow-hidden"
      style={{ background: '#0f0f12' }}
      onClick={onClick}
    >
      {/* Image viewer — cycles through all 4 shots on hover */}
      <div className="relative overflow-hidden" style={{ aspectRatio: '4/5', background: '#0a0a0c' }}>
        <ProductImageViewer images={product.images} compact />

        {/* Badge */}
        <div
          className="absolute top-3 left-3 z-10 font-condensed text-[9px] font-bold tracking-[0.4em] uppercase px-2.5 py-1.5 pointer-events-none"
          style={{ background: '#8b0000', color: '#f0ece4' }}
        >
          {product.tag}
        </div>

        {/* Hover hint */}
        <div
          className="absolute bottom-3 right-3 z-10 font-condensed text-[9px] tracking-[0.3em] uppercase text-gray-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.72)', padding: '4px 8px' }}
        >
          Hover to preview
        </div>
      </div>

      {/* Card info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-condensed text-[14px] font-bold text-off-white">{product.name}</div>
            <div className="font-condensed text-[11px] text-gray-3 mt-0.5">{product.variant}</div>
          </div>
          <div className="font-condensed text-[16px] font-bold text-off-white flex-shrink-0">${product.price}</div>
        </div>
        <button
          className="mt-3 w-full font-condensed text-[10px] font-bold tracking-[0.3em] uppercase border border-charcoal-3 hover:border-blood/60 hover:text-off-white text-gray-3 py-2.5 transition-all duration-200"
          onClick={e => { e.stopPropagation(); onClick() }}
        >
          View & Select Size
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ApparelPage() {
  const { count, openCart } = useCart()
  const [sort, setSort]                   = useState<SortKey>('default')
  const [colorFilter, setColorFilter]     = useState<ColorFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [activeProduct, setActiveProduct] = useState<Product | null>(null)

  const checkoutResult = new URLSearchParams(window.location.search).get('checkout')

  const filtered = useMemo(() => {
    let list = [...PRODUCTS]
    if (colorFilter !== 'all') list = list.filter(p => p.variant === colorFilter)
    if (categoryFilter !== 'all') list = list.filter(p => p.category === categoryFilter)
    if (sort === 'price-asc')  list.sort((a, b) => a.price - b.price)
    if (sort === 'price-desc') list.sort((a, b) => b.price - a.price)
    if (sort === 'name-az')    list.sort((a, b) => a.name.localeCompare(b.name))
    return list
  }, [sort, colorFilter, categoryFilter])

  return (
    <div className="min-h-screen bg-black">
      <Navbar />

      {checkoutResult === 'success' && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 font-condensed text-[12px] font-bold tracking-widest uppercase px-6 py-3 bg-green-900 text-green-300 border border-green-700">
          Order confirmed — thank you!
        </div>
      )}

      {/* Floating cart button */}
      <button
        onClick={openCart}
        className="fixed bottom-8 right-8 z-40 flex items-center gap-3 font-condensed text-[11px] font-bold tracking-[0.3em] uppercase px-5 py-3.5 transition-all hover:scale-105 active:scale-95"
        style={{ background: '#8b0000', color: '#f0ece4', boxShadow: '0 4px 24px rgba(139,0,0,0.4)' }}
      >
        <span>Cart</span>
        {count > 0 && (
          <span
            className="flex items-center justify-center rounded-full font-condensed text-[10px] font-bold"
            style={{ background: '#f0ece4', color: '#8b0000', width: 20, height: 20, minWidth: 20 }}
          >
            {count}
          </span>
        )}
      </button>

      <CartDrawer />

      {activeProduct && (
        <ProductModal product={activeProduct} onClose={() => setActiveProduct(null)} />
      )}

      {/* Slim collection bar */}
      <div className="pt-[72px]">
        <div
          className="flex items-center justify-between px-10 border-b border-charcoal-3"
          style={{ height: 64, background: '#080809' }}
        >
          <div className="sec-label" style={{ marginBottom: 0 }}>Resilience Line · Collection</div>
          <div className="font-condensed text-[10px] tracking-[0.3em] uppercase text-gray-3">
            {PRODUCTS.length} pieces
          </div>
        </div>
        <div className="red-rule" />
      </div>

      {/* Shop section */}
      <section id="shop" className="pt-10 pb-20 px-10">
        <div className="max-w-[1200px] mx-auto">

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
            <div>
              <div className="sec-label mb-2">Resilience Line</div>
              <h2 className="font-display text-off-white uppercase" style={{ fontSize: 'clamp(32px,4vw,60px)', lineHeight: 0.92 }}>
                Signature<br />Collection
              </h2>
            </div>
            <div className="font-condensed text-[11px] text-gray-3 tracking-wide">
              {filtered.length} of {PRODUCTS.length} pieces
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-10 pb-8 border-b border-charcoal-3">
            <div className="flex items-center gap-3">
              <span className="font-condensed text-[9px] font-bold tracking-[0.4em] uppercase text-gray-3">Sort</span>
              <select
                value={sort}
                onChange={e => setSort(e.target.value as SortKey)}
                className="font-condensed text-[11px] font-bold uppercase bg-charcoal border border-charcoal-3 text-off-white px-4 py-2 cursor-pointer focus:outline-none focus:border-blood/50"
              >
                <option value="default">Featured</option>
                <option value="price-asc">Price: Low → High</option>
                <option value="price-desc">Price: High → Low</option>
                <option value="name-az">Name: A → Z</option>
              </select>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-condensed text-[9px] font-bold tracking-[0.4em] uppercase text-gray-3">Type</span>
              {(['all', 'tee', 'hoodie', 'joggers'] as const).map(cat => (
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
                  {cat === 'all' ? 'All' : cat === 'tee' ? 'Tees' : cat === 'hoodie' ? 'Hoodies' : 'Joggers'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:ml-auto">
              <span className="font-condensed text-[9px] font-bold tracking-[0.4em] uppercase text-gray-3">Color</span>
              {(['all', 'Onyx', 'Bone', 'White'] as const).map(col => (
                <button
                  key={col}
                  onClick={() => setColorFilter(col)}
                  className="font-condensed text-[10px] font-bold tracking-[0.2em] uppercase px-4 py-2 border transition-all"
                  style={{
                    background:  colorFilter === col ? '#8b0000' : 'transparent',
                    borderColor: colorFilter === col ? '#8b0000' : '#333',
                    color:       colorFilter === col ? '#f0ece4' : '#7a7672',
                  }}
                >
                  {col === 'all' ? 'All' : col}
                </button>
              ))}
            </div>
          </div>

          {/* Product grid */}
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <div className="font-condensed text-gray-3 text-[13px] tracking-wide">No products match your filters.</div>
              <button
                className="mt-4 font-condensed text-[11px] text-blood-glow underline"
                onClick={() => { setColorFilter('all'); setCategoryFilter('all') }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {filtered.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onClick={() => setActiveProduct(product)}
                />
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
            Every piece in the Resilience Line represents something real.
            Worn by fighters who train with purpose and move with discipline.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  )
}
