import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../hooks/useAuth'
import Navbar from '../components/Navbar'

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>
  )
}

describe('Navbar', () => {
  it('renders without crashing', () => {
    render(<Navbar />, { wrapper: Wrapper })
  })

  it('shows a link to /login when no user is authenticated', () => {
    render(<Navbar />, { wrapper: Wrapper })
    const loginLinks = screen.getAllByRole('link').filter(
      el => el.getAttribute('href') === '/login'
    )
    expect(loginLinks.length).toBeGreaterThanOrEqual(1)
  })

  it('shows the Eleventh Round logo link', () => {
    render(<Navbar />, { wrapper: Wrapper })
    expect(screen.getByRole('link', { name: /the eleventh round/i })).toBeInTheDocument()
  })
})
