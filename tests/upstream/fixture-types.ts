/** Type-only translation of upstream fixture callback syntax to React contracts. */
import type { CSSProperties } from 'react'
import type { WrapClampProps } from '../../src/index'

type ItemCallback<T> = NonNullable<WrapClampProps<T>['renderItem']>
export interface WrapClampItemSlotProps<T> {
  item: Parameters<ItemCallback<T>>[0]
  index: Parameters<ItemCallback<T>>[1]
}
// The fixture adapter accepts authored CSS text and converts it into a React style object.
export type FixtureWrapClampProps<T> = Omit<WrapClampProps<T>, 'style'> & {
  style?: CSSProperties | string
}
