import Bottleneck from 'bottleneck'

import { apiConfig } from './index'

/**
 * Shared Bottleneck limiter for axios-based API clients.
 *
 * Chains per-second and per-minute limiters to respect Planhat quotas.
 * All configuration values come from the unified API config.
 */
const perSecondLimiter = new Bottleneck({
  reservoir: apiConfig.rateLimit.perSecond,
  reservoirRefreshAmount: apiConfig.rateLimit.perSecond,
  reservoirRefreshInterval: apiConfig.rateLimit.perSecondRefreshInterval
})

const perMinuteLimiter = new Bottleneck({
  reservoir: apiConfig.rateLimit.perMinute,
  reservoirRefreshAmount: apiConfig.rateLimit.perMinute,
  reservoirRefreshInterval: apiConfig.rateLimit.perMinuteRefreshInterval
})

const axiosRateLimiter = new Bottleneck({
  maxConcurrent: apiConfig.rateLimit.maxConcurrent
})

axiosRateLimiter.chain(perSecondLimiter)
axiosRateLimiter.chain(perMinuteLimiter)

export { axiosRateLimiter }
export type AxiosRateLimiter = typeof axiosRateLimiter
