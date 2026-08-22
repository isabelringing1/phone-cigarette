import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { resetFeed, startOver } from './store.js'

const COPIED_DURATION_MS = 1000

function formatBreakDuration(ms, separator = '') {
  const totalSeconds = Math.round((ms ?? 0) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m${separator}${seconds}s`
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  document.body.appendChild(textArea)
  textArea.select()
  document.execCommand('copy')
  textArea.remove()
}

export default function GameOver() {
  const dispatch = useDispatch()
  const gameDurationMs = useSelector((s) => s.game.gameDurationMs)
  const totalSmokes = useSelector((s) => s.game.totalSmokes)
  const [shareButtonText, setShareButtonText] = useState('Share')
  const copiedTimerRef = useRef(null)

  useEffect(() => () => {
    window.clearTimeout(copiedTimerRef.current)
  }, [])

  const onBack = () => {
    dispatch(startOver())
    dispatch(resetFeed())
  }

  const onShare = async () => {
    const duration = formatBreakDuration(gameDurationMs)
    const text = `My Phone Cigarette break was ${duration} 🚬`

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          text: text,
          url: window.location.href,
        })
      } catch (error) {
        if (error.name !== 'AbortError') console.error('Could not share break time', error)
      }
      return
    }

    try {
      await copyToClipboard(text)
      setShareButtonText('copied!')
      window.clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = window.setTimeout(() => {
        setShareButtonText('Share')
      }, COPIED_DURATION_MS)
    } catch (error) {
      console.error('Could not copy break time', error)
    }
  }

  const duration = formatBreakDuration(gameDurationMs, ' ')

  return (
    <div className="game-over-overlay" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
      <div className="game-over-popup">
        <h1 id="game-over-title" className="game-over-title">Smoke<span style={{ fontSize: '1.3rem' }}> </span>Break<span style={{ fontSize: '1.3rem' }}> </span>Over</h1>
       
        <p className="game-over-message">
          The time to resume normal life has arrived. Please return to Phone Cigarette as needed.
        </p>

        <p className="game-over-duration">Time: {duration}</p>
        <p className="game-over-amount">
          Total Smokes: {totalSmokes}
        </p>

        <div className="game-over-actions">
          <button type="button" className="game-over-button game-over-back" onClick={onBack}>
            Restart
          </button>
          <button type="button" className="game-over-button game-over-share" onClick={onShare}>
            {shareButtonText}
          </button>
        </div>
      </div>
    </div>
  )
}
