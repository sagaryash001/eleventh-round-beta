import React, { useState } from 'react'
import { useCart } from '../../context/CartContext'

export default function CartDrawer() {
  const { items, open, closeCart, remove, setQty, total, clear } = useCart()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCheckout() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({
            name:     `${i.name} — ${i.variant} / ${i.size}`,
            price:    i.price,
            quantity: i.quantity,
            image:    `${window.location.origin}${i.image}`,
          })),
          success_url: `${window.location.origin}/apparel?checkout=success`,
          cancel_url:  `${window.location.origin}/apparel`,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Checkout failed.')
      window.location.href = json.url
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          background: 'rgba(0,0,0,0.65)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={closeCart}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col bg-charcoal border-l border-charcoal-3 shadow-2xl"
        style={{
          width: 'min(420px, 100vw)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-charcoal-3">
          <div>
            <div className="font-condensed text-[11px] font-bold tracking-[0.4em] uppercase text-blood-glow">
              Cart
            </div>
            <div className="font-condensed text-[13px] text-gray-3 mt-0.5">
              {items.length === 0 ? 'Empty' : `${items.reduce((s, i) => s + i.quantity, 0)} item(s)`}
            </div>
          </div>
          <button onClick={closeCart} className="text-gray-3 hover:text-off-white transition-colors text-xl leading-none">✕</button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="text-gray-3 font-condensed text-[13px] tracking-wide">Your cart is empty.</div>
              <button onClick={closeCart} className="btn-ghost text-[11px]">Continue Shopping</button>
            </div>
          ) : (
            items.map(item => (
              <div key={item.key} className="flex gap-4 border-b border-charcoal-3 pb-4">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-16 h-20 object-cover flex-shrink-0"
                  style={{ background: '#1a1a1e' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-condensed text-[13px] font-bold text-off-white truncate">{item.name}</div>
                  <div className="font-condensed text-[11px] text-gray-3 mt-0.5">{item.variant} · {item.size}</div>
                  <div className="font-condensed text-[13px] text-blood-glow font-semibold mt-1">${item.price}</div>

                  <div className="flex items-center gap-3 mt-3">
                    {/* Qty controls */}
                    <div className="flex items-center border border-charcoal-3">
                      <button
                        className="w-7 h-7 text-gray-3 hover:text-off-white transition-colors font-condensed text-[14px]"
                        onClick={() => setQty(item.key, item.quantity - 1)}
                      >−</button>
                      <span className="w-7 text-center font-condensed text-[12px] text-off-white">{item.quantity}</span>
                      <button
                        className="w-7 h-7 text-gray-3 hover:text-off-white transition-colors font-condensed text-[14px]"
                        onClick={() => setQty(item.key, item.quantity + 1)}
                      >+</button>
                    </div>
                    <button
                      className="font-condensed text-[10px] text-gray-3 hover:text-blood-glow transition-colors tracking-wide uppercase"
                      onClick={() => remove(item.key)}
                    >Remove</button>
                  </div>
                </div>
                <div className="font-condensed text-[13px] font-bold text-off-white flex-shrink-0">
                  ${(item.price * item.quantity).toFixed(2)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-6 py-5 border-t border-charcoal-3 space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-condensed text-[12px] uppercase tracking-widest text-gray-3">Subtotal</span>
              <span className="font-condensed text-[18px] font-bold text-off-white">${total.toFixed(2)}</span>
            </div>
            <div className="font-condensed text-[10px] text-gray-3 tracking-wide">Shipping & tax calculated at checkout</div>

            {error && (
              <div className="font-condensed text-[11px] text-blood-glow border border-blood/30 px-3 py-2">{error}</div>
            )}

            <button
              className="btn-primary w-full text-center"
              onClick={handleCheckout}
              disabled={loading}
            >
              {loading ? 'Redirecting…' : 'Checkout →'}
            </button>
            <button
              className="w-full font-condensed text-[10px] text-gray-3 hover:text-blood-glow transition-colors tracking-[0.2em] uppercase"
              onClick={clear}
            >
              Clear Cart
            </button>
          </div>
        )}
      </div>
    </>
  )
}
