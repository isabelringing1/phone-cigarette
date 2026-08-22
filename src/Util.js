import instructionTypes from './Instructions.json'
import captions from './captions.json'
import { MIN_PAGE_INDEX, rollInstructionDuration, rollInstructionTimeMs, rollInt, rollPercent, timeScalarForIndex } from './pageMeta.js'

export const INSTRUCTION_FADE_MS = 400

export const DEBUG_INSTRUCTIONS = []//['watch', 'comments', 'scroll_comments', 'close_comments', "scroll_down"]

export function isMobileDevice() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || window.matchMedia('(hover: none) and (pointer: coarse)').matches
}

const instructionTypeById = Object.fromEntries(instructionTypes.map((type) => [type.id, type]))
const instructionTextBags = new Map()

function shuffle(items) {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function drawInstructionDisplayText(type) {
  const texts = type.display_texts
  if (!texts?.length) return type.display_text ?? ''

  const sourceKey = JSON.stringify(texts)
  let bag = instructionTextBags.get(type.id)
  if (!bag || bag.sourceKey !== sourceKey) {
    bag = { sourceKey, remaining: [], last: null }
    instructionTextBags.set(type.id, bag)
  }

  if (bag.remaining.length === 0) {
    bag.remaining = shuffle(texts)

    // Avoid an immediate repeat where one shuffled cycle meets the next.
    const nextIndex = bag.remaining.length - 1
    if (bag.remaining.length > 1 && bag.remaining[nextIndex] === bag.last) {
      const swapIndex = bag.remaining.findIndex((text) => text !== bag.last)
      ;[bag.remaining[nextIndex], bag.remaining[swapIndex]] = [
        bag.remaining[swapIndex],
        bag.remaining[nextIndex],
      ]
    }
  }

  const text = bag.remaining.pop()
  bag.last = text
  return text
}

export function anchorAlign(anchor) {
  if (anchor === 'center left') return 'left'
  if (anchor === 'center right') return 'right'
  return 'center'
}

export function hasPendingScrollUp(session) {
  if (!session) return false
  const scrollUpIndex = session.instructions.findIndex((instruction) => instruction.type.id === 'scroll_up')
  return scrollUpIndex !== -1 && session.states[scrollUpIndex].status === 'pending'
}

export function isInstructionBlocked(session, instructionIndex) {
  if (!session || instructionIndex === 0) return false
  const instruction = session.instructions[instructionIndex]
  if (instruction.type.id === 'scroll_up') {
    const scrollDownIndex = session.instructions.findIndex((item) => item.type.id === 'scroll_down')
    if (scrollDownIndex !== -1 && session.states[scrollDownIndex].status !== 'completed') {
      return true
    }
  }
  const prior = session.instructions[instructionIndex - 1]
  const priorState = session.states[instructionIndex - 1]
  return prior.type.blocking === true && priorState.status !== 'completed'
}

export function isScrollCommentsInstructionDone(session) {
  if (!session) return false
  const index = session.instructions.findIndex((instruction) => instruction.type.id === 'scroll_comments')
  if (index === -1) return false
  const state = session.states[index]
  return state?.status === 'completed' || state?.feedback === 'success'
}

const ICON_INSTRUCTION_IDS = new Set(['like', 'comments', 'share', 'save'])

export function isIconInstructionHighlighted(session, instructionId, { commentsOpen, shareOpen } = {}) {
  if (!session || !ICON_INSTRUCTION_IDS.has(instructionId)) return false
  const index = session.instructions.findIndex((instruction) => instruction.type.id === instructionId)
  if (index === -1) return false
  if (isInstructionBlocked(session, index)) return false

  const state = session.states[index]
  if (state.status !== 'pending' || !state.visible) return false
  if (instructionId === 'comments' && commentsOpen) return false
  if (instructionId === 'share' && shareOpen) return false

  return true
}

export function getSendPostTargetIndex(session) {
  if (!session) return null
  const index = session.instructions.findIndex((instruction) => instruction.type.id === 'send_post')
  if (index === -1) return null
  if (isInstructionBlocked(session, index)) return null

  const state = session.states[index]
  if (state.status !== 'pending' || !state.visible) return null

  return session.instructions[index].shareComponentIndex ?? null
}

function pickRandom(options) {
  return options[Math.floor(Math.random() * options.length)]
}

function pickRandomUnique(options, count) {
  const pool = [...options]
  const picked = []

  for (let i = 0; i < count && pool.length > 0; i++) {
    const index = Math.floor(Math.random() * pool.length)
    picked.push(pool.splice(index, 1)[0])
  }

  return picked
}

export function formatGameDuration(ms) {
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const minuteLabel = minutes === 1 ? 'minute' : 'minutes'
  const secondLabel = seconds === 1 ? 'second' : 'seconds'
  if (minutes > 0) {
    return `${minutes} ${minuteLabel} ${seconds} ${secondLabel}`
  }
  return `${seconds} ${secondLabel}`
}

function captionMatchesLevel(bounds, level) {
  const [min, max] = bounds
  if (level < min) return false
  if (max === -1) return true
  return level <= max
}

export function generateCaption(level = 1) {
  const pool = [
    ...captions.filter((caption) => !caption.level_bounds),
    ...captions.filter((caption) => caption.level_bounds && captionMatchesLevel(caption.level_bounds, level)),
  ]
  const entry = pickRandom(pool.length > 0 ? pool : captions)

  const phrase = entry.phrase.replace(/\{(\d+)\}/g, (match, indexStr) => {
    const options = entry.phrase_data[Number(indexStr)]
    return options?.length ? pickRandom(options) : match
  })

  const hashtagCount = Math.floor(Math.random() * 5)
  const hashtags = pickRandomUnique(entry.hashtags ?? [], hashtagCount)

  if (!hashtags.includes('fyp') && Math.random() < 0.75) {
    hashtags.unshift('fyp')
  }

  return { phrase, hashtags }
}

function buildInstructionIdSequence(index, generation) {
  const ids = ['watch']

  if (rollPercent(index, 'scroll-down-early', generation) < 10) {
    ids.push('scroll_down')
    return ids
  }

  if (rollPercent(index, 'think', generation) < 70) {
    ids.push('think')
  }

  if (rollPercent(index, 'speed-up-or-comments', generation) < 75) {
    ids.push('speed_up')
    if (rollPercent(index, 'comments-after-speed-up', generation) < 30) {
      ids.push('comments')
    }
  } else {
    ids.push('comments')
  }

  if (ids.includes('comments')) {
    ids.push('scroll_comments', 'close_comments')
  }

  if (rollPercent(index, 'think-2', generation) < 50) {
    ids.push('think_2')
    if (rollPercent(index, 'think-2-speed-up', generation) < 50 && !ids.includes('speed_up')) {
      ids.push('speed_up')
    }
  }

  const engagementRoll = rollInt(index, 'engagement', generation)
  if (engagementRoll <= 40) {
    ids.push('like')
  } else if (engagementRoll <= 50) {
    ids.push('save')
  } else if (engagementRoll <= 60) {
    ids.push('share', 'send_post')
  }

  if (ids[ids.length - 1] !== 'scroll_down') {
    ids.push('scroll_down')
  }
  console.log(ids)
  return ids
}

function buildRevisitInstructionIdSequence() {
  return ['watch', 'scroll_down']
}

export function generateInstructions(index, generation = 0, zenMode = false, revisit = false) {
  const scalar = zenMode ? 1 : timeScalarForIndex(index)

  const buildInstruction = (instructionType, salt, timeBounds) => {
    const holdDurationMs = instructionType.duration_bounds
      ? rollInstructionDuration(index, instructionType.duration_bounds, salt, generation)
      : undefined
    const baseTimeLimit = instructionType.time_limit != null ? instructionType.time_limit * scalar : undefined

    return {
      type: instructionType,
      timeMs: instructionType.comments_overlay || instructionType.share_overlay
        ? rollInstructionTimeMs(index, timeBounds, salt, generation)
        : rollInstructionTimeMs(index, timeBounds, salt, generation) * scalar,
      timeLimit: baseTimeLimit != null && holdDurationMs != null
        ? Math.max(baseTimeLimit, holdDurationMs + 500)
        : baseTimeLimit,
      holdDurationMs,
    }
  }

  const attachInstructionParams = (instruction, id) => {
    if (id === 'send_post') {
      instruction.shareComponentIndex = rollInt(index, 'send-post-target', generation) % 5
    }
    if (id === 'watch' && index === MIN_PAGE_INDEX && !zenMode) {
      instruction.type = { ...instruction.type, display_text: 'Follow Instructions!' }
    }
    return instruction
  }

  if (DEBUG_INSTRUCTIONS.length > 0) {
    return DEBUG_INSTRUCTIONS.map((id) => {
      const instructionType = instructionTypeById[id]
      return attachInstructionParams(buildInstruction(instructionType, id, instructionType.time_bounds), id)
    })
  }

  const ids = revisit
    ? buildRevisitInstructionIdSequence()
    : buildInstructionIdSequence(index, generation)

  return ids.map((id) => {
    const instructionType = instructionTypeById[id]
    return attachInstructionParams(buildInstruction(instructionType, id, instructionType.time_bounds), id)
  })
}
