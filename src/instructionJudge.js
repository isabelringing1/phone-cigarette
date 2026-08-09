import { createListenerMiddleware } from '@reduxjs/toolkit'
import { instructionMatchers } from './instructionMatchers.js'
import { isScrollCommentsInstructionDone, INSTRUCTION_FADE_MS } from './Util.js'

export const instructionListener = createListenerMiddleware()

const FEEDBACK_MS = 200

const speedUpHolds = new Map()
const scrollCommentsActive = new Map()

function cancelSpeedUpHold(key) {
  const task = speedUpHolds.get(key)
  if (!task) return
  task.cancelled = true
  speedUpHolds.delete(key)
}

function getSpeedUpHoldKey(pageIndex, instructionIndex) {
  return `${pageIndex}:${instructionIndex}`
}

function getScrollCommentsKey(pageIndex, instructionIndex) {
  return `${pageIndex}:${instructionIndex}`
}

export function isSpeedUpHolding(pageIndex) {
  if (pageIndex == null) return false
  const prefix = `${pageIndex}:`
  for (const key of speedUpHolds.keys()) {
    if (key.startsWith(prefix)) return true
  }
  return false
}

function getActiveVisible(session) {
  return session.instructions
    .map((instruction, i) => ({ instruction, i, state: session.states[i] }))
    .filter(({ state }) => state.status === 'pending' && state.visible)
}

function getActiveJudgeable(session) {
  return getActiveVisible(session).filter(({ instruction }) => !instruction.type.unjudgeable)
}

function onlyUnjudgeableVisible(session) {
  const active = getActiveVisible(session)
  return active.length > 0 && active.every(({ instruction }) => instruction.type.unjudgeable)
}

export function setupInstructionJudge({
  playerAction,
  instructionVisible,
  instructionSucceeded,
  instructionCompleted,
  instructionFailed,
  clearInstructionFeedback,
  damageHealth,
  setIndex,
  closeShare,
}) {
  function completeInstruction(api, instructionIndex) {
    api.dispatch(instructionSucceeded({ instructionIndex }))
    setTimeout(() => {
      if (api.getState().game.instructionSession?.states[instructionIndex]?.feedback === 'success') {
        api.dispatch(instructionCompleted({ instructionIndex }))
      }
    }, FEEDBACK_MS)
  }

  function failInstruction(api, instructionIndices, pendingIndex) {
    const session = api.getState().game.instructionSession
    if (session) {
      for (const index of instructionIndices) {
        scrollCommentsActive.delete(getScrollCommentsKey(session.pageIndex, index))
      }
    }
    api.dispatch(instructionFailed({ instructionIndices }))
    setTimeout(() => {
      api.dispatch(damageHealth())
      api.dispatch(clearInstructionFeedback())
      if (pendingIndex !== undefined) {
        api.dispatch(setIndex(pendingIndex))
      }
    }, FEEDBACK_MS)
  }

  instructionListener.startListening({
    actionCreator: instructionVisible,
    effect: async (action, api) => {
      const { pageIndex, instructionIndex } = action.payload
      const { zenMode, instructionSession: session } = api.getState().game
      if (!session || session.pageIndex !== pageIndex) return
      const visibilityRun = session.states[instructionIndex]?.visibleRun

      const previousIndex = instructionIndex - 1
      const previousInstruction = session.instructions[previousIndex]
      const previousState = session.states[previousIndex]
      if (
        previousInstruction?.type.id === 'watch'
        && previousState?.status === 'pending'
        && previousState.visible
        && !previousState.feedback
      ) {
        api.dispatch(instructionCompleted({ instructionIndex: previousIndex }))
      }

      const instruction = session.instructions[instructionIndex]
      const timeLimit = instruction.timeLimit

      if (instruction.type.unjudgeable) {
        if (instruction.holdDurationMs) {
          await api.delay(instruction.holdDurationMs)

          while (isSpeedUpHolding(pageIndex)) {
            await api.delay(50)
          }

          const { health, instructionSession: current } = api.getState().game
          if (health <= 0) return
          if (!current || current.pageIndex !== pageIndex) return

          const state = current.states[instructionIndex]
          if (
            !state
            || state.status !== 'pending'
            || !state.visible
            || state.visibleRun !== visibilityRun
            || state.feedback
          ) return

          api.dispatch(instructionCompleted({ instructionIndex }))
        }
        return
      }

      if (zenMode) return

      if (!timeLimit) return

      await api.delay(INSTRUCTION_FADE_MS)
      await api.delay(timeLimit)

      while (isSpeedUpHolding(pageIndex)) {
        await api.delay(50)
      }

      const { health, instructionSession: current } = api.getState().game
      if (health <= 0) return
      if (!current || current.pageIndex !== pageIndex) return

      const state = current.states[instructionIndex]
      if (
        !state
        || state.status !== 'pending'
        || !state.visible
        || state.visibleRun !== visibilityRun
        || state.feedback
      ) return

      if (current.instructions[instructionIndex].type.id === 'scroll_comments') {
        const { commentsOpen, commentsScrolling } = api.getState().game
        const key = getScrollCommentsKey(pageIndex, instructionIndex)
        if (commentsOpen && (commentsScrolling || scrollCommentsActive.get(key))) {
          scrollCommentsActive.delete(key)
          completeInstruction(api, instructionIndex)
          return
        }
      }

      failInstruction(api, [instructionIndex])
    },
  })

  instructionListener.startListening({
    actionCreator: playerAction,
    effect: async (action, api) => {
      const { health, zenMode, instructionSession: session, commentsOpen } = api.getState().game
      if (health <= 0) return
      if (session?.status === 'completed') return

      if (session?.states?.some((state) => state.feedback)) return

      if (commentsOpen && action.payload.type === 'scroll') return

      if (session && isSpeedUpHolding(session.pageIndex) && action.payload.type !== 'speed_up') {
        return
      }

      if (action.payload.type === 'speed_up') {
        if (!session) return

        const speedUp = getActiveJudgeable(session).find(({ instruction }) => instruction.type.id === 'speed_up')
        if (!speedUp) return

        const { i, instruction } = speedUp
        const key = getSpeedUpHoldKey(session.pageIndex, i)
        const holdDurationMs = instruction.holdDurationMs
        if (!holdDurationMs) return

        if (action.payload.phase === 'press') {
          cancelSpeedUpHold(key)
          const task = { cancelled: false }
          speedUpHolds.set(key, task)

          await api.delay(holdDurationMs)

          const current = api.getState().game.instructionSession
          if (task.cancelled) return
          if (!current || current.pageIndex !== session.pageIndex) return

          const state = current.states[i]
          if (!state || state.status !== 'pending' || !state.visible || state.feedback) return

          speedUpHolds.delete(key)
          completeInstruction(api, i)
          return
        }

        if (action.payload.phase === 'release') {
          const hadHold = speedUpHolds.has(key)
          cancelSpeedUpHold(key)
          if (hadHold && !zenMode) {
            const state = api.getState().game.instructionSession?.states[i]
            if (state?.status === 'pending' && state.visible && !state.feedback) {
              failInstruction(api, [i])
            }
          }
        }
        return
      }

      if (action.payload.type === 'scroll_comments') {
        if (!session) return
        if (isScrollCommentsInstructionDone(session)) return

        const scrollComments = getActiveJudgeable(session).find(
          ({ instruction }) => instruction.type.id === 'scroll_comments',
        )

        if (action.payload.phase === 'scroll') {
          if (scrollComments) {
            scrollCommentsActive.set(getScrollCommentsKey(session.pageIndex, scrollComments.i), true)
          }
          return
        }

        if (action.payload.phase === 'end') {
          if (scrollComments) {
            const key = getScrollCommentsKey(session.pageIndex, scrollComments.i)
            if (scrollCommentsActive.get(key)) {
              scrollCommentsActive.delete(key)
              completeInstruction(api, scrollComments.i)
            }
          }
          return
        }

        return
      }

      if (session) {
        const judgeable = getActiveJudgeable(session)

        const fail = (instructionIndices) => {
          failInstruction(api, instructionIndices, action.payload.pendingIndex)
        }

        if (judgeable.length === 0) {
          if (!zenMode && onlyUnjudgeableVisible(session)) {
            fail(getActiveVisible(session).map(({ i }) => i))
          }
          return
        }

        const match = judgeable.find(({ instruction }) => {
          const matcher = instructionMatchers[instruction.type.id]
          return matcher?.(action.payload, instruction, { state: api.getState() })
        })

        if (match) {
          const { i, instruction } = match
          completeInstruction(api, i)
          if (instruction.type.id === 'send_post') {
            api.dispatch(closeShare())
          }
          return
        }

        if (!zenMode) {
          fail(judgeable.map(({ i }) => i))
        }
        return
      }

      if (!zenMode) {
        api.dispatch(damageHealth())
      }
    },
  })
}
