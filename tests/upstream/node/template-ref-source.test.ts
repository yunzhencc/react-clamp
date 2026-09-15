// React translation of upstream template-ref-source.test.ts (9f93dbcc, MIT).
// Vue compiler template refs become React useRef objects bound directly in JSX.
import { describe, expect, it } from 'vitest'
import { elementRef, parseReactSource } from './react-source.js'

describe('react render refs', () => {
  it('keeps InlineClamp on compiler template refs', () => {
    const { source, elements } = parseReactSource('src/Clamp.tsx')
    expect(elements.some(element => element.tagName.getText() === 'Tag')).toBe(true)
    expect(elements.filter(element => element.tagName.getText() === 'Tag').map(elementRef)).toEqual(['rootRef'])
    expect(source).toMatch(/const rootRef = useRef<HTMLElement[^;]+;/)
    expect(source).toMatch(/const bodyRef = useRef<HTMLSpanElement[^;]+;/)
    expect(elements.some(element => elementRef(element) === 'bodyRef')).toBe(true)
    expect(source).toMatch(/function InlineClamp\(props, ref\)\s*\{\s*return <Clamp[^>]+\binline\s*\/>/)
  })

  it('keeps multiline components render-only with direct element refs', () => {
    // LineClamp and RichLineClamp share the React renderer and its root ref.
    for (const component of ['LineClamp', 'RichLineClamp']) {
      const { source, elements } = parseReactSource('src/Clamp.tsx')
      expect(source).not.toContain('<template')
      expect(elements.filter(element => element.tagName.getText() === 'Tag').map(elementRef)).toEqual(['rootRef'])
      expect(source).not.toContain('useTemplateRef')
      expect(source).not.toContain('function setRootElement')
      expect(source).toMatch(new RegExp(`function ${component}\\(props, ref\\)\\s*\\{\\s*return <Clamp`))
      expect(source).toMatch(/export const Clamp = forwardRef/)
    }
  })
})
