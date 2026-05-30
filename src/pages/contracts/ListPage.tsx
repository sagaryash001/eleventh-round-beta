import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import { useAuth } from '../../hooks/useAuth'
import { getContracts, type Contract } from '../../lib/api/contracts'

const STATUS_COLOR: Record<string, string> = {
  draft:           '#4a4846',
  pending_fighter: '#b45309',
  pending_sponsor: '#b45309',
  active:          '#166534',
  in_dispute:      '#7f1d1d',
  completed:       '#1e3a5f',
  terminated:      '#374151',
  expired:         '#374151',
}

const STATUS_LABEL: Record<string, string> = {
  draft:           'Draft',
  pending_fighter: 'Awaiting Fighter',
  pending_sponsor: 'Awaiting Sponsor',
  active:          'Active',
  in_dispute:      'In Dispute',
  completed:       'Completed',
  terminated:      'Terminated',
  expired:         'Expired',
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-sm"
      style={{ background: STATUS_COLOR[status] ?? '#374151', color: '#f0ece4' }}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

export default function ContractsListPage() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    if (!user) { navigate('/login', { replace: true }); return }
    getContracts()
      .then(r => setContracts(r.contracts))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user, navigate])

  return (
    <div style={{ minHeight: '100vh', background: '#080808' }}>
      <Navbar />
      <div style={{ paddingTop: 100, maxWidth: 860, margin: '0 auto', padding: '100px 24px 60px' }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1
              className="font-display uppercase tracking-widest mb-1"
              style={{ color: '#f0ece4', fontSize: 28, letterSpacing: '0.18em' }}
            >
              Contracts
            </h1>
            <p className="text-sm" style={{ color: '#4a4846' }}>
              {user?.role === 'sponsor' ? "Agreements you've created with fighters." : 'Your active and past sponsorship agreements.'}
            </p>
          </div>
          <Link
            to={`/dashboard/${user?.role}`}
            className="text-[10px] uppercase tracking-widest"
            style={{ color: '#4a4846', textDecoration: 'none' }}
          >
            ← Dashboard
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#8b0000' }} />
          </div>
        ) : contracts.length === 0 ? (
          <div
            className="text-center py-16 border"
            style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
          >
            <p className="text-sm" style={{ color: '#4a4846' }}>No contracts yet.</p>
            {user?.role === 'sponsor' && (
              <p className="text-xs mt-2" style={{ color: '#3a3836' }}>
                Accept an application, then create a contract from it.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {contracts.map(c => (
              <Link
                key={c.id}
                to={`/contracts/${c.id}`}
                className="block no-underline p-5 border transition-colors duration-150"
                style={{
                  background:  'rgba(255,255,255,0.02)',
                  borderColor: 'rgba(255,255,255,0.06)',
                  borderLeft:  '2px solid #8b0000',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(139,0,0,0.3)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                      <StatusPill status={c.status} />
                      <span className="text-[11px]" style={{ color: '#4a4846' }}>
                        {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <p className="font-bold text-sm mb-1" style={{ color: '#f0ece4' }}>
                      ${c.value_usd.toLocaleString()} · {c.payment_schedule}
                    </p>
                    {c.start_date && c.end_date && (
                      <p className="text-xs" style={{ color: '#7a7672' }}>
                        {new Date(c.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
                        {new Date(c.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <span className="text-xs flex-shrink-0" style={{ color: '#4a4846' }}>View →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
