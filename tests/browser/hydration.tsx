import { hydrateRoot } from 'react-dom/client'
import { LineClamp, RichLineClamp, WrapClamp } from '../../src'

declare global {
  interface Window {
    hydrationText: string
    hydrationKind?: 'wrap' | 'rich'
    hydrationErrors: string[]
    updateHydrated: () => void
  }
}
window.hydrationErrors = []
const root = hydrateRoot(
  document.getElementById('root')!,
  window.hydrationKind === 'rich'
    ? (
        <RichLineClamp html={window.hydrationText} maxLines={2} ellipsis="..." />
      )
    : window.hydrationKind === 'wrap'
      ? (
          <WrapClamp maxLines={2} gap={8}>
            {Array.from({ length: 8 }, (_, i) => (
              <button key={i} style={{ width: 64, height: 24, padding: 0 }}>
                Item
                {' '}
                {i}
              </button>
            ))}
          </WrapClamp>
        )
      : (
          <LineClamp text={window.hydrationText} maxLines={2} ellipsis="..." />
        ),
  {
    onRecoverableError(error) {
      window.hydrationErrors.push(String(error))
    },
  },
)
window.updateHydrated = () =>
  root.render(
    <LineClamp text="Updated after hydration" maxLines={2} ellipsis="..." />,
  )
