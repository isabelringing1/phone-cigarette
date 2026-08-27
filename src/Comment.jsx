const CONTENT_HEIGHTS = [3,4 , 5]

export default function Comment({ text = null, index = 0 }) {
  const contentHeight = CONTENT_HEIGHTS[index % CONTENT_HEIGHTS.length]

  return (
    <div className={`comment${text ? ' comment--real' : ''}`}>
      <div className="comment-pfp" aria-hidden="true" />
      <div className="comment-body">
        {text
          ? (
            <>
              <div className="comment-username comment-username--real">you</div>
              <div className="comment-content comment-content--real">{text}</div>
            </>
          )
          : (
            <>
              <div className="comment-username" aria-hidden="true" />
              <div
                className="comment-content"
                style={{ height: `${contentHeight}dvh` }}
                aria-hidden="true"
              />
            </>
          )}
      </div>
    </div>
  )
}
