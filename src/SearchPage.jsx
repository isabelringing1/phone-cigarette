import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, MoreHorizontal, Search, X } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'
import Instruction from './Instruction.jsx'
import Page from './Page.jsx'
import { closeSearch, playerAction } from './store.js'

const EXIT_MS = 50
const SWIPE_THRESHOLD_PX = 60
const RESULT_COUNT = 8

export default function SearchPage({ query }) {
  const dispatch = useDispatch()
  const currentIndex = useSelector((s) => s.feed.currentIndex)
  const session = useSelector((s) => s.game.instructionSession)
  const pageRef = useRef(null)
  const videoPageRef = useRef(null)
  const pointerStartRef = useRef(null)
  const videoPointerStartRef = useRef(null)
  const exitingRef = useRef(false)
  const [dragging, setDragging] = useState(false)
  const [video, setVideo] = useState(null)

  const sessionMatchesPage = session?.pageIndex === currentIndex
  const activeInstruction = sessionMatchesPage
    ? session.instructions
      .map((instruction, index) => ({ instruction, index, state: session.states[index] }))
      .find(({ state }) => state?.status === 'pending' && state.visible && !state.feedback)
    : null
  const videoTargetMatch = activeInstruction?.instruction.type.id.match(/^search_into_video_([0-3])$/)
  const videoTargetIndex = videoTargetMatch ? Number(videoTargetMatch[1]) : null
  const closeVideoActive = activeInstruction?.instruction.type.id === 'search_into_video_close'
  const backInstructionIndex = sessionMatchesPage
    ? session.instructions.findIndex((instruction) => instruction.type.id === 'search_back')
    : -1
  const backState = backInstructionIndex >= 0 ? session.states[backInstructionIndex] : null
  const backActive = backState?.status === 'pending' && backState.visible && !backState.feedback

  useEffect(() => {
    if (video?.phase !== 'entering') return
    const frame = requestAnimationFrame(() => {
      setVideo((current) => current?.phase === 'entering'
        ? { ...current, phase: 'opening' }
        : current)
    })
    return () => cancelAnimationFrame(frame)
  }, [video?.phase])

  const exitPage = () => {
    if (video || !backActive || exitingRef.current) return
    exitingRef.current = true
    dispatch(playerAction({ type: 'search_back' }))
    const page = pageRef.current
    if (page) {
      page.style.transition = `transform ${EXIT_MS}ms ease-out`
      page.style.transform = 'translateX(100%)'
    }
    setTimeout(() => dispatch(closeSearch()), EXIT_MS)
  }

  const openVideo = (event, resultIndex) => {
    if (video || videoTargetIndex !== resultIndex) return
    const rect = event.currentTarget.querySelector('.search-page-video')?.getBoundingClientRect()
    if (!rect) return
    setVideo({
      resultIndex,
      phase: 'entering',
      rect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      },
    })
  }

  const startClosingVideo = () => {
    if (!closeVideoActive || video?.phase !== 'open') return
    setVideo((current) => current ? { ...current, phase: 'closing' } : current)
  }

  const onVideoTransitionEnd = (event) => {
    if (event.target !== videoPageRef.current) return
    if (video?.phase === 'opening' && event.propertyName === 'width') {
      dispatch(playerAction({ type: 'search_into_video', index: video.resultIndex }))
      setVideo((current) => current ? { ...current, phase: 'open' } : current)
      return
    }
    if (video?.phase === 'closing' && event.propertyName === 'transform') {
      dispatch(playerAction({ type: 'search_into_video_close' }))
      setVideo(null)
    }
  }

  const onVideoPointerDown = (event) => {
    event.stopPropagation()
    if (!closeVideoActive || video?.phase !== 'open' || event.button !== 0) return
    videoPointerStartRef.current = { id: event.pointerId, x: event.clientX }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onVideoPointerMove = (event) => {
    event.stopPropagation()
    const start = videoPointerStartRef.current
    if (!start || start.id !== event.pointerId || video?.phase !== 'open') return
    const distance = Math.max(0, event.clientX - start.x)
    if (videoPageRef.current) {
      videoPageRef.current.style.transition = 'none'
      videoPageRef.current.style.transform = `translateX(${distance}px)`
    }
  }

  const onVideoPointerEnd = (event) => {
    event.stopPropagation()
    const start = videoPointerStartRef.current
    if (!start || start.id !== event.pointerId) return
    videoPointerStartRef.current = null
    const distance = Math.max(0, event.clientX - start.x)
    if (videoPageRef.current) {
      videoPageRef.current.style.transition = ''
      videoPageRef.current.style.transform = ''
    }
    if (distance >= SWIPE_THRESHOLD_PX) {
      startClosingVideo()
    }
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
          const isVideoTargetInstruction = /^search_into_video_[0-3]$/.test(instruction.type.id)
          const hideWhileVideoCloses = instruction.type.id === 'search_into_video_close'
            && video?.phase === 'closing'
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
              hidden={isVideoTargetInstruction || hideWhileVideoCloses}
            />
          )
        })}
      </div>

      <header className="search-page-header">
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

      <main className="search-page-results">
        {Array.from({ length: RESULT_COUNT }, (_, index) => (
          <button
            key={index}
            type="button"
            className={`search-page-result${videoTargetIndex === index ? ' search-page-result--active' : ''}`}
            onClick={(event) => openVideo(event, index)}
            aria-label={videoTargetIndex === index ? 'Watch this search result' : `Search result ${index + 1}`}
          >
            <div className="search-page-video">
              {videoTargetIndex === index && <span className="search-page-watch">Watch</span>}
            </div>
            <div className="search-page-result-copy">
              <span className="search-page-result-line" />
              <span className="search-page-result-line search-page-result-line--short" />
            </div>
          </button>
        ))}
      </main>

      {video && (
        <div
          ref={videoPageRef}
          className={`search-video-page search-video-page--${video.phase}`}
          style={video.phase === 'entering'
            ? {
              top: `${video.rect.top}px`,
              left: `${video.rect.left}px`,
              width: `${video.rect.width}px`,
              height: `${video.rect.height}px`,
            }
            : undefined}
          onTransitionEnd={onVideoTransitionEnd}
          onPointerDown={onVideoPointerDown}
          onPointerMove={onVideoPointerMove}
          onPointerUp={onVideoPointerEnd}
          onPointerCancel={onVideoPointerEnd}
        >
          <Page
            key={`${currentIndex}-${video.resultIndex}`}
            index={currentIndex * RESULT_COUNT + video.resultIndex}
            active
            presentationOnly
          />
          <button
            type="button"
            className="search-page-back search-video-back"
            onClick={(event) => {
              event.stopPropagation()
              startClosingVideo()
            }}
            aria-label="Go Back"
          >
            <ChevronLeft size={30} />
          </button>
        </div>
      )}
    </div>
  )
}
