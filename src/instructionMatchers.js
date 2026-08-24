export const instructionMatchers = {
  scroll_down: (action, instruction) =>
    action.type === 'scroll' &&
    action.direction === (instruction.type.params?.direction ?? 'down'),

  scroll_up: (action) =>
    action.type === 'scroll' && action.direction === 'up',

  like: (action) =>
    action.type === 'button' && action.name === 'like',

  share: (action) =>
    action.type === 'button' && action.name === 'share',

  comment: (action) =>
    action.type === 'button' && action.name === 'comment',

  comments: (action) =>
    action.type === 'button' && action.name === 'comment',

  close_comments: (action) =>
    action.type === 'close_comments',

  scroll_comments: (action) =>
    action.type === 'scroll_comments' && action.phase === 'end',

  search: (action) =>
    action.type === 'search',

  search_back: (action) =>
    action.type === 'search_back',

  save: (action) =>
    action.type === 'button' && action.name === 'save',

  send_post: (action, instruction) =>
    action.type === 'send_post' && action.index === instruction.shareComponentIndex,
}
