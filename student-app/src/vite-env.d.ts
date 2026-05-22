/// <reference types="vite/client" />

declare global {
  interface Window {
    __PO_API_BASE__?: string;
    __PO_STUDENT_AUTH__?: Promise<StudentAuthSession | null>;
    __ODIE_ASSISTANT_ENABLED__?: boolean;
  }
}

export interface StudentAuthSession {
  user: {
    role: 'STUDENT';
    profile?: {
      name?: string;
      email?: string;
      picture?: string;
    };
  };
}
