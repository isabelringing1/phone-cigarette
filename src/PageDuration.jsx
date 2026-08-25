import { useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'

export default function PageDuration({ active, duration }) {
  const speedUpHeld = useSelector((s) => s.game.speedUpHeld)
  const barRef = useRef(null)
  const progressRef = useRef(0)
  const lastTimeRef = useRef(null)
  const speedUpHeldRef = useRef(speedUpHeld)

  speedUpHeldRef.current = speedUpHeld

  useEffect(() => {
    if (!active) {
      progressRef.current = 0
      if (barRef.current) barRef.current.style.width = '0%'
      return
    }

    progressRef.current = 0
    lastTimeRef.current = performance.now()
    if (barRef.current) barRef.current.style.width = '0%'

    let rafId
    const tick = (now) => {
      const dt = (now - lastTimeRef.current) / 1000
      lastTimeRef.current = now
      const rate = speedUpHeldRef.current ? 2.5 : 1
      progressRef.current += (dt * rate) / duration
      if (progressRef.current >= 1) {
        progressRef.current %= 1
      }
      if (barRef.current) {
        barRef.current.style.width = `${progressRef.current * 100}%`
      }
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [active, duration])

  return (
    <div className="page-duration">
      {active && <div ref={barRef} className="page-duration-bar" />}
    </div>
  )
}
