import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

export function parseReactSource(filename: string): { source: string, tree: ts.SourceFile, elements: (ts.JsxOpeningElement | ts.JsxSelfClosingElement)[] } {
  const source = readFileSync(resolve(filename), 'utf8')
  const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const elements: (ts.JsxOpeningElement | ts.JsxSelfClosingElement)[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      elements.push(node)
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return { source, tree, elements }
}

export function elementRef(element: ts.JsxOpeningElement | ts.JsxSelfClosingElement): string | null {
  const attribute = element.attributes.properties.find(
    (part): part is ts.JsxAttribute => ts.isJsxAttribute(part) && part.name.getText() === 'ref',
  )
  if (!attribute?.initializer || !ts.isJsxExpression(attribute.initializer))
    return null
  let expression = attribute.initializer.expression
  while (expression && (ts.isAsExpression(expression) || ts.isParenthesizedExpression(expression))) {
    expression = expression.expression
  }
  return expression && ts.isIdentifier(expression) ? expression.text : null
}
