import { useRef, useState } from 'react'
import { ChevronLeft, MoreHorizontal, Search, X } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'
import Instruction from './Instruction.jsx'
import { closeSearch, playerAction } from './store.js'

const EXIT_MS = 50
const SWIPE_THRESHOLD_PX = 60
const RESULT_COUNT = 8

export default function SearchPage({ query }) {
  const dispatch = useDispatch()
  const currentIndex = useSelector((s) => s.feed.currentIndex)
  const session = useSelector((s) => s.game.instructionSession)
  const pageRef = useRef(null)
  const pointerStartRef = useRef(null)
  const exitingRef = useRef(false)
  const [dragging, setDragging] = useState(false)

  const sessionMatchesPage = session?.pageIndex === currentIndex
  const backInstructionIndex = sessionMatchesPage
    ? session.instructions.findIndex((instruction) => instruction.type.id === 'search_back')
    : -1
  const backState = backInstructionIndex >= 0 ? session.states[backInstructionIndex] : null
  const backActive = backState?.status === 'pending' && backState.visible && !backState.feedback

  const exitPage = () => {
    if (!backActive || exitingRef.current) return
    exitingRef.current = true
    dispatch(playerAction({ type: 'search_back' }))
    const page = pageRef.current
    if (page) {
      page.style.transition = `transform ${EXIT_MS}ms ease-out`
      page.style.transform = 'translateX(100%)'
    }
    setTimeout(() => dispatch(closeSearch()), EXIT_MS)
  }

  const onPointerDown = (event) => {
    if (!backActive || exitingRef.current || event.button !== 0) return
    pointerStartRef.current = { id: event.pointerId, x: event.clientX }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  const onPointerMove = (event) => {
    const start = pointerStartRef.current
    if (!start || start.id !== event.pointerId || exitingRef.current) return
    const distance = Math.max(0, event.clientX - start.x)
    if (pageRef.current) {
      pageRef.current.style.transition = 'none'
      pageRef.current.style.transform = `translateX(${distance}px)`
    }
  }

  const onPointerEnd = (event) => {
    const start = pointerStartRef.current
    if (!start || start.id !== event.pointerId) return
    pointerStartRef.current = null
    setDragging(false)
    const distance = Math.max(0, event.clientX - start.x)
    if (distance >= SWIPE_THRESHOLD_PX) {
      exitPage()
      return
    }
    if (pageRef.current) {
      pageRef.current.style.transition = 'transform 120ms ease-out'
      pageRef.current.style.transform = 'translateX(0)'
    }
  }

  return (
    <div
      ref={pageRef}
      className={`search-page${dragging ? ' search-page--dragging' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <div className="search-page-instructions">
        {sessionMatchesPage && session.instructions.map((instruction, instructionIndex) => {
          if (!instruction.type.search_overlay) return null
          return (
            <Instruction
              key={`${currentIndex}-${instruction.type.id}-${instructionIndex}`}
              type={instruction.type}
              timeMs={instruction.timeMs}
              timeLimit={instruction.timeLimit}
              active
              pageIndex={currentIndex}
              instructionIndex={instructionIndex}
              position={instruction.type.position}
            />
          )
        })}
      </div>

      <header className={`search-page-header${backActive ? ' search-page-header--back-prompt' : ''}`}>
        <button type="button" className="search-page-back" onClick={exitPage} aria-label="Go Back">
          <ChevronLeft size={30} />
        </button>
        <div className="search-page-query">
          <Search size={22} aria-hidden="true" />
          <span>{query}</span>
          <X size={18} className="search-page-query-clear" aria-hidden="true" />
        </div>
        <MoreHorizontal size={26} className="search-page-more" aria-hidden="true" />
      </header>

      <div className="search-page-tabs" aria-hidden="true">
        {Array.from({ length: 7 }, (_, index) => (
          <span key={index} className={`search-page-tab search-page-tab--${index}`} />
        ))}
      </div>

      <main className="search-page-results" aria-hidden="true">
        {Array.from({ length: RESULT_COUNT }, (_, index) => (
          <div key={index} className="search-page-result">
            <div className="search-page-video" />
            <div className="search-page-result-copy">
              <span className="search-page-result-line" />
              <span className="search-page-result-line search-page-result-line--short" />
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}
