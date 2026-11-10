import { fetchRecommendations } from '../../../features/recommendations/api'

describe('recommendations api', () => {
  it('HU05 reads the signed-in user ranking through the session request, without identity or filters', async () => {
    const response = { status: 'ready', results: [], exchange_rate: null }
    const request = jest.fn().mockResolvedValue(response)

    await expect(fetchRecommendations(request)).resolves.toBe(response)
    expect(request).toHaveBeenCalledWith('/api/recomendaciones')
  })
})
