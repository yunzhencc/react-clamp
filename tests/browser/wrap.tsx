import type { ReactElement } from 'react'
import type { WrapClampHandle } from '../../src'
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import * as library from '../../src'

export interface WrapCase {
  count?: number
  width?: number
  itemWidth?: number
  maxLines?: number
  maxHeight?: number
  controlled?: boolean
  defaultExpanded?: boolean
  custom?: boolean
  hidden?: boolean
  noMore?: boolean
}
function Item({ index, width }: { index: number, width: number }): ReactElement {
  const [count, setCount] = useState(0)
  return (
    <button
      style={{ width, height: 24, padding: 0 }}
      onClick={() => setCount(count + 1)}
    >
      Item
      {' '}
      {index}
      :
      {' '}
      {count}
    </button>
  )
}
function Fixture({ value }: { value: WrapCase }): ReactElement {
  const [expanded, setExpanded] = useState(false)
  const Component = library.WrapClamp
  if (!Component)
    return <div>WrapClamp unavailable</div>
  return (
    <div
      id="container"
      style={{
        width: value.width ?? 240,
        display: value.hidden ? 'none' : undefined,
      }}
    >
      <Component
        ref={(handle) => {
          window.wrapHandle = handle
        }}
        maxLines={
          value.maxLines ?? (value.maxHeight === undefined ? 2 : undefined)
        }
        maxHeight={value.maxHeight}
        defaultExpanded={value.defaultExpanded}
        {...(value.controlled
          ? { expanded, onExpandedChange: setExpanded }
          : {})}
        gap={8}
        onClampChange={clamped => window.wrapEvents.push(clamped)}
        more={
          value.noMore
            ? null
            : value.custom
              ? ({ hiddenCount, expanded, toggle }) => (
                  <button
                    style={{ width: hiddenCount >= 10 ? 95 : 70, height: 24 }}
                    onClick={toggle}
                  >
                    {expanded ? 'Less' : `More ${hiddenCount}`}
                  </button>
                )
              : undefined
        }
      >
        {Array.from({ length: value.count ?? 8 }, (_, i) => (
          <Item key={i} index={i} width={value.itemWidth ?? 64} />
        ))}
      </Component>
    </div>
  )
}
const root = createRoot(document.getElementById('root')!)
declare global {
  interface Window {
    mountWrap: (value: WrapCase) => void
    wrapHandle: WrapClampHandle | null
    wrapEvents: boolean[]
  }
}
window.wrapEvents = []
window.mountWrap = value =>
  root.render(
    <StrictMode>
      <Fixture value={value} />
    </StrictMode>,
  )
