import { apiPut, optionalApiGet } from '../../lib/api/client';
import careersDataset from '../../../lms-api/data/odie-careers/careers.v1.json';
import coursesDataset from '../../../lms-api/data/odie-careers/courses.v1.json';

export interface CareerSummary {
  id: string;
  title: string;
  description?: string;
  category?: string;
  salaryRange?: {
    low: number;
    median: number;
    high: number;
  };
  demandLabel?: string;
  growthLabel?: string;
  pathCategories?: string[];
  forecast?: {
    summary?: string;
    confidence?: string;
    forecastScore?: number;
  };
}

export interface StudentCareerProfile {
  interests: string[];
  preferredSubjects: string[];
  targetCareers: string[];
  apsTarget: number | null;
  savedCareers: string[];
}

export interface CareerOverview {
  careers?: CareerSummary[];
  institutions?: Array<{ id: string; name: string; city: string; institutionTypes?: string[] }>;
  supportedSubjects?: string[];
  profile?: StudentCareerProfile;
}

const emptyProfile: StudentCareerProfile = {
  interests: [],
  preferredSubjects: [],
  targetCareers: [],
  apsTarget: null,
  savedCareers: [],
};

export function loadCareersOverview() {
  const fallback = {
    careers: careersDataset.careers,
    institutions: coursesDataset.institutions,
    supportedSubjects: coursesDataset.supportedSubjects,
    profile: emptyProfile,
  };
  return optionalApiGet<CareerOverview>('/odie-careers/overview', fallback);
}

export function saveCareerProfile(profile: StudentCareerProfile) {
  return apiPut<{ profile: StudentCareerProfile }>('/odie-careers/profile', profile);
}
