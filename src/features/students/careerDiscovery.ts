import type { LucideIcon } from 'lucide-react';
import { BriefcaseBusiness, Code2, GraduationCap, HeartPulse, Landmark, Palette, Wrench } from 'lucide-react';
import type { CareerSummary } from './studentCareersRepository';

export type CareerWorldId = 'technology' | 'health-science' | 'engineering' | 'business' | 'creative-arts' | 'education' | 'public-service';

export type CareerWorld = {
  id: CareerWorldId;
  title: string;
  description: string;
  icon: LucideIcon;
  categories: string[];
  tone: string;
};

export const CAREER_WORLDS: CareerWorld[] = [
  { id: 'technology', title: 'Technology', description: 'Build, analyse and protect the digital tools people use.', icon: Code2, categories: ['Technology'], tone: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200' },
  { id: 'health-science', title: 'Health and Science', description: 'Support health, research and scientific discovery.', icon: HeartPulse, categories: ['Health Sciences'], tone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200' },
  { id: 'engineering', title: 'Engineering', description: 'Design, build and solve practical real-world problems.', icon: Wrench, categories: ['Engineering', 'Built Environment'], tone: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-200' },
  { id: 'business', title: 'Business', description: 'Work with money, people, operations and organisations.', icon: BriefcaseBusiness, categories: ['Commerce', 'Marketing', 'Business Operations'], tone: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100' },
  { id: 'creative-arts', title: 'Creative Arts', description: 'Turn ideas and insight into useful experiences and communication.', icon: Palette, categories: ['Design'], tone: 'bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-200' },
  { id: 'education', title: 'Education', description: 'Help people learn, grow and reach their potential.', icon: GraduationCap, categories: ['Education'], tone: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-200' },
  { id: 'public-service', title: 'Law and Public Service', description: 'Strengthen communities and support people through public-facing work.', icon: Landmark, categories: ['Social Impact'], tone: 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200' },
];

export function careersInWorld(careers: CareerSummary[], world: CareerWorld) {
  return careers.filter((career) => career.category && world.categories.includes(career.category));
}

export function availableCareerWorlds(careers: CareerSummary[]) {
  return CAREER_WORLDS.filter((world) => careersInWorld(careers, world).length > 0);
}

const INTEREST_TERMS: Record<string, string[]> = {
  'Solving problems': ['technology', 'engineering', 'data', 'analyst', 'financial', 'quantity'],
  'Helping people': ['health', 'nurse', 'teacher', 'social', 'human resources', 'financial planner'],
  'Designing and creating': ['design', 'marketing', 'software'],
  'Working with technology': ['technology', 'software', 'cybersecurity', 'data', 'digital'],
  'Understanding science': ['health', 'biomedical', 'engineering', 'science'],
  'Organising and leading': ['business', 'commerce', 'accountant', 'marketing', 'human resources', 'teacher'],
};

export type CareerMatch = { career: CareerSummary; reasons: string[]; score: number };

// This is deliberately a transparent catalogue ranking, not an aptitude test.
// It only finds text/category overlap with choices the learner explicitly made.
export function matchCareers(careers: CareerSummary[], interests: string[], subjects: string[]): CareerMatch[] {
  const normalizedSubjects = subjects.map((subject) => subject.toLowerCase());
  return careers
    .map((career) => {
      const haystack = [career.title, career.category, career.description, ...(career.pathCategories ?? []), ...(career.educationRoutes ?? [])].filter(Boolean).join(' ').toLowerCase();
      const matchedInterests = interests.filter((interest) => (INTEREST_TERMS[interest] ?? []).some((term) => haystack.includes(term)));
      const matchedSubjects = normalizedSubjects.filter((subject) => haystack.includes(subject));
      const reasons = [
        ...matchedInterests.slice(0, 2).map((interest) => `Connects with your interest in ${interest.toLowerCase()}`),
        ...matchedSubjects.slice(0, 1).map((subject) => `Relates to ${subject}`),
      ];
      return { career, reasons, score: matchedInterests.length * 3 + matchedSubjects.length * 2 };
    })
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score || left.career.title.localeCompare(right.career.title));
}
