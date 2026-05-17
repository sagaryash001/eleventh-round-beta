import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import { AuthProvider, useAuth } from './hooks/useAuth'

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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="noise-overlay" />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
