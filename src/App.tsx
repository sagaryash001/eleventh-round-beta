import React, { useEffect, Component } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import PodcastPage from './pages/PodcastPage'
import ApparelPage from './pages/ApparelPage'
import TeamPage from './pages/TeamPage'
import RegisterPage from './pages/RegisterPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import FighterDashboard from './pages/dashboards/FighterDashboard'
import ManagerDashboard from './pages/dashboards/ManagerDashboard'
import AdminDashboard from './pages/dashboards/AdminDashboard'
import SponsorDashboard from './pages/dashboards/SponsorDashboard'
import SponsorOnboardPage from './pages/sponsor/SponsorOnboardPage'
import FighterProfileEditPage from './pages/fighter/FighterProfileEditPage'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { CartProvider } from './context/CartContext'

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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <ScrollToTop />
            <div className="noise-overlay" />
            <AppRoutes />
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
