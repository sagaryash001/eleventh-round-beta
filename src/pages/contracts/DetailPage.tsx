import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import Navbar from '../../components/Navbar'
import { useAuth } from '../../hooks/useAuth'
import {
  getContract, acceptContract, terminateContract,
  type Contract,
} from '../../lib/api/contracts'
import {
  updateObligationStatus, submitProof, reviewProof,
  type Obligation, type ObligationProof,
} from '../../lib/api/obligations'
import {
  createPaymentIntent, getContractPayments, getMilestones, addMilestone,
  type SponsorshipPayment, type PaymentMilestone,
} from '../../lib/api/payments'
import { createConversation } from '../../lib/api/conversations'
import { uploadFile } from '../../lib/api/uploads'

const stripePromise = (import.meta as any).env?.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe((import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY as string)
  : null

// ── Shared UI bits ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2
        className="font-condensed uppercase tracking-widest text-[11px] mb-4"
        style={{ color: '#4a4846', letterSpacing: '0.28em' }}
      >
        {title}
      </h2>
      {children}
    </div>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      className="p-5 border"
      style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)', borderLeft: '2px solid #8b0000', ...style }}
    >
      {children}
    </div>
  )
}

function Btn({ onClick, disabled, variant = 'primary', children }: {
  onClick: () => void; disabled?: boolean; variant?: 'primary' | 'ghost' | 'danger'; children: React.ReactNode
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: disabled ? 'rgba(139,0,0,0.2)' : '#8b0000', color: disabled ? '#4a4846' : '#f0ece4' },
    ghost:   { background: 'transparent', color: '#7a7672', border: '1px solid rgba(255,255,255,0.08)' },
    danger:  { background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-all duration-150"
      style={{ cursor: disabled ? 'not-allowed' : 'pointer', border: 'none', ...styles[variant] }}
    >
      {children}
    </button>
  )
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', pending_fighter: 'Awaiting Fighter Signature',
  pending_sponsor: 'Awaiting Sponsor Signature', active: 'Active',
  in_dispute: 'In Dispute', completed: 'Completed',
  terminated: 'Terminated', expired: 'Expired',
}
const STATUS_COLOR: Record<string, string> = {
  draft: '#4a4846', pending_fighter: '#b45309', pending_sponsor: '#b45309',
  active: '#166534', in_dispute: '#7f1d1d', completed: '#1e3a5f',
  terminated: '#374151', expired: '#374151',
}
const OB_COLOR: Record<string, string> = {
  pending: '#4a4846', in_progress: '#b45309', completed: '#166534',
  overdue: '#7f1d1d', canceled: '#374151',
}

// ── Obligation row ────────────────────────────────────────────────────────────

function ObligationRow({
  ob, isFighter, isSponsor,
  onStatusChange, onProofSubmit, onProofReview,
}: {
  ob: Obligation
  isFighter: boolean
  isSponsor: boolean
  onStatusChange: (id: string, status: string) => void
  onProofSubmit: (id: string) => void
  onProofReview: (id: string) => void
}) {
  const isOverdue = ob.status === 'pending' && new Date(ob.due_date) < new Date()

  return (
    <div
      className="flex items-start justify-between gap-4 p-4 border-b"
      style={{ borderColor: 'rgba(255,255,255,0.04)' }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm"
            style={{ background: OB_COLOR[ob.status] ?? '#374151', color: '#f0ece4' }}
          >
            {ob.status}
          </span>
          {isOverdue && ob.status === 'pending' && (
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#ef4444' }}>Overdue</span>
          )}
        </div>
        <p className="text-sm font-semibold" style={{ color: '#f0ece4' }}>{ob.title}</p>
        {ob.description && <p className="text-xs mt-0.5" style={{ color: '#7a7672' }}>{ob.description}</p>}
        <p className="text-[11px] mt-1" style={{ color: '#4a4846' }}>
          Due: {new Date(ob.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        {isFighter && ob.status === 'pending' && (
          <Btn onClick={() => onStatusChange(ob.id, 'in_progress')} variant="ghost">Start</Btn>
        )}
        {isFighter && ob.proof_required && ['pending','in_progress'].includes(ob.status) && (
          <Btn onClick={() => onProofSubmit(ob.id)}>Submit Proof</Btn>
        )}
        {isSponsor && ob.status === 'in_progress' && (
          <Btn onClick={() => onProofReview(ob.id)} variant="ghost">Review</Btn>
        )}
      </div>
    </div>
  )
}

// ── Proof submit modal ────────────────────────────────────────────────────────

function ProofModal({ obligationId, onDone, onClose }: { obligationId: string; onDone: () => void; onClose: () => void }) {
  const [type, setType]         = useState<'url'|'file'|'text'>('url')
  const [value, setValue]       = useState('')
  const [caption, setCaption]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [uploading, setUploading] = useState(false)
  const [err, setErr]           = useState('')
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setErr(''); setUploading(true)
    try {
      const { publicUrl } = await uploadFile('obligation-proof', file, obligationId)
      setValue(publicUrl)
    } catch (ex: any) {
      setErr(ex.message ?? 'Upload failed.')
    } finally { setUploading(false) }
  }

  const submit = async () => {
    if (!value.trim()) { setErr('Proof value required.'); return }
    setSaving(true); setErr('')
    try {
      await submitProof(obligationId, { proof_type: type, proof_value: value.trim(), caption: caption.trim() || undefined })
      onDone()
    } catch (e: any) {
      setErr(e.message)
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.8)' }}>
      <div className="w-full max-w-md p-6" style={{ background: '#0d0d0f', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 className="font-display uppercase tracking-widest mb-5" style={{ color: '#f0ece4', fontSize: 16, letterSpacing: '0.18em' }}>
          Submit Proof
        </h3>
        <div className="flex gap-2 mb-4">
          {(['url','text','file'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setType(t); setValue('') }}
              className="px-3 py-1.5 text-[10px] uppercase tracking-widest transition-colors"
              style={{
                background: type === t ? '#8b0000' : 'transparent',
                color: type === t ? '#f0ece4' : '#7a7672',
                border: '1px solid ' + (type === t ? '#8b0000' : 'rgba(255,255,255,0.08)'),
                cursor: 'pointer',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {type === 'file' ? (
          <div className="mb-3">
            <p className="text-[10px] mb-2" style={{ color: '#b45309' }}>
              ⚠ Uploaded files are stored in a shared space and accessible via a direct link.
              Do not upload sensitive or private documents.
            </p>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-6 text-sm text-center outline-none cursor-pointer border border-dashed transition-colors"
              style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.12)', color: '#7a7672' }}
            >
              {uploading ? (
                <span>Uploading…</span>
              ) : value ? (
                <span style={{ color: '#00c060' }}>✓ File uploaded — click to replace</span>
              ) : (
                <span>Click to upload file · jpg, png, pdf · max 10 MB</span>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileSelect} disabled={uploading} />
            {value && (
              <p className="text-xs mt-1 truncate" style={{ color: '#4a4846' }}>{value}</p>
            )}
          </div>
        ) : (
          <input
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={type === 'url' ? 'https://…' : 'Describe what you did…'}
            className="w-full px-4 py-3 text-sm mb-3 outline-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0ece4' }}
          />
        )}

        <input
          value={caption}
          onChange={e => setCaption(e.target.value)}
          placeholder="Optional note for the sponsor"
          className="w-full px-4 py-3 text-sm mb-4 outline-none"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0ece4' }}
        />
        {err && <p className="text-xs mb-3" style={{ color: '#ef4444' }}>{err}</p>}
        <div className="flex gap-3">
          <Btn onClick={submit} disabled={saving || uploading}>{saving ? 'Saving…' : 'Submit'}</Btn>
          <Btn onClick={onClose} variant="ghost">Cancel</Btn>
        </div>
      </div>
    </div>
  )
}

// ── Review modal ──────────────────────────────────────────────────────────────

function ReviewModal({ obligationId, onDone, onClose }: { obligationId: string; onDone: () => void; onClose: () => void }) {
  const [proofs, setProofs] = useState<ObligationProof[]>([])
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    import('../../lib/api/obligations').then(m =>
      m.getObligation(obligationId).then(r => setProofs(r.proofs))
    )
  }, [obligationId])

  const review = async (proofId: string, status: 'approved'|'rejected') => {
    setSaving(true)
    try {
      await reviewProof(obligationId, proofId, status, notes.trim() || undefined)
      onDone()
    } catch { setSaving(false) }
  }

  const pending = proofs.filter(p => p.review_status === 'pending')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.8)' }}>
      <div className="w-full max-w-lg p-6" style={{ background: '#0d0d0f', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 className="font-display uppercase tracking-widest mb-5" style={{ color: '#f0ece4', fontSize: 16, letterSpacing: '0.18em' }}>
          Review Proof
        </h3>
        {pending.length === 0 ? (
          <p className="text-sm mb-4" style={{ color: '#4a4846' }}>No pending proofs to review.</p>
        ) : (
          pending.map(p => (
            <div key={p.id} className="mb-4 p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs font-bold mb-1" style={{ color: '#7a7672' }}>{p.proof_type.toUpperCase()}</p>
              <p className="text-sm mb-1 break-all" style={{ color: '#f0ece4' }}>{p.proof_value}</p>
              {p.caption && <p className="text-xs" style={{ color: '#4a4846' }}>{p.caption}</p>}
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional review note"
                className="w-full px-3 py-2 text-sm mt-3 mb-3 outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0ece4' }}
              />
              <div className="flex gap-2">
                <Btn onClick={() => review(p.id, 'approved')} disabled={saving}>Approve</Btn>
                <Btn onClick={() => review(p.id, 'rejected')} disabled={saving} variant="danger">Reject</Btn>
              </div>
            </div>
          ))
        )}
        <Btn onClick={onClose} variant="ghost">Close</Btn>
      </div>
    </div>
  )
}

// ── Stripe checkout form ──────────────────────────────────────────────────────

function CheckoutForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe   = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)
  const [err, setErr]       = useState('')

  const handlePay = async () => {
    if (!stripe || !elements) return
    setPaying(true); setErr('')
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    })
    if (error) { setErr(error.message ?? 'Payment failed.'); setPaying(false) }
    else onSuccess()
  }

  return (
    <div>
      <PaymentElement />
      {err && <p className="text-xs mt-3" style={{ color: '#ef4444' }}>{err}</p>}
      <div className="mt-4">
        <Btn onClick={handlePay} disabled={paying || !stripe}>
          {paying ? 'Processing…' : 'Pay Now'}
        </Btn>
      </div>
    </div>
  )
}

function PaymentSection({
  contract, isSponsor, isFighter,
}: { contract: Contract; isSponsor: boolean; isFighter: boolean }) {
  const [payments, setPayments]   = useState<SponsorshipPayment[]>([])
  const [milestones, setMilestones] = useState<PaymentMilestone[]>([])
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentId, setPaymentId] = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)
  const [initiating, setInitiating] = useState(false)
  const [msg, setMsg]             = useState('')
  const [showMilestoneForm, setShowMilestoneForm] = useState(false)
  const [msName, setMsName]   = useState('')
  const [msAmount, setMsAmount] = useState('')
  const [msDue, setMsDue]     = useState('')

  const load = () => {
    Promise.all([
      getContractPayments(contract.id).then(r => setPayments(r.payments)),
      getMilestones(contract.id).then(r => setMilestones(r.milestones)),
    ]).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [contract.id])

  const initPay = async (milestoneId?: string) => {
    setInitiating(true); setMsg(''); setClientSecret(null)
    try {
      const r = await createPaymentIntent(contract.id, milestoneId)
      setClientSecret(r.client_secret)
      setPaymentId(r.payment_id)
    } catch (e: any) { setMsg(e.message) }
    finally { setInitiating(false) }
  }

  const addMs = async () => {
    if (!msName || !msAmount) return
    try {
      await addMilestone(contract.id, { name: msName, amount_usd: Number(msAmount), due_date: msDue || undefined })
      setMsName(''); setMsAmount(''); setMsDue(''); setShowMilestoneForm(false)
      load()
    } catch (e: any) { setMsg(e.message) }
  }

  if (loading) return null

  const succeeded = payments.filter(p => p.status === 'succeeded')
  const totalPaid = succeeded.reduce((s, p) => s + p.amount_usd, 0)
  const hasPending = milestones.some(m => m.status === 'pending')

  return (
    <div>
      {/* Payment summary */}
      <Card style={{ marginBottom: 16 }}>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: '#4a4846' }}>Contract value</p>
            <p className="text-sm font-bold" style={{ color: '#f0ece4' }}>${contract.value_usd.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: '#4a4846' }}>Total paid</p>
            <p className="text-sm font-bold" style={{ color: totalPaid >= contract.value_usd ? '#4ade80' : '#f0ece4' }}>
              ${totalPaid.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: '#4a4846' }}>Remaining</p>
            <p className="text-sm font-bold" style={{ color: '#f0ece4' }}>
              ${Math.max(0, contract.value_usd - totalPaid).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Milestones */}
        {milestones.length > 0 && (
          <div className="mb-4">
            {milestones.map(m => (
              <div key={m.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <span className="text-xs font-semibold" style={{ color: '#f0ece4' }}>{m.name}</span>
                  <span className="text-xs ml-2" style={{ color: '#4a4846' }}>${m.amount_usd.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5"
                    style={{
                      background: m.status === 'paid' ? '#166534' : m.status === 'skipped' ? '#374151' : 'rgba(139,0,0,0.2)',
                      color: m.status === 'paid' ? '#4ade80' : '#f0ece4',
                    }}
                  >
                    {m.status}
                  </span>
                  {isSponsor && m.status === 'pending' && (
                    <Btn onClick={() => initPay(m.id)} disabled={initiating} variant="ghost">Pay</Btn>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pay full / add milestone */}
        {isSponsor && contract.status === 'active' && (
          <div className="flex gap-2 flex-wrap">
            {!hasPending && milestones.length === 0 && (
              <Btn onClick={() => initPay()} disabled={initiating}>
                {initiating ? 'Loading…' : `Pay $${contract.value_usd.toLocaleString()}`}
              </Btn>
            )}
            <Btn onClick={() => setShowMilestoneForm(s => !s)} variant="ghost">
              {showMilestoneForm ? 'Cancel' : '+ Add Milestone'}
            </Btn>
          </div>
        )}

        {showMilestoneForm && (
          <div className="mt-4 flex gap-2 flex-wrap">
            <input value={msName} onChange={e => setMsName(e.target.value)} placeholder="Milestone name"
              className="px-3 py-2 text-sm outline-none flex-1"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0ece4', minWidth: 140 }} />
            <input value={msAmount} onChange={e => setMsAmount(e.target.value)} placeholder="Amount (USD)" type="number"
              className="px-3 py-2 text-sm outline-none w-32"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0ece4' }} />
            <input value={msDue} onChange={e => setMsDue(e.target.value)} type="date"
              className="px-3 py-2 text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0ece4' }} />
            <Btn onClick={addMs}>Add</Btn>
          </div>
        )}

        {msg && <p className="text-xs mt-3" style={{ color: '#ef4444' }}>{msg}</p>}
      </Card>

      {/* Stripe Elements checkout */}
      {clientSecret && stripePromise && (
        <Card>
          <p className="text-[10px] uppercase tracking-widest mb-4" style={{ color: '#4a4846' }}>Card Details</p>
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
            <CheckoutForm onSuccess={() => { setClientSecret(null); load() }} />
          </Elements>
        </Card>
      )}

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: '#4a4846' }}>Payment History</p>
          {payments.map(p => (
            <div key={p.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div>
                <span className="text-xs font-semibold" style={{ color: '#f0ece4' }}>${p.amount_usd.toLocaleString()}</span>
                {p.paid_at && (
                  <span className="text-xs ml-2" style={{ color: '#4a4846' }}>
                    {new Date(p.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
              </div>
              <span
                className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5"
                style={{
                  background: p.status === 'succeeded' ? '#166534' : p.status === 'failed' ? '#7f1d1d' : '#374151',
                  color: '#f0ece4',
                }}
              >
                {p.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ContractDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate  = useNavigate()

  const [contract, setContract]       = useState<Contract | null>(null)
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [loading, setLoading]         = useState(true)
  const [acting, setActing]           = useState(false)
  const [msg, setMsg]                 = useState('')
  const [proofModal, setProofModal]   = useState<string | null>(null)
  const [reviewModal, setReviewModal] = useState<string | null>(null)
  const [showTerminate, setShowTerminate] = useState(false)
  const [terminateReason, setTerminateReason] = useState('')
  const [messaging, setMessaging] = useState(false)
  const [msgError, setMsgError]   = useState('')

  useEffect(() => {
    if (!user) { navigate('/login', { replace: true }); return }
    if (!id) return
    getContract(id)
      .then(r => { setContract(r.contract); setObligations(r.obligations) })
      .catch(() => setMsg('Could not load contract.'))
      .finally(() => setLoading(false))
  }, [id, user, navigate])

  const refresh = () => {
    if (!id) return
    getContract(id).then(r => { setContract(r.contract); setObligations(r.obligations) }).catch(() => {})
  }

  const handleAccept = async () => {
    if (!id) return
    setActing(true); setMsg('')
    try {
      const r = await acceptContract(id)
      setContract(r.contract)
      refresh()
    } catch (e: any) { setMsg(e.message) }
    finally { setActing(false) }
  }

  const handleTerminate = async () => {
    if (!id) return
    setActing(true); setMsg('')
    try {
      const r = await terminateContract(id, terminateReason.trim() || undefined)
      setContract(r.contract)
      setShowTerminate(false)
    } catch (e: any) { setMsg(e.message) }
    finally { setActing(false) }
  }

  const handleStatusChange = async (obId: string, status: string) => {
    try {
      await updateObligationStatus(obId, status as any)
      refresh()
    } catch (e: any) { setMsg(e.message) }
  }

  if (!user) return null

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080808' }}>
      <Navbar />
      <div className="flex items-center justify-center" style={{ height: '80vh' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#8b0000' }} />
      </div>
    </div>
  )

  if (!contract) return (
    <div style={{ minHeight: '100vh', background: '#080808' }}>
      <Navbar />
      <div className="flex items-center justify-center" style={{ height: '80vh' }}>
        <p className="text-sm" style={{ color: '#4a4846' }}>{msg || 'Contract not found.'}</p>
      </div>
    </div>
  )

  const isSponsor = user.id === contract.sponsor_id
  const isFighter = user.id === contract.fighter_id

  const openContractConversation = async () => {
    setMessaging(true); setMsgError('')
    try {
      const otherId = isSponsor ? contract.fighter_id : contract.sponsor_id
      await createConversation(
        [otherId],
        {
          context_type: 'contract',
          context_id:   contract.id,
          subject:      `Contract — $${contract.value_usd.toLocaleString()}`,
        },
      )
      navigate('/inbox')
    } catch (e: any) {
      setMsgError(e.message ?? 'Could not open conversation.')
      setMessaging(false)
    }
  }

  const canAccept =
    (isSponsor && contract.status === 'draft' && !contract.sponsor_accepted_at) ||
    (isFighter && contract.status === 'pending_fighter' && !contract.fighter_accepted_at)

  const canTerminate = ['draft','pending_fighter','active'].includes(contract.status) && (isSponsor || isFighter)

  const completedObs  = obligations.filter(o => o.status === 'completed').length
  const progressPct   = obligations.length ? Math.round((completedObs / obligations.length) * 100) : 0

  return (
    <div style={{ minHeight: '100vh', background: '#080808' }}>
      <Navbar />

      {proofModal   && <ProofModal   obligationId={proofModal}   onDone={() => { setProofModal(null); refresh() }}   onClose={() => setProofModal(null)} />}
      {reviewModal  && <ReviewModal  obligationId={reviewModal}  onDone={() => { setReviewModal(null); refresh() }}  onClose={() => setReviewModal(null)} />}

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '100px 24px 80px' }}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span
                className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-sm"
                style={{ background: STATUS_COLOR[contract.status] ?? '#374151', color: '#f0ece4' }}
              >
                {STATUS_LABEL[contract.status] ?? contract.status}
              </span>
              <span className="text-[11px]" style={{ color: '#4a4846' }}>
                Created {new Date(contract.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <h1
              className="font-display uppercase tracking-widest"
              style={{ color: '#f0ece4', fontSize: 26, letterSpacing: '0.16em' }}
            >
              ${contract.value_usd.toLocaleString()} Contract
            </h1>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {contract.status !== 'terminated' && (
              <Btn onClick={openContractConversation} disabled={messaging || acting} variant="ghost">
                {messaging ? 'Opening…' : 'Message'}
              </Btn>
            )}
            {msgError && <p className="text-xs" style={{ color: '#ef4444' }}>{msgError}</p>}
            <Link to="/contracts" className="text-[10px] uppercase tracking-widest" style={{ color: '#4a4846', textDecoration: 'none' }}>
              ← Contracts
            </Link>
          </div>
        </div>

        {msg && <p className="text-sm mb-4" style={{ color: '#ef4444' }}>{msg}</p>}

        {/* Signature status */}
        <Section title="Signatures">
          <Card>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#4a4846' }}>Sponsor</p>
                <p className="text-sm font-semibold" style={{ color: contract.sponsor_accepted_at ? '#4ade80' : '#7a7672' }}>
                  {contract.sponsor_accepted_at
                    ? `Signed ${new Date(contract.sponsor_accepted_at).toLocaleDateString()}`
                    : 'Awaiting signature'}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#4a4846' }}>Fighter</p>
                <p className="text-sm font-semibold" style={{ color: contract.fighter_accepted_at ? '#4ade80' : '#7a7672' }}>
                  {contract.fighter_accepted_at
                    ? `Signed ${new Date(contract.fighter_accepted_at).toLocaleDateString()}`
                    : 'Awaiting signature'}
                </p>
              </div>
            </div>

            {canAccept && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-xs mb-3" style={{ color: '#7a7672' }}>
                  By clicking Accept, you agree to the terms of this contract.
                </p>
                <Btn onClick={handleAccept} disabled={acting}>
                  {acting ? 'Signing…' : 'Accept & Sign'}
                </Btn>
              </div>
            )}
          </Card>
        </Section>

        {/* Contract details */}
        <Section title="Details">
          <Card>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {[
                { label: 'Value', value: `$${contract.value_usd.toLocaleString()}` },
                { label: 'Payment', value: contract.payment_schedule },
                { label: 'Start', value: contract.start_date ? new Date(contract.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' },
                { label: 'End', value: contract.end_date ? new Date(contract.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: '#4a4846' }}>{label}</p>
                  <p className="text-sm font-semibold capitalize" style={{ color: '#f0ece4' }}>{value}</p>
                </div>
              ))}
            </div>

            {contract.terms_markdown && (
              <div className="mt-5 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: '#4a4846' }}>Terms</p>
                <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: '#b8b4ae' }}>
                  {contract.terms_markdown}
                </p>
              </div>
            )}
          </Card>
        </Section>

        {/* Obligations */}
        {obligations.length > 0 && (
          <Section title={`Obligations (${completedObs}/${obligations.length})`}>
            <div className="mb-3">
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%`, background: progressPct === 100 ? '#166534' : '#8b0000' }}
                />
              </div>
              <p className="text-[11px] mt-1.5" style={{ color: '#4a4846' }}>{progressPct}% complete</p>
            </div>
            <div className="border" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
              {obligations.map(ob => (
                <ObligationRow
                  key={ob.id}
                  ob={ob}
                  isFighter={isFighter}
                  isSponsor={isSponsor}
                  onStatusChange={handleStatusChange}
                  onProofSubmit={id => setProofModal(id)}
                  onProofReview={id => setReviewModal(id)}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Deliverables snapshot */}
        {contract.deliverables_snapshot?.length > 0 && (
          <Section title="Deliverables">
            <Card>
              <div className="flex flex-col gap-2">
                {contract.deliverables_snapshot.map((d, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5"
                      style={{ background: 'rgba(139,0,0,0.2)', color: '#C41E3A' }}
                    >
                      {d.type}
                    </span>
                    {d.count && <span className="text-xs" style={{ color: '#7a7672' }}>×{d.count}</span>}
                    {d.notes && <span className="text-xs" style={{ color: '#4a4846' }}>{d.notes}</span>}
                  </div>
                ))}
              </div>
            </Card>
          </Section>
        )}

        {/* Payments */}
        {contract.status === 'active' && (
          <Section title="Payments">
            <PaymentSection contract={contract} isSponsor={isSponsor} isFighter={isFighter} />
          </Section>
        )}

        {/* Danger zone */}
        {canTerminate && (
          <Section title="Actions">
            {!showTerminate ? (
              <Btn onClick={() => setShowTerminate(true)} variant="danger">Terminate Contract</Btn>
            ) : (
              <Card>
                <p className="text-sm mb-3" style={{ color: '#f0ece4' }}>
                  Are you sure? This cannot be undone.
                </p>
                <input
                  value={terminateReason}
                  onChange={e => setTerminateReason(e.target.value)}
                  placeholder="Reason for termination (optional)"
                  className="w-full px-4 py-3 text-sm mb-4 outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0ece4' }}
                />
                <div className="flex gap-3">
                  <Btn onClick={handleTerminate} disabled={acting} variant="danger">
                    {acting ? 'Terminating…' : 'Confirm Terminate'}
                  </Btn>
                  <Btn onClick={() => setShowTerminate(false)} variant="ghost">Cancel</Btn>
                </div>
              </Card>
            )}
          </Section>
        )}
      </div>
    </div>
  )
}
