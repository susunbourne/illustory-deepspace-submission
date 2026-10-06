import type { Character, Storyboard } from './types'

export function voiceText(board: Storyboard, character: Character): string {
  const beatLines = board.scenes.flatMap((scene) =>
    scene.shots.flatMap((shot) =>
      (shot.beats ?? [])
        .filter((beat) => beat.speaker === character.name && beat.dialogue)
        .map((beat) => beat.dialogue ?? ''),
    ),
  )
  const shotLines = board.scenes.flatMap((scene) =>
    scene.shots
      .filter((shot) => shot.speaker === character.name && shot.dialogue)
      .map((shot) => shot.dialogue ?? ''),
  )
  return (beatLines.length ? beatLines : shotLines).join(' ').slice(0, 240).trim()
}
