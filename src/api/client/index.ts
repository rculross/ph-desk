/**
 * API client exports for HTTP client.
 *
 * Exports the HTTP client that provides
 * a unified interface for API interactions.
 */

// HTTP client - explicit exports to avoid conflicts
export {
  HttpClient,
  initializeHttpClient,
  getHttpClient,
  updateHttpClient,
  type HttpClientOptions
} from './http-client'

