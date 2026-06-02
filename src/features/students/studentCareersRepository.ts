import { optionalApiGet } from '../../lib/api/client';
import careersDataset from '../../../lms-api/data/odie-careers/careers.v1.json';
import coursesDataset from '../../../lms-api/data/odie-careers/courses.v1.json';

export interface CareerOverview {
  careers?: Array<{ id: string; title: string; description?: string; category?: string }>;
  supportedSubjects?: string[];
}

export function loadCareersOverview() {
  const fallback = {
    careers: careersDataset.careers,
    supportedSubjects: coursesDataset.supportedSubjects,
  };
  return optionalApiGet<CareerOverview>('/odie-careers/overview', fallback);
}
