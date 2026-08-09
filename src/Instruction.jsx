import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { anchorAlign, INSTRUCTION_FADE_MS, isInstructionBlocked } from './Util.js'
import { instructionVisible, playerAction, setSpeedUpHeld } from './store.js'

const FADE_MS = INSTRUCTION_FADE_MS
const EXIT_FADE_MS = 200
const DEFAULT_FADE_OUT_MS = 2000

function usesSolidUntilNextFade(typeId) {
  return typeId === 'watch' || typeId === 'think' || typeId === 'think_2'
}

function usesThinkDisplayTexts(typeId) {
  return typeId === 'think' || typeId === 'think_2'
}

export default function Instruction({
  type,
  timeMs,
  timeLimit,
  active,
  pageIndex,
  instructionIndex,
  position,
  hidden = false,
}) {
  const dispatch = useDispatch()
  const session = useSelector((s) => s.game.instructionSession)
  const commentsOpen = useSelector((s) => s.game.commentsOpen)
  const commentsScrolling = useSelector((s) => s.game.commentsScrolling)
  const shareOpen = useSelector((s) => s.game.shareOpen)
  const zenMode = useSelector((s) => s.game.zenMode)
  const scrollDirection = useSelector((s) => s.feed.scrollDirection)
  const [timerReady, setTimerReady] = useState(false)
  const [runId, setRunId] = useState(0)
  const [shown, setShown] = useState(false)
  const [fadeOutActive, setFadeOutActive] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [speedUpPressed, setSpeedUpPressed] = useState(false)
  const [commentsWasOpened, setCommentsWasOpened] = useState(false)
  const [shareWasOpened, setShareWasOpened] = useState(false)
  const [thinkDisplayText, setThinkDisplayText] = useState(null)

  const sessionMatchesPage = session?.pageIndex === pageIndex
  const instructionState = sessionMatchesPage ? session.states[instructionIndex] : null
  const nextInstructionVisible = sessionMatchesPage
    && session.states[instructionIndex + 1]?.visible
  const feedback = instructionState?.feedback ?? null
  const isCompleted = instructionState?.status === 'completed'
  const blocked = sessionMatchesPage && isInstructionBlocked(session, instructionIndex)
  const overlayGated = (type.comments_overlay && !commentsOpen) || (type.share_overlay && !shareOpen)
  const commentsHandled = type.id === 'comments'
    && (commentsWasOpened || isCompleted || feedback === 'success')
  const shareHandled = type.id === 'share'
    && (shareWasOpened || isCompleted || feedback === 'success')
  const solidUntilNext = usesSolidUntilNextFade(type.id)
  const timerBlocked = (type.comments_overlay || type.share_overlay) && blocked
  const timerGateOpen = (!type.comments_overlay || commentsOpen)
    && (!type.share_overlay || shareOpen)
    && !timerBlocked
  const timerVisible = sessionMatchesPage && timerReady && !blocked && !overlayGated && !commentsHandled && !shareHandled
    && (!isCompleted || solidUntilNext)
  const displayed = sessionMatchesPage && (timerVisible || exiting) && !commentsHandled && !shareHandled
  const visible = timerVisible

  const isActiveScrollInstruction =
    (type.id === 'scroll_down' || type.id === 'scroll_up')
    && instructionState?.visible
    && instructionState?.status === 'pending'

  const isActiveScrollCommentsInstruction =
    type.id === 'scroll_comments'
    && instructionState?.visible
    && instructionState?.status === 'pending'

  const scrollDirectionMatches =
    (type.id === 'scroll_down' && scrollDirection === 'down')
    || (type.id === 'scroll_up' && scrollDirection === 'up')

  useEffect(() => {
    if (type.id === 'comments' && commentsOpen) {
      setCommentsWasOpened(true)
    }
  }, [type.id, commentsOpen])

  useEffect(() => {
    if (type.id === 'share' && shareOpen) {
      setShareWasOpened(true)
    }
  }, [type.id, shareOpen])

  useEffect(() => {
    if (!active) {
      setTimerReady(false)
      setSpeedUpPressed(false)
      setCommentsWasOpened(false)
      setShareWasOpened(false)
      dispatch(setSpeedUpHeld(false))
      return
    }
    setTimerReady(false)
    setSpeedUpPressed(false)
    setCommentsWasOpened(false)
    setShareWasOpened(false)
    setThinkDisplayText(null)
    dispatch(setSpeedUpHeld(false))
    setRunId((id) => id + 1)
  }, [active, dispatch])

  useEffect(() => {
    if (!active) return
    if (isCompleted) return
    if (!timerGateOpen) return
    const timer = setTimeout(() => setTimerReady(true), timeMs)
    return () => clearTimeout(timer)
  }, [active, runId, timeMs, timerGateOpen, isCompleted])

  useEffect(() => {
    if (!active || !visible) return
    dispatch(instructionVisible({ pageIndex, instructionIndex }))
  }, [active, visible, pageIndex, instructionIndex, dispatch])

  useEffect(() => {
    if (!visible || !usesThinkDisplayTexts(type.id) || thinkDisplayText) return
    const texts = type.display_texts
    if (!texts?.length) return
    setThinkDisplayText(texts[Math.floor(Math.random() * texts.length)])
  }, [visible, type.id, type.display_texts, thinkDisplayText])

  useEffect(() => {
    if (type.unjudgeable) return
    if (!isCompleted) {
      setExiting(false)
      return
    }
    setFadeOutActive(true)
    setExiting(true)
    dispatch(setSpeedUpHeld(false))
    const timer = setTimeout(() => {
      setFadeOutActive(false)
      setTimerReady(false)
      setShown(false)
      setExiting(false)
    }, EXIT_FADE_MS)
    return () => clearTimeout(timer)
  }, [isCompleted, type.unjudgeable, dispatch])

  useEffect(() => {
    if (solidUntilNext) return
    if (!shown || exiting) {
      setFadeOutActive(false)
      return
    }
    if (isCompleted) return
    const timer = setTimeout(() => setFadeOutActive(true), FADE_MS)
    return () => clearTimeout(timer)
  }, [solidUntilNext, shown, isCompleted, exiting, runId])

  useEffect(() => {
    if (!solidUntilNext) return
    if (!active || !shown || exiting) return
    if (!nextInstructionVisible) return

    setFadeOutActive(true)
    setExiting(true)
    const timer = setTimeout(() => {
      setFadeOutActive(false)
      setTimerReady(false)
      setShown(false)
      setExiting(false)
    }, EXIT_FADE_MS)
    return () => clearTimeout(timer)
  }, [solidUntilNext, active, shown, exiting, nextInstructionVisible])

  useEffect(() => {
    if (exiting) return
    if (!visible) {
      setShown(false)
      return
    }
    setShown(false)
    const frame = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(frame)
  }, [visible, runId, exiting])

  if (!active || !displayed) return null
  if (usesThinkDisplayTexts(type.id) && !thinkDisplayText) return null

  const displayText = usesThinkDisplayTexts(type.id) ? thinkDisplayText : type.display_text

  const isSpeedUpHolding = type.id === 'speed_up' && speedUpPressed && !feedback && !isCompleted
  const isSuccess =
    feedback === 'success'
    || isSpeedUpHolding
    || (scrollDirectionMatches && isActiveScrollInstruction)
    || (commentsScrolling && isActiveScrollCommentsInstruction)
  const timerDurationMs = timeLimit ?? DEFAULT_FADE_OUT_MS
  const showExitFade = exiting && fadeOutActive
  const showTimer = !solidUntilNext
    && !zenMode
    && fadeOutActive
    && !isSuccess
    && feedback !== 'failure'
    && !isCompleted
    && !exiting

  const feedbackClass =
    isSuccess
      ? ' instruction-text--success'
      : feedback === 'failure'
        ? ' instruction-text--failure'
        : ''

  const align = anchorAlign(position.anchor)
  const positionedBelowTarget = position.topPx != null
  const positionStyle = positionedBelowTarget
    ? { left: `${position.leftPx}px`, top: `${position.topPx}px` }
    : { left: `${position.vw}vw`, bottom: `${position.dvh}dvh` }

  const onSpeedUpPress = (event) => {
    if (!visible || speedUpPressed || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setSpeedUpPressed(true)
    dispatch(setSpeedUpHeld(true))
    dispatch(playerAction({ type: 'speed_up', phase: 'press' }))
  }

  const onSpeedUpRelease = (event) => {
    if (!speedUpPressed) return
    if (event.type === 'pointercancel' && event.buttons !== 0) return
    event.preventDefault()
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setSpeedUpPressed(false)
    dispatch(setSpeedUpHeld(false))
    dispatch(playerAction({ type: 'speed_up', phase: 'release' }))
  }

  const onSpeedUpContextMenu = (event) => {
    event.preventDefault()
    event.stopPropagation()
  }

  if (type.id === 'speed_up') {
    return (
      <div className={`instruction--speed-up${exiting ? ' instruction--speed-up-exiting' : ''}`}>
        <button
          type="button"
          className={`speed-up-gradient${speedUpPressed ? ' speed-up-gradient--pressed' : ''}${shown ? ' speed-up-gradient--shown' : ''}${exiting ? ' speed-up-gradient--exiting' : ''}`}
          onPointerDown={onSpeedUpPress}
          onPointerUp={onSpeedUpRelease}
          onPointerCancel={onSpeedUpRelease}
          onContextMenu={onSpeedUpContextMenu}
          aria-label={type.display_text}
        />

        <button
          type="button"
          className={`speed-up-gradient speed-up-left${speedUpPressed ? ' speed-up-gradient--pressed' : ''}${shown ? ' speed-up-gradient--shown' : ''}${exiting ? ' speed-up-gradient--exiting' : ''}`}
          onPointerDown={onSpeedUpPress}
          onPointerUp={onSpeedUpRelease}
          onPointerCancel={onSpeedUpRelease}
          onContextMenu={onSpeedUpContextMenu}
          aria-label={type.display_text}
        />
        
        <div
          className={`instruction instruction--anchor-${align}`}
          style={{ left: `${position.vw}vw`, bottom: `${position.dvh}dvh` }}
        >
          <span
            className={`instruction-text${feedbackClass}${shown ? ' instruction-text--shown' : ''}${showTimer ? ' instruction-text--timer' : ''}${showExitFade ? ' instruction-text--fade-out' : ''}`}
            style={showTimer
              ? { animationDuration: `${timerDurationMs}ms` }
              : showExitFade
                ? { animationDuration: `${EXIT_FADE_MS}ms` }
                : undefined}
          >
            {displayText}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`instruction instruction--anchor-${align}${positionedBelowTarget ? ' instruction--below-target' : ''}${hidden ? ' instruction--hidden' : ''} instruction-${type.id}${type.comments_overlay ? ' instruction--comments-overlay' : ''}${type.share_overlay ? ' instruction--share-overlay' : ''}`}
      style={positionStyle}
    >
      <span
        className={`instruction-text${feedbackClass}${shown ? ' instruction-text--shown' : ''}${showTimer ? ' instruction-text--timer' : ''}${showExitFade ? ' instruction-text--fade-out' : ''}`}
        style={showTimer
          ? { animationDuration: `${timerDurationMs}ms` }
          : showExitFade
            ? { animationDuration: `${EXIT_FADE_MS}ms` }
            : undefined}
      >
        {displayText}
      </span>
    </div>
  )
}
