// Adapted from vue-clamp at 9f93dbcc31f60b02dc34fbd6a9da9bf90edc6d84; MIT.
export interface SequenceMeasurement {
  allFit: boolean
  beforeSize: Size | null
  visibleItems: number
}

export interface ClampLimits {
  clipToRootHeight: boolean
  lineLimit: number | undefined
}

export interface Size {
  height: number
  width: number
}
