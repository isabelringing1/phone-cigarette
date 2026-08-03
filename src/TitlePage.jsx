import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { isMobileDevice } from './Util.js'
import { beginGameplay, dismissTitle, startGame } from './store.js'

const PEEL_OFF_DURATION = 650
const TITLE_SPLIT_DURATION = 700

function PeelableGoldBar({ active, onPeeled }) {
  const elementRef = useRef(null)
  const peelRef = useRef(null)
  const progressRef = useRef(0)
  const animationRef = useRef(null)
  const onPeeledRef = useRef(onPeeled)

  useEffect(() => {
    onPeeledRef.current = onPeeled
  }, [onPeeled])

  useEffect(() => {
    const element = elementRef.current
    const Peel = window.Peel
    if (!element || !Peel) {
      element?.classList.add('title-page-gold-sticker--fallback')
      return undefined
    }

    const peel = new Peel(element, {
      corner: Peel.Corners.BOTTOM_LEFT,
      setPeelOnInit: false,
      backReflection: true,
      backReflectionAlpha: 0.15,
      bottomShadowDarkAlpha: 0.2,
      bottomShadowLightAlpha: 0.08,
    })
    peel.setFadeThreshold(0.98)
    peelRef.current = peel

    const setPath = () => {
      peel.setupDimensions()
      peel.setCorner(Peel.Corners.BOTTOM_LEFT)
      peel.setPeelPath(0, peel.height, peel.width * 2, peel.height)
      peel.setTimeAlongPath(progressRef.current)
    }

    setPath()
    const resizeObserver = new ResizeObserver(setPath)
    resizeObserver.observe(element)

    return () => {
      resizeObserver.disconnect()
      cancelAnimationFrame(animationRef.current)
      peel.removeEvents()
      peelRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!active) return

    const peel = peelRef.current
    cancelAnimationFrame(animationRef.current)

    if (!peel) {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const timer = window.setTimeout(
        () => onPeeledRef.current(),
        reducedMotion ? 0 : PEEL_OFF_DURATION,
      )
      return () => window.clearTimeout(timer)
    }

    const start = progressRef.current
    const startedAt = performance.now()
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const animationDuration = reducedMotion ? 0 : PEEL_OFF_DURATION

    const frame = (now) => {
      const elapsed = animationDuration ? (now - startedAt) / animationDuration : 1
      const time = Math.min(elapsed, 1)
      const eased = 1 - ((1 - time) ** 3)
      progressRef.current = start + ((1 - start) * eased)
      peel.setTimeAlongPath(progressRef.current)

      if (time < 1) {
        animationRef.current = requestAnimationFrame(frame)
      } else {
        onPeeledRef.current()
      }
    }

    animationRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animationRef.current)
  }, [active])

  return (
    <div
      ref={elementRef}
      className={`peel title-page-gold-sticker${active ? ' title-page-gold-sticker--peeling' : ''}`}
      aria-hidden="true"
    >
      <div className="peel-bottom title-page-gold-sticker-bottom" />
      <div className="peel-back title-page-gold-sticker-back" />
      <div className="peel-top title-page-gold-sticker-top" />
    </div>
  )
}

function Packaging() {
  return (
    <>
      <div className="title-page-packaging" aria-hidden="true" />
      <div className="title-page-original">Original</div>
    </>
  )
}

export default function TitlePage() {
  const dispatch = useDispatch()
  const gameStarted = useSelector((s) => s.game.gameStarted)
  const [phase, setPhase] = useState('idle')
  const finishedRef = useRef(false)
  const effectivePhase = gameStarted && phase === 'idle' ? 'peeling' : phase

  useEffect(() => {
    if (phase !== 'splitting') return undefined

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => {
      if (finishedRef.current) return
      finishedRef.current = true
      dispatch(dismissTitle())
      dispatch(beginGameplay())
    }, reducedMotion ? 0 : TITLE_SPLIT_DURATION)

    return () => window.clearTimeout(timer)
  }, [phase, dispatch])

  if (!isMobileDevice()) {
    return (
      <div className="title-page title-page--desktop">
        <p className="title-page-desktop-message">
          Phone Cigarette works on mobile phones only!
        </p>
      </div>
    )
  }

  const handleStart = () => {
    if (gameStarted || phase !== 'idle') return
    dispatch(startGame({ zenMode: true }))
  }

  return (
    <div className={`title-page title-page--${effectivePhase}`}>
      <div className="title-page-half title-page-half--top" aria-hidden="true">
        <div className="title-page-canvas">
          <Packaging />
        </div>
      </div>

      <div className="title-page-half title-page-half--bottom">
        <div className="title-page-canvas title-page-canvas--bottom">
          <Packaging />
          <div className="title-page-bottom-bar" aria-hidden="true" />

          <main className="title-page-content">
            <h1 className="title-page-heading">Phone<span style={{ fontSize: '3.9dvh' }}> </span>Cigarette</h1>
            <p className="title-page-subheading">
              Immersive simulation
              <br />
              of consuming content
            </p>

            <div className="title-page-directions">
              <strong>Directions:</strong>
              <span>Use when craving a dopamine</span>
              <span>hit of scrolling social media.</span>
            </div>

            <button
              type="button"
              className="title-page-start"
              disabled={effectivePhase !== 'idle'}
              onClick={handleStart}
            >
              Start
            </button>
          </main>
        </div>
      </div>

      <div className="title-page-gold-short" aria-hidden="true" />
      <PeelableGoldBar
        active={effectivePhase === 'peeling'}
        onPeeled={() => setPhase('splitting')}
      />
    </div>
  )
}
