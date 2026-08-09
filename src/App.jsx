import { useEffect, useLayoutEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import Page from './Page.jsx'
import Score from './Score.jsx'
import SpeedUpNotice from './SpeedUpNotice.jsx'
import GameTimer from './GameTimer.jsx'
import GameOver from './GameOver.jsx'
import TitlePage from './TitlePage.jsx'
import CommentsPanel from './CommentsPanel.jsx'
import SharePanel from './SharePanel.jsx'
import { setIndex, setScrollDirection, playerAction, closeComments, closeShare, startGame, store } from './store.js'
import { isSpeedUpHolding } from './instructionJudge.js'
import { MIN_PAGE_INDEX } from './pageMeta.js'

const PAGES_BEFORE = 1
const PAGES_AFTER = 2
const WINDOW = PAGES_BEFORE + 1 + PAGES_AFTER

export default function App() {
  const currentIndex = useSelector((s) => s.feed.currentIndex)
  const feedGeneration = useSelector((s) => s.feed.feedGeneration)
  const gameStarted = useSelector((s) => s.game.gameStarted)
  const titleDismissed = useSelector((s) => s.feed.titleDismissed)
  const health = useSelector((s) => s.game.health)
  const zenMode = useSelector((s) => s.game.zenMode)
  const commentsOpen = useSelector((s) => s.game.commentsOpen)
  const commentsTopBlueText = useSelector((s) => s.game.commentsTopBlueText)
  const shareOpen = useSelector((s) => s.game.shareOpen)
  const dispatch = useDispatch()
  const containerRef = useRef(null)
  const ignoreScrollRef = useRef(false)
  const lastScrollTopRef = useRef(null)
  const scrollJudgedRef = useRef(false)

  useEffect(() => {
    const autostart = sessionStorage.getItem('doomscroller-autostart')
    if (!autostart) return
    sessionStorage.removeItem('doomscroller-autostart')
    dispatch(startGame({ zenMode: autostart === 'zen' }))
  }, [dispatch])

  function hadActiveJudgeable(session) {
    return session?.states?.some(
      (state, i) =>
        state.status === 'pending'
        && state.visible
        && !session.instructions[i].type.unjudgeable,
    )
  }

  function isFinalScrollVisible(session) {
    if (!session?.instructions?.length) return false
    const finalIndex = session.instructions.length - 1
    return session.instructions[finalIndex].type.id === 'scroll_down'
      && session.states[finalIndex]?.status === 'pending'
      && session.states[finalIndex].visible
  }

  function tryRevertZenScroll(el, h) {
    const { instructionSession, zenMode } = store.getState().game
    if (!zenMode || isFinalScrollVisible(instructionSession)) return false
    ignoreScrollRef.current = true
    el.scrollTop = PAGES_BEFORE * h
    lastScrollTopRef.current = el.scrollTop
    requestAnimationFrame(() => { ignoreScrollRef.current = false })
    return true
  }

  function dispatchScrollAction(direction, scrollTop, h) {
    const { instructionSession: session, commentsOpen, shareOpen, health } = store.getState().game
    if (health <= 0 || commentsOpen || shareOpen) return
    if (isSpeedUpHolding(session?.pageIndex)) return

    const slot = Math.round(scrollTop / h)
    const rawIndex = currentIndex + (slot - PAGES_BEFORE)
    const newIndex = Math.max(MIN_PAGE_INDEX, rawIndex)
    dispatch(playerAction({
      type: 'scroll',
      direction,
      pendingIndex: newIndex !== currentIndex ? newIndex : undefined,
    }))
    const el = containerRef.current
    if (el && tryRevertZenScroll(el, h)) {
      scrollJudgedRef.current = false
      return
    }
    if (hadActiveJudgeable(session) || newIndex !== currentIndex) {
      scrollJudgedRef.current = true
    }
  }

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return

    ignoreScrollRef.current = true

    if (gameStarted) {
      el.scrollTop = PAGES_BEFORE * el.clientHeight
      lastScrollTopRef.current = el.scrollTop
    } else {
      el.scrollTop = 0
      lastScrollTopRef.current = 0
    }

    dispatch(setScrollDirection(null))
    requestAnimationFrame(() => { ignoreScrollRef.current = false })
  }, [currentIndex, gameStarted, titleDismissed, dispatch])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let t

    const sync = () => {
      if (ignoreScrollRef.current || !titleDismissed) return
      const game = store.getState().game
      if (game.health <= 0 || game.commentsOpen || game.shareOpen) return
      const h = el.clientHeight
      const slot = Math.round(el.scrollTop / h)
      const rawIndex = currentIndex + (slot - PAGES_BEFORE)
      const newIndex = Math.max(MIN_PAGE_INDEX, rawIndex)

      if (rawIndex < currentIndex && newIndex === currentIndex) {
        ignoreScrollRef.current = true
        el.scrollTop = PAGES_BEFORE * h
        lastScrollTopRef.current = el.scrollTop
        const { instructionSession: session, commentsOpen, shareOpen } = store.getState().game
        if (!commentsOpen && !shareOpen && !isSpeedUpHolding(session?.pageIndex)) {
          dispatch(playerAction({ type: 'scroll', direction: 'up' }))
        }
        requestAnimationFrame(() => { ignoreScrollRef.current = false })
        return
      }

      if (newIndex !== currentIndex) {
        const session = store.getState().game.instructionSession
        if (isSpeedUpHolding(session?.pageIndex)) return

        if (!scrollJudgedRef.current) {
          dispatch(playerAction({
            type: 'scroll',
            direction: newIndex > currentIndex ? 'down' : 'up',
            pendingIndex: newIndex,
          }))
          scrollJudgedRef.current = true
          if (tryRevertZenScroll(el, h)) {
            scrollJudgedRef.current = false
            return
          }
        }
        const hasFeedback = store.getState().game.instructionSession?.states?.some((s) => s.feedback)
        if (!hasFeedback) {
          dispatch(setIndex(newIndex))
        }
      }
    }

    const onScroll = () => {
      if (ignoreScrollRef.current) return
      const game = store.getState().game
      if (game.health <= 0 || game.commentsOpen || game.shareOpen) return

      if (!gameStarted) {
        if (el.scrollTop !== 0) el.scrollTop = 0
        return
      }

      if (!titleDismissed) return

      const h = el.clientHeight
      const minScrollTop = PAGES_BEFORE * h
      if (currentIndex <= MIN_PAGE_INDEX && el.scrollTop < minScrollTop) {
        el.scrollTop = minScrollTop
        lastScrollTopRef.current = minScrollTop
        return
      }

      const scrollTop = el.scrollTop
      if (lastScrollTopRef.current !== null && scrollTop !== lastScrollTopRef.current) {
        const direction = scrollTop > lastScrollTopRef.current ? 'down' : 'up'
        dispatch(setScrollDirection(direction))
        if (!scrollJudgedRef.current) {
          dispatchScrollAction(direction, scrollTop, h)
        }
      }
      lastScrollTopRef.current = scrollTop

      clearTimeout(t)
      t = setTimeout(() => {
        sync()
        dispatch(setScrollDirection(null))
        scrollJudgedRef.current = false
      }, 80)
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      clearTimeout(t)
    }
  }, [dispatch, currentIndex, gameStarted, titleDismissed])

  useEffect(() => {
    dispatch(closeComments())
    dispatch(closeShare())
  }, [currentIndex, dispatch])

  return (
    <>
      {titleDismissed && !zenMode && <Score />}
      {titleDismissed && !zenMode && <SpeedUpNotice />}
      {titleDismissed && health > 0 && <GameTimer />}
      {titleDismissed && health <= 0 && <GameOver />}
      {titleDismissed && (
        <CommentsPanel
          isOpen={commentsOpen}
          onClose={() => dispatch(closeComments())}
          topBlueText={commentsTopBlueText}
        />
      )}
      {titleDismissed && (
        <SharePanel isOpen={shareOpen} />
      )}
      <div
        ref={containerRef}
        className={`feed${!gameStarted ? ' feed--title' : ''}${health <= 0 ? ' feed--locked' : ''}`}
      >
        {gameStarted && Array.from({ length: WINDOW }, (_, slot) => (
          <Page
            key={`${feedGeneration}-${currentIndex - PAGES_BEFORE + slot}`}
            index={currentIndex - PAGES_BEFORE + slot}
            active={titleDismissed && slot === PAGES_BEFORE}
          />
        ))}
        {!titleDismissed && <TitlePage />}
      </div>
    </>
  )
}
