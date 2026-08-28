export const MIN_PAGE_INDEX = 0
export const SPEED_UP_PERCENT = 0.2
export const SPEED_UP_INTERVAL = 5

export function speedUpTierForIndex(index) {
  return Math.floor(index / SPEED_UP_INTERVAL)
}

export function timeScalarForIndex(index) {
  return Math.max(0, 1 - SPEED_UP_PERCENT * speedUpTierForIndex(index))
}

export function durationForIndex() {
  return 15 + Math.random() * 45
}

export function rollInstructionTimeMs(timeBounds) {
  const [min, max] = timeBounds
  return min + Math.random() * (max - min)
}

export function rollInstructionDuration(durationBounds) {
  const [min, max] = durationBounds
  return min + Math.random() * (max - min)
}
