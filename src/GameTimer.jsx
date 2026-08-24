import { useSelector } from 'react-redux'
import { INSTRUCTION_PROGRESS_PERCENT } from './store.js'

const WHITE_HEIGHT_PERCENT = 72.4
const ORANGE_HEIGHT_PERCENT = 22.9
const DEFAULT_TRANSITION_MS = 600
const SMOKE_CIRCLES = [
  { driftVw: -12, riseDvh: 38.25, widthVw: 30, delayMs: 0 },
  { driftVw: 14, riseDvh: 45, widthVw: 25, delayMs: 100 },
  { driftVw: 3, riseDvh: 51.75, widthVw: 20, delayMs: 200 },
]

function seededUnit(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

function vary(base, amount, seed) {
  return base * (1 + (seededUnit(seed) * 2 - 1) * amount)
}

function smokeCircleStyle(circle, circleIndex, puffId) {
  const seed = puffId * 17 + circleIndex * 5
  const driftVw = vary(circle.driftVw, 0.15, seed + 1)
  const riseDvh = vary(circle.riseDvh, 0.075, seed + 2)
  const widthVw = vary(circle.widthVw, 0.05, seed + 3)
  const durationMs = vary(1400, 0.05, seed + 4)
  const delayMs = circle.delayMs + (seededUnit(seed + 5) * 40 - 20)

  return {
    '--smoke-drift': `${driftVw.toFixed(2)}vw`,
    '--smoke-rise': `-${riseDvh.toFixed(2)}dvh`,
    width: `${widthVw.toFixed(2)}vw`,
    animationDuration: `${Math.round(durationMs)}ms`,
    animationDelay: `${Math.max(0, Math.round(delayMs))}ms`,
  }
}

function getActiveDrain(game) {
  const { instructionSession: session, speedUpHeld } = game
  if (!session || session.status !== 'pending') return null

  const active = session.instructions
    .map((instruction, index) => ({ instruction, state: session.states[index], index }))
    .find(({ state }) =>
      state.visible
      && state.status === 'pending'
      && state.feedback !== 'failure',
    )

  if (!active) return null

  const { instruction, state, index } = active
  if (instruction.type.id === 'speed_up') {
    return (speedUpHeld || state.feedback === 'success') && instruction.holdDurationMs
      ? { durationMs: instruction.holdDurationMs }
      : null
  }

  if (instruction.type.id === 'watch') {
    const durationMs = session.instructions[index + 1]?.timeMs
    return durationMs > 0 ? { durationMs } : null
  }

  if (instruction.type.unjudgeable && instruction.holdDurationMs) {
    return { durationMs: instruction.holdDurationMs }
  }

  return null
}

export default function GameTimer() {
  const game = useSelector((s) => s.game)
  const progress = game.progress
  const scrollPuffId = useSelector((s) => s.feed.scrollPuffId)
  const activeDrain = getActiveDrain(game)
  const displayedProgress = activeDrain
    ? Math.max(0, progress - INSTRUCTION_PROGRESS_PERCENT)
    : progress
  const whiteHeight = (displayedProgress / 100) * WHITE_HEIGHT_PERCENT
  const transitionStyle = {
    '--game-timer-transition-ms': `${activeDrain?.durationMs ?? DEFAULT_TRANSITION_MS}ms`,
    '--game-timer-transition-easing': activeDrain ? 'linear' : 'ease-out',
  }

  return (
    <div
      className="game-timer"
      role="progressbar"
      aria-label="Cigarette progress remaining"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={progress}
    >
      <div className="game-timer-track" />
      <div className="game-timer-orange" />
      {scrollPuffId > 0 && (
        <div key={scrollPuffId} className="game-timer-smoke" aria-hidden="true">
          {SMOKE_CIRCLES.map((circle, index) => (
            <span
              key={index}
              style={smokeCircleStyle(circle, index, scrollPuffId)}
            />
          ))}
        </div>
      )}
      <div
        className="game-timer-white"
        style={{ ...transitionStyle, height: `${whiteHeight}%` }}
      />
      <div
        className="game-timer-red"
        style={{
          ...transitionStyle,
          bottom: `${ORANGE_HEIGHT_PERCENT + whiteHeight}%`,
        }}
      />
    </div>
  )
}
