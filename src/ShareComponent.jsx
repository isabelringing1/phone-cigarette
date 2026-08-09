import { Check } from 'lucide-react'

export default function ShareComponent({ highlighted, selected, profilePicture, onClick, buttonRef }) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={`share-component${selected ? ' share-component--selected' : ''}`}
      onClick={onClick}
      disabled={!onClick}
      aria-pressed={selected}
    >
      {highlighted && <div className="share-component-icon--highlight"></div>}
      <div className="share-component-icon" aria-hidden="true">
        {profilePicture && (
          <svg className="share-component-avatar" viewBox="0 0 24 24">
            <circle cx="12" cy="7.5" r="4.25" />
            <path d="M3.5 22c0-5.1 3.8-9 8.5-9s8.5 3.9 8.5 9H3.5Z" />
          </svg>
        )}
        {selected && (
          <>
            <span className="share-component-selected-overlay" />
            <span className="share-component-check">
              <Check />
            </span>
          </>
        )}
      </div>
      <div className="share-component-label" aria-hidden="true" />
    </button>
  )
}
