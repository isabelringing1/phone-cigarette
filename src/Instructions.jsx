import Instruction from './Instruction.jsx'

export default function Instructions({ instructions, active, pageIndex }) {
  return (
    <div className="instructions-layer">
      {instructions.map((instruction, instructionIndex) => {
        if (instruction.type.comments_overlay) return null
        if (instruction.type.share_overlay) return null
        if (instruction.type.search_overlay) return null

        return (
          <Instruction
            key={`${pageIndex}-${instruction.type.id}-${instructionIndex}`}
            type={instruction.type}
            timeMs={instruction.timeMs}
            timeLimit={instruction.timeLimit}
            active={active}
            pageIndex={pageIndex}
            instructionIndex={instructionIndex}
            position={instruction.type.position}
          />
        )
      })}
    </div>
  )
}
