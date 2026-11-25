import { getTiDbHealthStatus } from '../../utils/tidb'

export default defineEventHandler(async () => {
  return await getTiDbHealthStatus()
})
