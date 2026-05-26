import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

const tutors = [
  {
    name: 'Jaydin Morrison',
    focus: 'Mathematics, exam preparation, confidence rebuilding',
    image: '/images/jaydin-morrison.jpg',
  },
  {
    name: 'Nicholas Dreyer',
    focus: 'CAPS support, algebra, functions, structured revision',
    image: '/images/nicholas-dreyer.png',
  },
  {
    name: 'Liam Newton',
    focus: 'Problem solving, calculus foundations, learner momentum',
    image: '/images/liam-newton.jpg',
  },
];

const stats = [
  ['150+', 'Students helped'],
  ['500+', 'Sessions delivered'],
  ['Grade 8-12', 'CAPS Maths'],
  ['Cape Town', 'Online and local support'],
];

const programs = [
  {
    title: 'Grade 8-9 Foundations',
    description: 'Close number sense, algebra, geometry, and study habit gaps before senior phase pressure builds.',
  },
  {
    title: 'Grade 10-11 Momentum',
    description: 'Structured CAPS support for functions, trigonometry, analytical geometry, probability, and exam technique.',
  },
  {
    title: 'Matric Exam Preparation',
    description: 'Focused revision, past-paper strategy, confidence rebuilding, and targeted support around weak topics.',
  },
  {
    title: 'NGO Learner Rollout',
    description: 'ProVision-ready tutoring operations, learner progress summaries, attendance visibility, and support tracking.',
  },
];

export function PublicHomeRoute() {
  return (
    <PublicLayout>
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <img className="absolute inset-0 h-full w-full object-cover opacity-25" src="/images/og-image-placeholder.svg" alt="" />
        <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl content-center gap-10 px-6 py-20 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-300">Grade 8-12 CAPS Maths</p>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-tight md:text-7xl">Project Odysseus</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">
              1-on-1 maths tutoring for Cape Town and South African learners, supported by a React LMS for assignments, progress, payments, reporting, and NGO rollout operations.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a className="rounded-lg bg-amber-400 px-5 py-3 font-semibold text-slate-950" href="#enquiry">Send an enquiry</a>
              <Link className="rounded-lg border border-white/25 px-5 py-3 font-semibold text-white" to="/programs">View programs</Link>
              <Link className="rounded-lg border border-white/25 px-5 py-3 font-semibold text-white" to="/dashboard/login">Portal login</Link>
            </div>
          </div>
          <div className="grid gap-3">
            {stats.map(([value, label]) => (
              <div key={label} className="rounded-lg border border-white/10 bg-white/10 p-5 backdrop-blur">
                <p className="text-3xl font-semibold text-amber-300">{value}</p>
                <p className="mt-1 text-sm text-slate-200">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-6">
          <SectionIntro title="Tutoring that connects to learner progress" eyebrow="How it works">
            We keep the public tutoring offer and the LMS roadmap aligned: learners get support, parents get clarity, tutors get workflows, and admins get operational visibility.
          </SectionIntro>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {['Diagnose gaps', 'Assign focused work', 'Track progress'].map((item, index) => (
              <article key={item} className="rounded-lg border border-slate-200 p-6">
                <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Step {index + 1}</p>
                <h3 className="mt-3 text-xl font-semibold text-slate-950">{item}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">A practical tutoring workflow that can be reflected in the student, tutor, and admin dashboards as the platform matures.</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <TutorSection />
      <ProgramsSection />
      <EnquirySection />
    </PublicLayout>
  );
}

export function AboutRoute() {
  return (
    <PublicLayout>
      <section className="bg-slate-950 px-6 py-20 text-white">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-300">About</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight">Maths tutoring with operational discipline behind it.</h1>
          <p className="mt-6 text-lg leading-8 text-slate-200">
            Project Odysseus started as focused maths support and is becoming a full LMS-style platform for learners, tutors, admins, parents, and NGO partners.
          </p>
        </div>
      </section>
      <TutorSection />
    </PublicLayout>
  );
}

export function ProgramsRoute() {
  return (
    <PublicLayout>
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <SectionIntro title="Programs" eyebrow="Grade 8-12 CAPS Maths">
            Practical tutoring pathways for learners who need stronger fundamentals, better exam technique, or structured support through a partner rollout.
          </SectionIntro>
          <ProgramsSection compact />
        </div>
      </section>
    </PublicLayout>
  );
}

export function PrivacyRoute() {
  return (
    <LegalRoute title="Privacy">
      <p>Project Odysseus processes learner and tutor data for tutoring operations, progress analytics, session workflows, and safety controls.</p>
      <p>Learner account data may include name, grade, guardian contact details, login email, tutor assignments, attendance/session records, learning progress, community activity, and support or privacy request history.</p>
      <p>Data is used only to provide tutoring services, maintain account security, support learner progress, meet operational/legal duties, and handle access, correction, deletion, or retention requests.</p>
      <p>Operational cookies are used for authenticated portal access. Supabase and API configuration must use environment variables and only safe public configuration may be embedded in client pages.</p>
    </LegalRoute>
  );
}

export function TermsRoute() {
  return (
    <LegalRoute title="Terms">
      <p>These terms govern use of Project Odysseus learning services, tutor workflows, and portal features.</p>
      <p>Access is role-based and controlled by account permissions. Students and guardians are responsible for keeping login details private and reporting incorrect account or learner information promptly.</p>
      <p>Misuse of portal access, impersonation controls, community features, or protected data may result in account suspension.</p>
      <p>Project Odysseus provides tutoring support and progress information, but it does not guarantee academic results or replace school, medical, legal, or professional advice.</p>
    </LegalRoute>
  );
}

function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
          <Link className="text-lg font-semibold tracking-tight text-slate-950" to="/">Project Odysseus</Link>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Link className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100" to="/about">About</Link>
            <Link className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100" to="/programs">Programs</Link>
            <Link className="rounded-lg bg-slate-950 px-3 py-2 text-white" to="/dashboard/login">Login</Link>
          </div>
        </nav>
      </header>
      {children}
      <footer className="border-t border-slate-200 bg-white px-6 py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 text-sm text-slate-600">
          <p>Project Odysseus</p>
          <div className="flex gap-4">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function TutorSection() {
  return (
    <section className="bg-slate-50 py-16">
      <div className="mx-auto max-w-7xl px-6">
        <SectionIntro title="Meet the tutors" eyebrow="Academic support">
          Preserve the strongest public-site trust signal while the LMS migration moves tutor operations into React.
        </SectionIntro>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {tutors.map((tutor) => (
            <article key={tutor.name} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <img className="aspect-[4/3] w-full object-cover" src={tutor.image} alt={tutor.name} />
              <div className="p-5">
                <h3 className="text-xl font-semibold text-slate-950">{tutor.name}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{tutor.focus}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProgramsSection({ compact = false }: { compact?: boolean }) {
  return (
    <section className={compact ? 'mt-10' : 'bg-white py-16'}>
      <div className={compact ? '' : 'mx-auto max-w-7xl px-6'}>
        {!compact ? (
          <SectionIntro title="Programs" eyebrow="Learning pathways">
            Structured maths support that maps naturally into assignments, progress records, and parent/NGO reporting.
          </SectionIntro>
        ) : null}
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {programs.map((program) => (
            <article key={program.title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-slate-950">{program.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{program.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function EnquirySection() {
  return (
    <section id="enquiry" className="bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-300">Next step</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight">Start with a focused learner conversation.</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">The static enquiry form still remains available during migration. The React LMS will eventually own enquiries, onboarding, assignments, progress, and reporting end to end.</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/10 p-5">
          <p className="font-semibold text-white">Portal access</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">Existing students, tutors, and admins can continue through the dashboard login while public enquiry capture is migrated.</p>
          <Link className="mt-4 inline-flex rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950" to="/dashboard/login">Open login</Link>
        </div>
      </div>
    </section>
  );
}

function LegalRoute({ title, children }: { title: string; children: ReactNode }) {
  return (
    <PublicLayout>
      <main className="px-6 py-16">
        <article className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950">{title}</h1>
          <div className="mt-6 space-y-4 text-sm leading-7 text-slate-600">{children}</div>
          <Link className="mt-8 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800" to="/">Back home</Link>
        </article>
      </main>
    </PublicLayout>
  );
}

function SectionIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">{eyebrow}</p>
      <h2 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">{title}</h2>
      <p className="mt-4 text-sm leading-7 text-slate-600">{children}</p>
    </div>
  );
}
