import { useSelector } from 'react-redux'
import Instruction from './Instruction.jsx'

export default function ShareInstructions({ sendPostPosition, hideSendPostInstruction }) {
  const shareOpen = useSelector((s) => s.game.shareOpen)
  const currentIndex = useSelector((s) => s.feed.currentIndex)
  const session = useSelector((s) => s.game.instructionSession)

  if (!shareOpen || !session || session.pageIndex !== currentIndex) return null

  const hasOverlayInstructions = session.instructions.some(
    (instruction) => instruction.type.share_overlay,
  )
  if (!hasOverlayInstructions) return null

  return (
    <div className="share-instructions-layer">
      {session.instructions.map((instruction, instructionIndex) => {
        if (!instruction.type.share_overlay) return null

        return (
          <Instruction
            key={`${currentIndex}-${instruction.type.id}-${instructionIndex}`}
            type={instruction.type}
            timeMs={instruction.timeMs}
            timeLimit={instruction.timeLimit}
            active
            pageIndex={currentIndex}
            instructionIndex={instructionIndex}
            position={instruction.type.id === 'send_post' && sendPostPosition
              ? sendPostPosition
              : instruction.type.position}
            hidden={instruction.type.id === 'send_post' && hideSendPostInstruction}
          />
        )
      })}
    </div>
  )
}
