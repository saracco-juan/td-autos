import { fetchPortalModels } from '../../../features/recommendations/portalModels'
import { portalModels } from '../../../test-utils/portalModels'

it('HU06 reads the saved diagnosis through the session request, without rebuilding filters', async () => {
  const response = portalModels()
  const request = jest.fn().mockResolvedValue(response)
  await expect(fetchPortalModels(request)).resolves.toBe(response)
  expect(request).toHaveBeenCalledWith('/api/recomendaciones/modelos')
})
