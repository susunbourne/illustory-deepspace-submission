// Synthetic screenplay responses for deterministic tests.
export const characterReply = {
  characters: [
    {
      name: 'Ari',
      name_en: 'Ari',
      personality: 'Reserved scientist',
      appearance: {
        nationality: 'Canadian',
        gender: 'woman',
        age_range: '30s',
        hair: 'black',
        face: 'angular',
        body: 'tall',
        costume: 'lab coat',
      },
      reference_image_path: null,
      lora_url: null,
      voice_id: null,
    },
  ],
}
export const sceneReply = {
  title: 'Arrival',
  chapter: 'One',
  scenes: [
    {
      scene_id: 'scene_01',
      title: 'Station',
      scene_visual_anchor: 'Wet platform, clock at the north wall.',
      shots: [
        {
          shot_id: 'scene_01_shot_01',
          location: 'Platform',
          time_of_day: 'night',
          characters: ['Ari'],
          action: 'Ari stands beside the clock, facing the train.',
          environment_details: 'Rain is visible behind Ari.',
          motion: {
            beats: [
              {
                beat_id: 'beat_01',
                description: 'Ari turns toward the train.',
                duration_seconds: 3,
                speaker: null,
                dialogue: null,
              },
            ],
          },
          shot_type: 'medium_shot',
          camera_angle: 'three quarter angle',
          emotions: { emotions: [{ character: 'Ari', emotion: 'tense' }] },
          speaker: null,
          narration: null,
          dialogue: null,
          duration_seconds: 3,
        },
      ],
    },
  ],
}
