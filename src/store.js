import { configureStore, createSlice, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit'
import { instructionListener, setupInstructionJudge } from './instructionJudge.js'
import { isInstructionBlocked } from './Util.js'
import { MIN_PAGE_INDEX, speedUpTierForIndex } from './pageMeta.js'

const clampPageIndex = (index) => Math.max(MIN_PAGE_INDEX, index)
export const INSTRUCTION_PROGRESS_PERCENT = 3
const NAVIGATION_SCROLL_INSTRUCTION_IDS = new Set(['scroll_down', 'scroll_up'])
const TOTAL_SMOKES_STORAGE_KEY = 'phone-cigarette-total-smokes'

function loadTotalSmokes() {
  if (typeof localStorage === 'undefined') return 0
  try {
    const stored = Number.parseInt(localStorage.getItem(TOTAL_SMOKES_STORAGE_KEY) ?? '', 10)
    return Number.isInteger(stored) && stored >= 0 ? stored : 0
  } catch {
    return 0
  }
}

const feedSlice = createSlice({
  name: 'feed',
  initialState: {
    currentIndex: 0,
    scrollDirection: null,
    scrollPuffId: 0,
    titleDismissed: false,
    feedGeneration: 0,
  },
  reducers: {
    next: (s) => { s.currentIndex = clampPageIndex(s.currentIndex + 1) },
    prev: (s) => { s.currentIndex = clampPageIndex(s.currentIndex - 1) },
    setIndex: (s, { payload }) => { s.currentIndex = clampPageIndex(payload) },
    setScrollDirection: (s, { payload }) => { s.scrollDirection = payload },
    releaseScrollPuff: (s) => { s.scrollPuffId += 1 },
    dismissTitle: (s) => { s.titleDismissed = true },
    resetFeed: (s) => {
      s.currentIndex = 0
      s.scrollDirection = null
      s.scrollPuffId = 0
      s.titleDismissed = false
      s.feedGeneration += 1
    },
  },
})

function allJudgeableCompleted(session) {
  return session.instructions.every(
    (instruction, i) =>
      instruction.type.unjudgeable || session.states[i].status === 'completed',
  )
}

const levelListener = createListenerMiddleware()
const smokeListener = createListenerMiddleware()

const gameSlice = createSlice({
  name: 'game',
  initialState: {
    score: 0,
    health: 1,
    progress: 100,
    level: 1,
    gameStarted: false,
    zenMode: false,
    gameStartedAt: null,
    gameDurationMs: null,
    totalSmokes: loadTotalSmokes(),
    instructionSession: null,
    pageEngagement: {},
    speedUpHeld: false,
    commentsOpen: false,
    commentsTopBlueText: null,
    commentsScrolling: false,
    shareOpen: false,
    shareNeedsReopen: false,
  },
  reducers: {
    playerAction: () => {},
    setSpeedUpHeld: (s, { payload }) => { s.speedUpHeld = payload },
    setCommentsScrolling: (s, { payload }) => { s.commentsScrolling = payload },
    openComments: (s, { payload }) => {
      s.shareOpen = false
      s.commentsOpen = true
      const topBlueText = typeof payload === 'string' ? payload : payload?.topBlueText
      if (topBlueText !== undefined) {
        s.commentsTopBlueText = topBlueText || null
      }
    },
    closeComments: (s) => {
      s.commentsOpen = false
      s.commentsScrolling = false
    },
    openShare: (s) => {
      s.commentsOpen = false
      s.commentsScrolling = false
      s.shareOpen = true
      s.shareNeedsReopen = false
    },
    closeShare: (s) => {
      s.shareOpen = false
      s.shareNeedsReopen = false
    },
    interruptShare: (s) => {
      s.shareOpen = false
      const session = s.instructionSession
      const sendPostIndex = session?.instructions.findIndex(
        (instruction) => instruction.type.id === 'send_post',
      ) ?? -1
      const sendPostState = sendPostIndex >= 0 ? session.states[sendPostIndex] : null
      if (sendPostState?.status === 'pending') {
        sendPostState.visible = false
        sendPostState.feedback = null
        s.shareNeedsReopen = true
      } else {
        s.shareNeedsReopen = false
      }
    },
    startGame: (s, { payload }) => {
      s.gameStarted = true
      s.zenMode = payload?.zenMode ?? false
    },
    beginGameplay: (s) => {
      s.gameStartedAt = Date.now()
      s.gameDurationMs = null
    },
    togglePageEngagement: (s, { payload: { pageIndex, name } }) => {
      if (name !== 'like' && name !== 'save') return
      const field = name === 'like' ? 'liked' : 'saved'
      if (!s.pageEngagement[pageIndex]) {
        s.pageEngagement[pageIndex] = { liked: false, saved: false }
      }
      s.pageEngagement[pageIndex][field] = !s.pageEngagement[pageIndex][field]
    },
    damageHealth: (s) => {
      if (s.health <= 0) return
      s.health -= 1
      if (s.health <= 0 && s.gameStartedAt != null && s.gameDurationMs == null) {
        s.gameDurationMs = Date.now() - s.gameStartedAt
      }
      if (s.health <= 0) s.totalSmokes += 1
    },
    endGame: (s) => {
      if (s.health <= 0) return
      s.health = 0
      if (s.gameStartedAt != null && s.gameDurationMs == null) {
        s.gameDurationMs = Date.now() - s.gameStartedAt
      }
      s.totalSmokes += 1
    },
    instructionPageActive: (s, { payload: { pageIndex, instructions } }) => {
      s.instructionSession = {
        pageIndex,
        instructions,
        status: 'pending',
        states: instructions.map(() => ({
          status: 'pending',
          visible: false,
          visibleRun: 0,
          feedback: null,
        })),
      }
    },
    instructionVisible: (s, { payload: { pageIndex, instructionIndex } }) => {
      const session = s.instructionSession
      if (session?.pageIndex !== pageIndex) return
      if (isInstructionBlocked(session, instructionIndex)) return
      const state = session.states[instructionIndex]
      if (state.visible) return
      state.visible = true
      state.visibleRun = (state.visibleRun ?? 0) + 1
    },
    instructionSucceeded: (s, { payload: { instructionIndex } }) => {
      const session = s.instructionSession
      if (!session || session.status !== 'pending') return
      const state = session.states[instructionIndex]
      if (!state || state.status !== 'pending') return
      s.score += 10
      state.feedback = 'success'
    },
    instructionFailed: (s, { payload: { instructionIndices } }) => {
      const session = s.instructionSession
      if (!session || session.status !== 'pending') return
      for (const index of instructionIndices) {
        session.states[index].feedback = 'failure'
      }
    },
    clearInstructionFeedback: (s) => {
      s.instructionSession?.states.forEach((state) => {
        state.feedback = null
      })
    },
    instructionCompleted: (s, { payload: { instructionIndex } }) => {
      const session = s.instructionSession
      if (!session || session.status !== 'pending') return
      const state = session.states[instructionIndex]
      if (!state || state.status !== 'pending') return
      state.feedback = null
      state.status = 'completed'
      const instructionId = session.instructions[instructionIndex].type.id
      if (!NAVIGATION_SCROLL_INSTRUCTION_IDS.has(instructionId)) {
        s.progress = Math.max(0, s.progress - INSTRUCTION_PROGRESS_PERCENT)
      }
      if (s.progress === 0 && s.health > 0) {
        s.health = 0
        if (s.gameStartedAt != null && s.gameDurationMs == null) {
          s.gameDurationMs = Date.now() - s.gameStartedAt
        }
        s.totalSmokes += 1
      }
      if (allJudgeableCompleted(session)) {
        session.status = 'completed'
      }
    },
    setLevel: (s, { payload }) => { s.level = payload },
    startOver: (s) => {
      s.score = 0
      s.health = 1
      s.progress = 100
      s.level = 1
      s.gameStarted = false
      s.zenMode = false
      s.gameStartedAt = null
      s.gameDurationMs = null
      s.instructionSession = null
      s.pageEngagement = {}
      s.speedUpHeld = false
      s.commentsOpen = false
      s.commentsTopBlueText = null
      s.commentsScrolling = false
      s.shareOpen = false
      s.shareNeedsReopen = false
    },
  },
})

export const {
  next,
  prev,
  setIndex,
  setScrollDirection,
  releaseScrollPuff,
  dismissTitle,
  resetFeed,
} = feedSlice.actions
export const {
  playerAction,
  setSpeedUpHeld,
  setCommentsScrolling,
  openComments,
  closeComments,
  openShare,
  closeShare,
  interruptShare,
  startGame,
  beginGameplay,
  setLevel,
  startOver,
  damageHealth,
  endGame,
  togglePageEngagement,
  instructionPageActive,
  instructionVisible,
  instructionSucceeded,
  instructionFailed,
  clearInstructionFeedback,
  instructionCompleted,
} = gameSlice.actions

levelListener.startListening({
  matcher: isAnyOf(next, setIndex),
  effect: (_action, listenerApi) => {
    const { zenMode, level } = listenerApi.getState().game
    const { titleDismissed } = listenerApi.getState().feed
    if (zenMode || !titleDismissed) return

    const prevIndex = listenerApi.getOriginalState().feed.currentIndex
    const newIndex = listenerApi.getState().feed.currentIndex
    const newTier = speedUpTierForIndex(newIndex)
    const prevTier = speedUpTierForIndex(prevIndex)

    if (newTier > prevTier && newTier + 1 > level) {
      listenerApi.dispatch(setLevel(newTier + 1))
    }
  },
})

smokeListener.startListening({
  actionCreator: instructionSucceeded,
  effect: (action, listenerApi) => {
    const session = listenerApi.getState().game.instructionSession
    const state = session?.states[action.payload.instructionIndex]
    const instructionId = session?.instructions[action.payload.instructionIndex]?.type.id

    if (state?.feedback === 'success' && NAVIGATION_SCROLL_INSTRUCTION_IDS.has(instructionId)) {
      listenerApi.dispatch(releaseScrollPuff())
    }
  },
})

setupInstructionJudge({
  playerAction,
  instructionVisible,
  instructionSucceeded,
  instructionCompleted,
  instructionFailed,
  clearInstructionFeedback,
  damageHealth,
  setIndex,
  closeShare,
})

export const store = configureStore({
  reducer: {
    feed: feedSlice.reducer,
    game: gameSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(
      instructionListener.middleware,
      levelListener.middleware,
      smokeListener.middleware,
    ),
})

let persistedTotalSmokes = store.getState().game.totalSmokes
store.subscribe(() => {
  const totalSmokes = store.getState().game.totalSmokes
  if (totalSmokes === persistedTotalSmokes) return
  persistedTotalSmokes = totalSmokes
  try {
    localStorage.setItem(TOTAL_SMOKES_STORAGE_KEY, String(totalSmokes))
  } catch {
    // Keep the in-memory count when storage is unavailable.
  }
})
