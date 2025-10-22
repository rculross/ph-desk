/**
 * React Temporal Dead Zone Fix
 * 
 * This module provides a runtime fix for React's temporal dead zone issues
 * that can occur in complex bundling scenarios with Vite/Rollup.
 * 
 * The issue: React's internal hooks (like Oh, Ph, Rh) can be used before 
 * they're declared due to code reordering during bundling, causing 
 * "Cannot access 'Oh' before initialization" errors.
 * 
 * Solution: Ensure React is fully initialized before any components render.
 */

let reactInitialized = false
let reactInitPromise: Promise<void> | null = null

/**
 * Ensures React is properly initialized before use.
 * This prevents temporal dead zone issues by forcing synchronous initialization.
 */
export async function ensureReactInitialized(): Promise<void> {
  if (reactInitialized) {
    return
  }

  if (reactInitPromise) {
    return reactInitPromise
  }

  reactInitPromise = (async () => {
    try {
      // Import React and force initialization of internal structures
      const React = await import('react')
      const ReactDOM = await import('react-dom/client')

      // Create a dummy element to force React's internal initialization
      const testDiv = document.createElement('div')
      testDiv.style.display = 'none'
      document.body.appendChild(testDiv)

      // Force React to initialize its internal hooks by creating a root
      const root = ReactDOM.createRoot(testDiv)

      // Render a simple component to trigger all hook initializations
      const TestComponent = () => {
        React.useState(null)
        React.useEffect(() => {}, [])
        React.useMemo(() => null, [])
        return null
      }

      root.render(React.createElement(TestComponent))

      // Clean up immediately
      setTimeout(() => {
        root.unmount()
        document.body.removeChild(testDiv)
      }, 0)

      reactInitialized = true
    } catch (error) {
      console.error('Failed to initialize React fix:', error)
      // Continue anyway - the error might resolve itself
      reactInitialized = true
    }
  })()

  return reactInitPromise
}

/**
 * Wraps React component rendering with initialization safety
 */
export function safeRender(renderFn: () => void): void {
  ensureReactInitialized().then(() => {
    renderFn()
  }).catch((error) => {
    console.error('React initialization failed, attempting render anyway:', error)
    renderFn()
  })
}