import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import RecommendationsPage from './RecommendationsPage'

describe('RecommendationsPage', () => {
  it('shows the title and the provisional text until the real recommendations arrive', () => {
    render(<RecommendationsPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Recomendaciones' })).toBeInTheDocument()
    expect(
      screen.getByText('Guardamos tu diagnóstico. Las recomendaciones van a estar disponibles pronto.'),
    ).toBeInTheDocument()
  })
})
