export type SupportBand = 'on_track' | 'needs_support' | 'urgent_support';

export function supportBandFromRiskScore(score: number | null | undefined): {
  band: SupportBand;
  label: string;
  explanation: string;
  recommendedAction: string;
} {
  const value = Number(score ?? 0);
  if (value >= 70) {
    return {
      band: 'urgent_support',
      label: 'Urgent Support',
      explanation: 'Your recent learning signals show that extra support should happen soon.',
      recommendedAction: 'Book focused tutor time and start with the highest-priority topic.',
    };
  }
  if (value >= 40) {
    return {
      band: 'needs_support',
      label: 'Needs Support',
      explanation: 'You are building momentum, but one or two areas need steady attention.',
      recommendedAction: 'Complete the next assignment and review it with your tutor.',
    };
  }
  return {
    band: 'on_track',
    label: 'On Track',
    explanation: 'Your current signals show a steady learning rhythm.',
    recommendedAction: 'Keep your routine and prepare one question for the next session.',
  };
}
