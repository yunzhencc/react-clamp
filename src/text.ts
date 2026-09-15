export type ClampLocation = 'start' | 'middle' | 'end' | number
export type ClampBoundary = 'grapheme' | 'word'

export interface TextOptions {
  location?: ClampLocation
  boundary?: ClampBoundary
  ellipsis?: string
}
