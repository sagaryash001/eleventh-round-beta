import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../hooks/useAuth'
import LoginPage from '../pages/LoginPage'

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>
  )
}

describe('LoginPage', () => {
  it('renders without crashing', () => {
    render(<LoginPage />, { wrapper: Wrapper })
  })

  it('shows the Sign In heading', () => {
    render(<LoginPage />, { wrapper: Wrapper })
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument()
  })

  it('renders an email input', () => {
    render(<LoginPage />, { wrapper: Wrapper })
    expect(screen.getByPlaceholderText(/you@example\.com/i)).toBeInTheDocument()
  })

  it('renders a password input', () => {
    render(<LoginPage />, { wrapper: Wrapper })
    const pwInput = document.querySelector('input[type="password"]')
    expect(pwInput).toBeInTheDocument()
  })

  it('renders a submit button', () => {
    render(<LoginPage />, { wrapper: Wrapper })
    expect(screen.getByRole('button', { name: /access dashboard/i })).toBeInTheDocument()
  })

  it('shows a link to the register page', () => {
    render(<LoginPage />, { wrapper: Wrapper })
    expect(screen.getByRole('link', { name: /create one/i })).toBeInTheDocument()
  })
})
