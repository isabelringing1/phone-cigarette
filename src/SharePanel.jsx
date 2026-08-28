import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'
import ShareComponent from './ShareComponent.jsx'
import ShareInstructions from './ShareInstructions.jsx'
import shareMessages from './share.json'
import { getSendPostTargetIndex } from './Util.js'
import { interruptShare, playerAction } from './store.js'

const SLIDE_MS = 150
const TYPING_INTERVAL_MS = 20
const SHARE_COUNT = 20
const ROW_COUNT = 3

function TypingMessage({ message }) {
  const [visibleLength, setVisibleLength] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setVisibleLength((length) => {
        const nextLength = length + 1
        if (nextLength >= message.length) clearInterval(timer)
        return Math.min(nextLength, message.length)
      })
    }, TYPING_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [message])

  return message.slice(0, visibleLength)
}

export default function SharePanel({ isOpen }) {
  const dispatch = useDispatch()
  const currentIndex = useSelector((s) => s.feed.currentIndex)
  const session = useSelector((s) => s.game.instructionSession)
  const panelRef = useRef(null)
  const firstRowRef = useRef(null)
  const profileRefs = useRef([])
  const [mounted, setMounted] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [sendPostPosition, setSendPostPosition] = useState(null)
  const shareMessage = useMemo(
    () => shareMessages[Math.floor(Math.random() * shareMessages.length)],
    [currentIndex],
  )
  const rows = useMemo(
    () =>
      Array.from({ length: ROW_COUNT }, (_, rowIndex) =>
        Array.from({ length: SHARE_COUNT }, (_, itemIndex) => `${rowIndex}-${itemIndex}`),
      ),
    [],
  )
  const highlightedShareIndex = session?.pageIndex === currentIndex
    ? getSendPostTargetIndex(session)
    : null
  const instructionProfileIndex = selectedIndex ?? highlightedShareIndex

  useEffect(() => {
    if (isOpen) {
      setMounted(true)
      setSelectedIndex(null)
      setSendPostPosition(null)
      return
    }

    const timer = setTimeout(() => setMounted(false), SLIDE_MS)
    return () => clearTimeout(timer)
  }, [isOpen])

  const updateSendPostPosition = useCallback(() => {
    if (instructionProfileIndex == null) {
      setSendPostPosition(null)
      return
    }

    const profile = profileRefs.current[instructionProfileIndex]
    if (!profile) return

    const bounds = profile.getBoundingClientRect()
    const horizontalMargin = Math.min(48, window.innerWidth / 4)
    const leftPx = Math.min(
      window.innerWidth - horizontalMargin,
      Math.max(horizontalMargin, bounds.left + bounds.width / 2),
    )
    const topPx = Math.min(window.innerHeight - 48, bounds.bottom + 8)
    setSendPostPosition({ leftPx, topPx })
  }, [instructionProfileIndex])

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel || !mounted) return

    if (isOpen) {
      panel.style.transition = 'none'
      panel.style.transform = 'translateY(100%)'
      panel.getBoundingClientRect()
      panel.style.transition = `transform ${SLIDE_MS}ms ease`
      panel.style.transform = 'translateY(0)'
      return
    }

    panel.style.transition = `transform ${SLIDE_MS}ms ease`
    panel.style.transform = 'translateY(100%)'
  }, [isOpen, mounted])

  useLayoutEffect(() => {
    if (!isOpen || !mounted || instructionProfileIndex == null) return

    const row = firstRowRef.current
    const frame = requestAnimationFrame(updateSendPostPosition)
    const slideTimer = setTimeout(updateSendPostPosition, SLIDE_MS)
    row?.addEventListener('scroll', updateSendPostPosition, { passive: true })
    window.addEventListener('resize', updateSendPostPosition)

    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(slideTimer)
      row?.removeEventListener('scroll', updateSendPostPosition)
      window.removeEventListener('resize', updateSendPostPosition)
    }
  }, [isOpen, mounted, instructionProfileIndex, updateSendPostPosition])

  const handleClose = () => {
    dispatch(interruptShare())
  }

  const onShareComponentClick = (itemIndex) => {
    setSelectedIndex(itemIndex)
  }

  const handleSend = () => {
    if (selectedIndex == null) return
    dispatch(playerAction({ type: 'send_post', index: selectedIndex }))
  }

  if (!mounted) return null

  return (
    <div className="share-overlay">
      <ShareInstructions
        sendPostPosition={sendPostPosition}
        hideSendPostInstruction={selectedIndex != null}
      />
      <button
        type="button"
        className="share-dismiss-area"
        onClick={handleClose}
        aria-label="Close share menu"
      />
      <div ref={panelRef} className={`share-panel${selectedIndex != null ? ' share-panel--confirm' : ''}`}>
        <div className="share-panel-header">
          <Search size={22} className="share-search-icon" aria-hidden="true" />
          {selectedIndex == null
            ? <div className="share-title" aria-hidden="true" />
            : <div className="share-title-text">Send to</div>}
          <button type="button" className="share-close" onClick={handleClose} aria-label="Close share menu">
            <X size={22} />
          </button>
        </div>

        <div className="share-rows">
          {rows.slice(0, selectedIndex == null ? ROW_COUNT : 1).map((items, rowIndex) => (
            <div key={rowIndex} className={`share-row${rowIndex === 1 ? ' share-row--bordered' : ''}`}>
              <div ref={rowIndex === 0 ? firstRowRef : undefined} className="share-row-scroll">
                {items.map((key, itemIndex) => (
                  <ShareComponent
                    key={key}
                    buttonRef={rowIndex === 0
                      ? (node) => { profileRefs.current[itemIndex] = node }
                      : undefined}
                    highlighted={
                      rowIndex === 0
                      && selectedIndex !== highlightedShareIndex
                      && itemIndex === highlightedShareIndex
                    }
                    selected={rowIndex === 0 && itemIndex === selectedIndex}
                    profilePicture={rowIndex === 0}
                    onClick={rowIndex === 0 ? () => onShareComponentClick(itemIndex) : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        {selectedIndex != null && (
          <div className="share-compose">
            <div className="share-message-placeholder">
              <TypingMessage key={`${currentIndex}-${selectedIndex}`} message={shareMessage} />
            </div>
            <button
              type="button"
              className={`share-send-button${selectedIndex === highlightedShareIndex ? ' share-send-button--highlighted' : ''}`}
              onClick={handleSend}
            >
              Send
            </button>
          </div>
        )}
        {selectedIndex == null && <div className="share-panel-footer" />}
      </div>
    </div>
  )
}
