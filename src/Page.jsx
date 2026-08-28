import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import PageMenu from './PageMenu.jsx'
import PageDuration from './PageDuration.jsx'
import Instructions from './Instructions.jsx'
import { generateInstructions } from './Util.js'
import { durationForIndex } from './pageMeta.js'
import { instructionPageActive, playerAction, togglePageEngagement } from './store.js'

const DOUBLE_TAP_MS = 300
const DOUBLE_TAP_DISTANCE_PX = 40
const TAP_MOVE_TOLERANCE_PX = 20

function distanceBetween(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

export default function Page({ index, active, presentationOnly = false }) {
  const dispatch = useDispatch()
  const zenMode = useSelector((s) => s.game.zenMode)
  const session = useSelector((s) => s.game.instructionSession)
  const liked = useSelector((s) => s.game.pageEngagement[index]?.liked ?? false)
  const pointerStartRef = useRef(null)
  const lastTapRef = useRef(null)
  const lastDoubleTapRef = useRef(0)
  const [likePulsing, setLikePulsing] = useState(false)
  const instructions = useMemo(
    () => presentationOnly ? [] : generateInstructions(index, zenMode),
    [index, zenMode, presentationOnly],
  )
  const duration = useMemo(
    () => durationForIndex(),
    [],
  )

  useLayoutEffect(() => {
    if (!active || presentationOnly) return
    dispatch(instructionPageActive({ pageIndex: index, instructions }))
  }, [active, index, instructions, presentationOnly, dispatch])

  const likeIsPrompted = active
    && session?.pageIndex === index
    && session.status === 'pending'
    && session.instructions.some((instruction, instructionIndex) => {
      const state = session.states[instructionIndex]
      return instruction.type.id === 'like'
        && state?.status === 'pending'
        && state.visible
        && !state.feedback
    })

  const likeFromDoubleTap = () => {
    if (!likeIsPrompted) return
    const now = performance.now()
    if (now - lastDoubleTapRef.current < DOUBLE_TAP_MS) return
    lastDoubleTapRef.current = now
    dispatch(playerAction({ type: 'button', name: 'like' }))
    if (!liked) {
      dispatch(togglePageEngagement({ pageIndex: index, name: 'like' }))
      setLikePulsing(true)
    }
  }

  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' || !event.isPrimary) return
    pointerStartRef.current = { x: event.clientX, y: event.clientY }
  }

  const onPointerUp = (event) => {
    if (event.pointerType === 'mouse' || !event.isPrimary) return
    const start = pointerStartRef.current
    pointerStartRef.current = null
    if (!start || event.target.closest('button, a, input, textarea, select')) return

    const tap = { x: event.clientX, y: event.clientY, time: performance.now() }
    if (distanceBetween(start, tap) > TAP_MOVE_TOLERANCE_PX) {
      lastTapRef.current = null
      return
    }

    const previousTap = lastTapRef.current
    lastTapRef.current = tap
    if (
      previousTap
      && tap.time - previousTap.time <= DOUBLE_TAP_MS
      && distanceBetween(previousTap, tap) <= DOUBLE_TAP_DISTANCE_PX
    ) {
      lastTapRef.current = null
      likeFromDoubleTap()
    }
  }

  return (
    <div
      className="page"
      data-active={active || undefined}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { pointerStartRef.current = null }}
      onDoubleClick={(event) => {
        if (event.target.closest('button, a, input, textarea, select')) return
        likeFromDoubleTap()
      }}
    >
      <PageMenu
        index={index}
        active={active}
        readOnly={presentationOnly}
        likePulsing={likePulsing}
        onLikeActivated={() => setLikePulsing(true)}
        onLikePulseEnd={() => setLikePulsing(false)}
      />
      {!presentationOnly && (
        <>
          <Instructions
            instructions={instructions}
            active={active}
            pageIndex={index}
          />
          <PageDuration active={active} duration={duration} />
        </>
      )}
    </div>
  )
}
