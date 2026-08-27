import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, AtSign, Image, ListFilter, Search, Smile, X } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'
import Comment from './Comment.jsx'
import CommentsInstructions from './CommentsInstructions.jsx'
import { isScrollCommentsInstructionDone } from './Util.js'
import { playerAction, setCommentsScrolling } from './store.js'

const SLIDE_MS = 150
const KEYBOARD_SLIDE_MS = 220
const TYPING_DELAY_MS = 200
const TYPING_INTERVAL_MS = 20
const COMMENT_COUNT = 60
const COMMENTS_SCROLL_END_MS = 80

const KEYBOARD_ROWS = [
  Array.from({ length: 10 }),
  Array.from({ length: 9 }),
  Array.from({ length: 9 }),
  Array.from({ length: 3 }),
]

function PseudoKeyboard() {
  return (
    <div className="comments-keyboard" aria-hidden="true">
      {KEYBOARD_ROWS.map((keys, rowIndex) => (
        <div key={rowIndex} className={`comments-keyboard-row comments-keyboard-row--${rowIndex}`}>
          {keys.map((_, keyIndex) => (
            <button
              key={keyIndex}
              type="button"
              tabIndex={-1}
              className={`comments-keyboard-key${rowIndex === 3 && keyIndex === 1 ? ' comments-keyboard-key--space' : ''}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export default function CommentsPanel({ isOpen, onClose, onSearch, topBlueText = null }) {
  const dispatch = useDispatch()
  const currentIndex = useSelector((s) => s.feed.currentIndex)
  const session = useSelector((s) => s.game.instructionSession)
  const suggestedComment = useSelector((s) => s.game.commentsSuggestedComment)
  const panelRef = useRef(null)
  const listRef = useRef(null)
  const scrollEndTimerRef = useRef(null)
  const postCommentTimerRef = useRef(null)
  const ignoreCommentsScrollRef = useRef(false)
  const [mounted, setMounted] = useState(false)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [visibleCommentLength, setVisibleCommentLength] = useState(0)
  const [submittedComment, setSubmittedComment] = useState(null)
  const comments = useMemo(
    () => Array.from({ length: COMMENT_COUNT }, (_, index) => index),
    [],
  )
  const showSearch = Boolean(topBlueText)
  const searchInstructionIndex = session?.instructions.findIndex(
    (instruction) => instruction.type.id === 'search',
  ) ?? -1
  const searchInstructionState = searchInstructionIndex >= 0
    ? session?.states[searchInstructionIndex]
    : null
  const searchActive = searchInstructionState?.status === 'pending'
    && searchInstructionState.visible
    && !searchInstructionState.feedback
  const commentInstructionIndex = session?.instructions.findIndex(
    (instruction) => instruction.type.id === 'comment',
  ) ?? -1
  const commentInstructionState = commentInstructionIndex >= 0
    ? session?.states[commentInstructionIndex]
    : null
  const commentActive = session?.pageIndex === currentIndex
    && commentInstructionState?.status === 'pending'
    && commentInstructionState.visible
    && !commentInstructionState.feedback
  const visibleComment = suggestedComment.slice(0, visibleCommentLength)

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setMounted(true)
        setKeyboardOpen(false)
        setVisibleCommentLength(0)
        setSubmittedComment(null)
      }, 0)
      return () => clearTimeout(timer)
    }

    clearTimeout(postCommentTimerRef.current)
    const resetTimer = setTimeout(() => setKeyboardOpen(false), 0)
    const unmountTimer = setTimeout(() => setMounted(false), SLIDE_MS)
    return () => {
      clearTimeout(resetTimer)
      clearTimeout(unmountTimer)
    }
  }, [isOpen])

  useEffect(() => {
    if (!keyboardOpen || !suggestedComment) return

    let typingTimer
    const delayTimer = setTimeout(() => {
      typingTimer = setInterval(() => {
        setVisibleCommentLength((length) => {
          const nextLength = length + 1
          if (nextLength >= suggestedComment.length) clearInterval(typingTimer)
          return Math.min(nextLength, suggestedComment.length)
        })
      }, TYPING_INTERVAL_MS)
    }, TYPING_DELAY_MS)

    return () => {
      clearTimeout(delayTimer)
      clearInterval(typingTimer)
    }
  }, [keyboardOpen, suggestedComment])

  useEffect(() => {
    if (commentActive) return
    const timer = setTimeout(() => setKeyboardOpen(false), 0)
    return () => clearTimeout(timer)
  }, [commentActive])

  useEffect(() => () => clearTimeout(postCommentTimerRef.current), [])

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

  useEffect(() => {
    const sessionMatchesPage = session?.pageIndex === currentIndex
    const done = sessionMatchesPage && isScrollCommentsInstructionDone(session)
    ignoreCommentsScrollRef.current = done

    if (done) {
      clearTimeout(scrollEndTimerRef.current)
      dispatch(setCommentsScrolling(false))
    }
  }, [session, currentIndex, dispatch])

  useEffect(() => {
    const list = listRef.current
    if (!list || !isOpen) return

    const onScroll = () => {
      if (ignoreCommentsScrollRef.current) return

      dispatch(setCommentsScrolling(true))
      dispatch(playerAction({ type: 'scroll_comments', phase: 'scroll' }))
      clearTimeout(scrollEndTimerRef.current)
      scrollEndTimerRef.current = setTimeout(() => {
        if (ignoreCommentsScrollRef.current) return
        dispatch(playerAction({ type: 'scroll_comments', phase: 'end' }))
        dispatch(setCommentsScrolling(false))
      }, COMMENTS_SCROLL_END_MS)
    }

    list.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      list.removeEventListener('scroll', onScroll)
      clearTimeout(scrollEndTimerRef.current)
    }
  }, [isOpen, mounted, dispatch])

  const handleClose = () => {
    dispatch(playerAction({ type: 'close_comments' }))
    onClose()
  }

  const handleSearch = () => {
    if (!searchActive) return
    dispatch(playerAction({ type: 'search' }))
    onSearch()
  }

  const handleCommentField = () => {
    if (!commentActive || keyboardOpen) return
    setVisibleCommentLength(0)
    setKeyboardOpen(true)
  }

  const handleSubmitComment = () => {
    if (!commentActive || !keyboardOpen) return
    setKeyboardOpen(false)
    setVisibleCommentLength(suggestedComment.length)
    dispatch(playerAction({ type: 'comment' }))
    clearTimeout(postCommentTimerRef.current)
    postCommentTimerRef.current = setTimeout(() => {
      setSubmittedComment(suggestedComment)
    }, KEYBOARD_SLIDE_MS)
  }

  if (!mounted) return null

  return (
    <div className={`comments-overlay${keyboardOpen ? ' comments-overlay--keyboard-open' : ''}`}>
      <CommentsInstructions />
      <button
        type="button"
        className="comments-dismiss-area"
        onClick={handleClose}
        aria-label="Close comments"
      />
      <div ref={panelRef} className="comments-panel">
        <div className="comments-panel-header">
          {showSearch && (
            <div className="comments-search">
              <span className="comments-search-label">Search: </span>
              <button
                type="button"
                className={"comments-search-query " + (searchActive ? "comments-search-query-active" : "")}
                onClick={handleSearch}
                disabled={!searchActive}
              >
                {topBlueText}
              </button>
              <Search size={12} className="comments-search-icon" aria-hidden="true" />
            </div>
          )}
          <div className="comments-title-row">
            <div className="comments-title" aria-hidden="true" />
            <ListFilter size={18} className="comments-sort-icon" aria-hidden="true" />
            <button type="button" className="comments-close" onClick={handleClose} aria-label="Close comments">
              <X size={22} />
            </button>
          </div>
        </div>

        <div ref={listRef} className="comments-list">
          {submittedComment && <Comment text={submittedComment} />}
          {comments.map((index) => (
            <Comment key={index} index={index} />
          ))}
        </div>

        <div className={`comments-input-bar${commentActive ? ' comments-input-bar--active' : ''}${keyboardOpen ? ' comments-input-bar--ready-to-submit' : ''}`}>
          <div className="comments-input-pfp" aria-hidden="true" />
          <button
            type="button"
            className="comments-input-field"
            onClick={handleCommentField}
            disabled={!commentActive}
            aria-label="Write a comment"
          >
            <span className="comments-input-placeholder">{keyboardOpen ? visibleComment : ''}</span>
            {!keyboardOpen && (
              <span className="comments-input-actions">
                <Image size={20} aria-hidden="true" />
                <Smile size={20} aria-hidden="true" />
                <AtSign size={20} aria-hidden="true" />
              </span>
            )}
          </button>
          {keyboardOpen && (
            <button
              type="button"
              className="comments-submit"
              onClick={handleSubmitComment}
              aria-label="Post comment"
            >
              <ArrowUp size={22} />
            </button>
          )}
        </div>
        <PseudoKeyboard />
      </div>
    </div>
  )
}
