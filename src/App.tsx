import React, { useEffect, Component, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { CartProvider } from './context/CartContext'

const HomePage              = lazy(() => import('./pages/HomePage'))
const LoginPage             = lazy(() => import('./pages/LoginPage'))
const RegisterPage          = lazy(() => import('./pages/RegisterPage'))
const VerifyEmailPage       = lazy(() => import('./pages/VerifyEmailPage'))
const PodcastPage           = lazy(() => import('./pages/PodcastPage'))
const ApparelPage           = lazy(() => import('./pages/ApparelPage'))
const TeamPage              = lazy(() => import('./pages/TeamPage'))
const FighterDashboard      = lazy(() => import('./pages/dashboards/FighterDashboard'))
const ManagerDashboard      = lazy(() => import('./pages/dashboards/ManagerDashboard'))
const AdminDashboard        = lazy(() => import('./pages/dashboards/AdminDashboard'))
const SponsorDashboard      = lazy(() => import('./pages/dashboards/SponsorDashboard'))
const SponsorOnboardPage    = lazy(() => import('./pages/sponsor/SponsorOnboardPage'))
const OpportunityFormPage   = lazy(() => import('./pages/sponsor/OpportunityFormPage'))
const SponsorOpportunitiesPage = lazy(() => import('./pages/sponsor/OpportunitiesPage'))
const ApplicantsPage        = lazy(() => import('./pages/sponsor/ApplicantsPage'))
const FighterProfileEditPage = lazy(() => import('./pages/fighter/FighterProfileEditPage'))
const MyApplicationsPage    = lazy(() => import('./pages/fighter/MyApplicationsPage'))
const DiscoveryPage         = lazy(() => import('./pages/opportunities/DiscoveryPage'))
const OpportunityDetailPage = lazy(() => import('./pages/opportunities/DetailPage'))
const InboxPage             = lazy(() => import('./pages/InboxPage'))
const ContractsListPage     = lazy(() => import('./pages/contracts/ListPage'))
const ContractDetailPage    = lazy(() => import('./pages/contracts/DetailPage'))

class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', color: '#ff4444', background: '#0d0d0d', minHeight: '100vh' }}>
          <h2 style={{ color: '#ff4444' }}>App crashed</h2>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#ccc', fontSize: 13 }}>
            {(this.state.error as Error).message}
            {'\n\n'}
            {(this.state.error as Error).stack}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

function ProtectedRoute({ children, role }: { children: React.ReactNode; role: string }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role && user.role !== 'admin') return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/"          element={<HomePage />} />
      <Route path="/login"        element={<LoginPage />} />
      <Route path="/register"     element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/podcast"   element={<PodcastPage />} />
      <Route path="/apparel"   element={<ApparelPage />} />
      <Route path="/team"      element={<TeamPage />} />
      <Route path="/dashboard/fighter" element={
        <ProtectedRoute role="fighter"><FighterDashboard /></ProtectedRoute>
      } />
      <Route path="/dashboard/manager" element={
        <ProtectedRoute role="manager"><ManagerDashboard /></ProtectedRoute>
      } />
      <Route path="/dashboard/admin" element={
        <ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>
      } />
      <Route path="/dashboard/sponsor" element={
        <ProtectedRoute role="sponsor"><SponsorDashboard /></ProtectedRoute>
      } />
      <Route path="/sponsor/onboard" element={
        <ProtectedRoute role="sponsor"><SponsorOnboardPage /></ProtectedRoute>
      } />
      <Route path="/fighter/profile" element={
        <ProtectedRoute role="fighter"><FighterProfileEditPage /></ProtectedRoute>
      } />
      <Route path="/fighter/applications" element={
        <ProtectedRoute role="fighter"><MyApplicationsPage /></ProtectedRoute>
      } />
      {/* Sponsor opportunity management */}
      <Route path="/sponsor/opportunities" element={
        <ProtectedRoute role="sponsor"><SponsorOpportunitiesPage /></ProtectedRoute>
      } />
      <Route path="/sponsor/opportunities/new" element={
        <ProtectedRoute role="sponsor"><OpportunityFormPage /></ProtectedRoute>
      } />
      <Route path="/sponsor/opportunities/:id/edit" element={
        <ProtectedRoute role="sponsor"><OpportunityFormPage /></ProtectedRoute>
      } />
      <Route path="/sponsor/opportunities/:id/applicants" element={
        <ProtectedRoute role="sponsor"><ApplicantsPage /></ProtectedRoute>
      } />
      {/* Public discovery */}
      <Route path="/opportunities" element={<DiscoveryPage />} />
      <Route path="/opportunities/:id" element={<OpportunityDetailPage />} />
      {/* Messaging */}
      <Route path="/inbox" element={<InboxPage />} />
      {/* Contracts */}
      <Route path="/contracts" element={<ContractsListPage />} />
      <Route path="/contracts/:id" element={<ContractDetailPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

const PageFallback = () => (
  <div style={{ minHeight: '100vh', background: '#080808' }} />
)

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <ScrollToTop />
            <div className="noise-overlay" />
            <Suspense fallback={<PageFallback />}>
              <AppRoutes />
            </Suspense>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
