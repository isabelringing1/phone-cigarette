import { useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Bookmark, Heart, MessageCircle } from 'lucide-react'
import share from '/share.png'
import { generateCaption, isIconInstructionHighlighted } from './Util.js'
import { generatePageUsername } from './usernameGenerator.js'
import { playerAction, togglePageEngagement, openComments, openShare } from './store.js'

export default function PageMenu({ index, active }) {
  const dispatch = useDispatch()
  const liked = useSelector((s) => s.game.pageEngagement[index]?.liked ?? false)
  const saved = useSelector((s) => s.game.pageEngagement[index]?.saved ?? false)
  const speedUpHeld = useSelector((s) => s.game.speedUpHeld)
  const session = useSelector((s) => s.game.instructionSession)
  const commentsOpen = useSelector((s) => s.game.commentsOpen)
  const shareOpen = useSelector((s) => s.game.shareOpen)
  const feedGeneration = useSelector((s) => s.feed.feedGeneration)
  const level = useSelector((s) => s.game.level)
  const name = useMemo(
    () => generatePageUsername(index, feedGeneration),
    [index, feedGeneration],
  )
  const caption = useMemo(() => generateCaption(level), [index, feedGeneration, level])

  const onButton = (name) => {
    if (!active) return
    dispatch(playerAction({ type: 'button', name }))
    if (name === 'like' || name === 'save') {
      dispatch(togglePageEngagement({ pageIndex: index, name }))
    }
    if (name === 'comment') {
      dispatch(openComments())//{ topBlueText: 'what is special 4th of july cheese' }
    }
    if (name === 'share') {
      dispatch(openShare())
    }
  }

  const chromeHidden = active && speedUpHeld
  const sessionMatchesPage = active && session?.pageIndex === index
  const iconHighlightContext = { commentsOpen, shareOpen }

  const highlightLike = sessionMatchesPage
    && isIconInstructionHighlighted(session, 'like', iconHighlightContext)
  const highlightComments = sessionMatchesPage
    && isIconInstructionHighlighted(session, 'comments', iconHighlightContext)
  const highlightSave = sessionMatchesPage
    && isIconInstructionHighlighted(session, 'save', iconHighlightContext)
  const highlightShare = sessionMatchesPage
    && isIconInstructionHighlighted(session, 'share', iconHighlightContext)

  return (
    <>
      <div className={`page-info${chromeHidden ? ' page-info--hidden' : ''}`}>
        <div className="page-name">{name}</div>
        <div className="page-caption">
          <span className="page-caption-text">
            {caption.phrase}
            {caption.hashtags.map((tag, i) => (
              <span key={`${tag}-${i}`} className="page-caption-hashtag"> #{tag}</span>
            ))}
          </span>
        </div>
      </div>
      <div className={`page-actions${chromeHidden ? ' page-actions--hidden' : ''}`}>
        <button
          type="button"
          className={`page-action${liked ? ' page-action--liked' : ''}${highlightLike ? ' page-action--highlight' : ''}`}
          aria-label="Like"
          onClick={() => onButton('like')}
        >
          <Heart size={28} />
        </button>
        <button
          type="button"
          className={`page-action${highlightComments ? ' page-action--highlight' : ''}`}
          aria-label="Comment"
          onClick={() => onButton('comment')}
        >
          <MessageCircle size={28} />
        </button>
        <button
          type="button"
          className={`page-action${saved ? ' page-action--saved' : ''}${highlightSave ? ' page-action--highlight' : ''}`}
          aria-label="Save"
          onClick={() => onButton('save')}
        >
          <Bookmark size={28} />
        </button>
        <button
          type="button"
          className={`page-action${highlightShare ? ' page-action--highlight' : ''}`}
          aria-label="Share"
          onClick={() => onButton('share')}
        >
          <img src={share} alt="" width={28} height={28} />
        </button>
      </div>
    </>
  )
}
