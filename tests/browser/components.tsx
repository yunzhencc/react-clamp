import { createRoot } from 'react-dom/client'
import * as ReactLibrary from '../../src'

export interface ComponentCase {
  predictive?: boolean
  count?: number
  kind?: 'line' | 'inline' | 'wrap' | 'rich'
  text?: string
  html?: string
  width?: number
  maxLines?: number
  maxHeight?: number | string
  location?: 'start' | 'middle' | 'end' | number
  boundary?: 'word' | 'grapheme'
  ellipsis?: string
  as?: string
  affixes?: boolean
}
const root = createRoot(document.getElementById('react')!)
declare global {
  interface Window {
    mountComponent: (value: ComponentCase) => void
  }
}
window.mountComponent = async ({
  predictive,
  count = 20,
  kind = 'line',
  width = 240,
  affixes,
  ...props
}) => {
  const style = `width:${width}px;font:16px/24px Arial;`
  document.getElementById('react')!.setAttribute('style', style)
  const names = {
    line: 'LineClamp',
    inline: 'InlineClamp',
    wrap: 'WrapClamp',
    rich: 'RichLineClamp',
  } as const
  const tags = Array.from({ length: count }, (_, i) => ({
    id: i,
    label: `Tag ${i}`,
  }))
  const R = predictive
    ? (await import('../../src/pretext')).LineClamp
    : (ReactLibrary[
        names[kind] as keyof typeof ReactLibrary
      ] as React.ElementType)
  if (!R) {
    root.render(
      <div>
        Missing
        {names[kind]}
      </div>,
    )
    return
  }
  const before = affixes ? <span>Prefix </span> : undefined
  const after = affixes
    ? (
        <button type="button" style={{ font: 'inherit', padding: 0, border: 0 }}>
          More
        </button>
      )
    : undefined
  root.render(
    kind === 'wrap'
      ? (
          <R
            {...props}
            gap={0}
            items={tags}
            itemKey="id"
            renderItem={(item: (typeof tags)[number]) => (
              <span style={{ display: 'inline-block', width: 64, height: 24 }}>
                {item.label}
              </span>
            )}
            before={before}
            after={
              affixes
                ? ({ hiddenItems }: { hiddenItems: typeof tags }) => (
                    <span
                      style={{ display: 'inline-block', width: 48, height: 24 }}
                    >
                      +
                      {hiddenItems.length}
                    </span>
                  )
                : undefined
            }
          />
        )
      : (
          <R {...props} before={before} after={after} />
        ),
  )
}
