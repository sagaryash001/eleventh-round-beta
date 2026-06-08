import React, { useState } from 'react'

// ── Shared form primitives ────────────────────────────────────────────────────

export function FField({
  label, value, onChange, type = 'text', placeholder, hint, required = false,
}: {
  label: string; value: string | number; onChange: (v: string) => void
  type?: string; placeholder?: string; hint?: string; required?: boolean
}) {
  const [f, setF] = useState(false)
  return (
    <div>
      <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1.5">
        {label}{required && <span className="text-blood-glow ml-1">*</span>}
      </label>
      <input type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setF(true)} onBlur={() => setF(false)}
        className="w-full bg-charcoal-2 border text-off-white font-body text-[13px] px-3 py-2 outline-none transition-all placeholder:text-gray-3"
        style={{ borderColor: f ? '#8b0000' : '#222226' }} />
      {hint && <p className="font-condensed text-[10px] text-gray-3 mt-1 tracking-wide">{hint}</p>}
    </div>
  )
}

export function FSelect({
  label, value, onChange, options, required = false,
}: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]; required?: boolean
}) {
  return (
    <div>
      <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1.5">
        {label}{required && <span className="text-blood-glow ml-1">*</span>}
      </label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-condensed text-[13px] px-3 py-2 outline-none">
        <option value="">— Select —</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export function ActionMsg({ msg }: { msg: { type: 'ok' | 'err'; text: string } | null }) {
  if (!msg) return null
  return (
    <div className={`font-condensed text-[11px] px-3 py-2 border ${
      msg.type === 'ok'
        ? 'text-green-400 border-green-900 bg-green-950/20'
        : 'text-blood-glow border-blood/25 bg-blood/10'
    }`}>
      {msg.text}
    </div>
  )
}

export function Spinner() {
  return (
    <span className="inline-block w-3 h-3 border border-off-white/40 border-t-off-white rounded-full animate-spin" />
  )
}

// Shared SubNav for all zones
export function SubNav({
  tabs, active, onChange,
}: {
  tabs: { id: string; label: string }[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div className="flex border-b border-charcoal-3 mb-6 overflow-x-auto flex-shrink-0"
      style={{ scrollbarWidth: 'none' }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className="font-condensed text-[10px] font-bold tracking-[0.15em] uppercase px-4 py-2.5 cursor-pointer border-0 bg-transparent whitespace-nowrap transition-all duration-150"
          style={{
            color:        active === t.id ? '#f0ece4' : '#4a4846',
            borderBottom: active === t.id ? '2px solid #C41E3A' : '2px solid transparent',
            marginBottom: -1,
          }}>
          {t.label}
        </button>
      ))}
    </div>
  )
}
