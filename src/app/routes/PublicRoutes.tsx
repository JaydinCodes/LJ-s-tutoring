import type { FormEvent, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CountUpStat } from '../../components/animations/CountUpStat';
import { Reveal, StaggerReveal } from '../../components/animations/Reveal';
import { SplitHeroTitle } from '../../components/animations/SplitHeroTitle';
import { StructuredData } from '../../components/seo/StructuredData';
import { GreekDivider } from '../../components/ui/GreekDivider';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';


const tutors = [
  {
    name: 'Jaydin Morrison',
    subject: 'Mathematics',
    role: 'Senior CAPS tutor',
    bio: 'Jaydin helps learners rebuild confidence through patient explanations, exam-focused practice, and a clear plan for closing foundational gaps.',
    image: '/images/jaydin-morrison.jpg',
  },
  {
    name: 'Nicholas Dreyer',
    subject: 'Physical Sciences',
    role: 'Physics Tutor',
    bio: 'Nicholas makes Physics feel less abstract by connecting the theory to clear examples, structured calculations, and the reasoning behind every formula.',
    image: '/images/nicholas-dreyer.png',
  },
  {
    name: 'Liam Newton',
    subject: 'Mathematics',
    role: 'Problem-solving tutor',
    bio: 'Liam focuses on problem-solving habits and calculus foundations, helping learners turn difficult questions into manageable steps and build momentum.',
    image: '/images/liam-newton.jpg',
  },
  {
    name: 'Logan Petrus',
    subject: 'Mathematical Literacy',
    role: 'Mathematical Literacy Tutor',
    bio: 'Logan makes Mathematical Literacy practical and approachable, helping learners apply data handling, finance, and measurement skills with confidence.',
    image: '/images/logan-petrus.jpeg',
  },
];

const stats = [
  {
    value: 1,
    suffix: '+',
    label: 'Years of tutoring experience',
  },
  {
    value: 100,
    suffix: '+',
    label: 'Learners supported',
  },
  {
    value: 98,
    suffix: '%',
    label: 'Parent satisfaction',
  },
  {
    value: 12,
    label: 'CAPS grades covered',
  },
];





const faqs = [
  {
    question: 'How do the tutoring sessions work?',
    answer:
      'Sessions are usually in person at a convenient home or study space, with each hour focused on specific gaps, upcoming tests, exam preparation, and week-to-week progress.',
  },
  {
    question: 'What if I need to reschedule a session?',
    answer:
      'Give us 24 hours notice and we will reschedule at no extra charge. Same-day cancellations may forfeit the session, but we try to be flexible where possible.',
  },
  {
    question: 'Do you offer online tutoring?',
    answer:
      'In-person tutoring is the main offer, but online Zoom or Google Meet sessions can be arranged for package holders who occasionally cannot meet in person.',
  },
  {
    question: 'What grades and subjects do you tutor?',
    answer:
      'We tutor CAPS Mathematics for Grade 8 to Grade 12 learners, from foundation gaps through to distinction-level exam preparation.',
  },
  {
    question: 'Is there a satisfaction guarantee?',
    answer:
      'Yes. If the first session is not a fit, we refund that session. For packages, we work with families to fix the issue or prorate unused hours where appropriate.',
  },
];

const tutorPerks = [
  ['Flexible hours', 'Set your schedule around studies, work, and existing commitments.'],
  ['Competitive pay', 'Earn for your expertise while making a direct academic impact.'],
  ['Grow with us', 'Build real teaching experience as the LMS and ProVision rollout mature.'],
  ['Supportive team', 'Work with tutors who care about consistent learner progress.'],
];

const tutorRequirements = [
  'Relevant degree or qualification in Mathematics or a related field',
  'Strong command of CAPS Mathematics for Grades 8-12',
  'Patient, encouraging communication style',
  'Genuine passion for helping learners build confidence',
  'Based in or near Cape Town, South Africa',
];

const contactEmail = 'projectodysseus.maths@gmail.com';
const whatsappNumber = '27679327754';
const whatsappEnquiryHref = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
  'Hi Project Odysseus. I would like to ask about tutoring support.',
)}`;
const enquiryThrottleKey = 'po_react_enquiry_last_submit';
const enquiryThrottleMs = 30000;
const businessUrl = 'https://projectodysseus.live';
const heroFallbackImage = '/images/odysseus-hero-fallback.png';
const heroVideo = '/images/bg_video.mp4';

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': `${businessUrl}/#business`,
  name: 'Project Odysseus Tutoring',
  description:
    'CAPS tutoring support for Grade 8-12 learners in Cape Town, including Mathematics, Mathematical Literacy, and Physical Sciences.',
  url: businessUrl,
  image: `${businessUrl}/images/og-image-placeholder.svg`,
  email: contactEmail,
  telephone: `+${whatsappNumber}`,
  areaServed: {
    '@type': 'City',
    name: 'Cape Town',
  },
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Cape Town',
    addressRegion: 'Western Cape',
    addressCountry: 'ZA',
  },
  openingHoursSpecification: {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    opens: '17:00',
    closes: '20:00',
  },
};

const faqPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  })),
};

type EnquiryFormState = {
  name: string;
  email: string;
  grade: string;
  message: string;
  website: string;
};

type EnquiryStatus =
  | { tone: 'idle'; message: string }
  | { tone: 'success' | 'error' | 'info'; message: string };

const initialEnquiryForm: EnquiryFormState = {
  name: '',
  email: '',
  grade: '',
  message: '',
  website: '',
};

export function PublicHomeRoute() {
  return (
    <PublicLayout>
      <StructuredData data={[localBusinessSchema, faqPageSchema]} />
      <section className="relative isolate overflow-hidden bg-brand-navy text-white">
        <img
          className="absolute inset-0 h-full w-full object-cover object-[63%_center]"
          src={heroFallbackImage}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
        />
        <video
          className="absolute inset-0 hidden h-full w-full object-cover object-[60%_center] opacity-35 sm:block"
          src={heroVideo}
          poster={heroFallbackImage}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(15,23,42,0.98)_0%,_rgba(15,23,42,0.88)_48%,_rgba(15,23,42,0.62)_100%)] sm:bg-[linear-gradient(90deg,_rgba(15,23,42,0.98)_0%,_rgba(15,23,42,0.88)_48%,_rgba(15,23,42,0.62)_100%)]" />
        <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-7xl flex-col justify-center px-4 pb-12 pt-16 sm:px-6 sm:py-20 lg:min-h-[86svh]">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-brand-gold">GRADE 8–12 CAPS TUTORING</p>
          <SplitHeroTitle className="greek-display mt-4 max-w-4xl text-5xl font-semibold tracking-tight sm:mt-5 sm:text-7xl md:text-8xl">Project Odysseus</SplitHeroTitle>
          <Reveal variant="oracle" delay={0.45} className="mt-5 max-w-2xl text-base leading-7 text-brand-parchment sm:mt-6 sm:text-lg sm:leading-8">
              Targeted CAPS support for Mathematics, Mathematical Literacy, and Physical Sciences, from core concepts to exam prep.
              We identify learning gaps, rebuild confidence, and keep every session focused on what each learner needs next.
          </Reveal>
          <Reveal variant="oracle" delay={0.6} className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
            <a className="inline-flex justify-center rounded-full bg-brand-gold px-5 py-3 text-sm font-semibold text-brand-obsidian shadow-lg shadow-black/20 transition hover:bg-[#f7d24f] sm:text-base" href="#enquiry">Join Our Tutoring Programme</a>
            <a className="inline-flex justify-center rounded-full border border-brand-aegean/70 bg-brand-aegean px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-brand-deepBlue sm:text-base" href="#tutors">Meet Our Tutors</a>
            <Link className="inline-flex justify-center rounded-full border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 sm:text-base" to="/programs">View programs</Link>
          </Reveal>
          <StaggerReveal className="mt-8 grid max-w-4xl grid-cols-2 gap-3 sm:mt-10 lg:grid-cols-4" start="top 95%">
            {stats.map(({ value, suffix, label }) => (
              <div key={label} data-reveal-child className="rounded-[1.25rem] border border-brand-marble/15 bg-white/10 p-4 backdrop-blur sm:rounded-[1.5rem] sm:p-5">
                <p className="text-2xl font-semibold text-brand-gold sm:text-3xl">
                  <CountUpStat value={value} suffix={suffix} />
                </p>
                <p className="mt-1 text-xs leading-5 text-brand-parchment sm:text-sm">{label}</p>
              </div>
            ))}
          </StaggerReveal>
        </div>
      </section>

      <GreekDivider background="parchment" tone="gold" />

      <Reveal as="section" className="bg-brand-parchment py-16">
        <div className="mx-auto grid max-w-7xl gap-6 px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
          <div>
            <SectionIntro title="Tutoring that feels connected, not scattered" eyebrow="React LMS workflow">
              Students get direct maths support. Parents get clarity. Tutors get a review workflow. Admins get visibility. The public site now matches that same clean LMS identity.
            </SectionIntro>
            <StaggerReveal className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                ['Diagnose gaps', 'Baseline weak topics and turn them into focused study goals.'],
                ['Assign focused work', 'Publish tasks, track submissions, and reduce homework ambiguity.'],
                ['Track progress', 'Surface marks, feedback, attendance, and momentum in one place.'],
              ].map(([title, description], index) => (
                <article key={title} data-reveal-child className="rounded-[1.5rem] border border-brand-marble bg-white/90 p-6 shadow-lg shadow-slate-200/60">
                  <p className="text-sm font-semibold uppercase tracking-wide text-brand-aegean">Step {index + 1}</p>
                  <h3 className="mt-3 text-xl font-semibold text-brand-obsidian">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                </article>
              ))}
            </StaggerReveal>
          </div>
          <aside className="space-y-4">
            <div className="rounded-[1.5rem] bg-brand-deepBlue p-5 text-white shadow-xl shadow-brand-navy/20">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-marble">Student snapshot</p>
              <h3 className="mt-3 text-2xl font-semibold">This week in Maths</h3>
              <div className="mt-5 grid gap-3">
                {[
                  ['Assignments due', '2 priority tasks'],
                  ['Latest result', '78% Algebra revision'],
                  ['Progress', 'Functions improving'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 rounded-2xl bg-white/12 px-4 py-3">
                    <span className="text-sm text-brand-parchment">{label}</span>
                    <span className="text-sm font-semibold">{value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-3">
              {[
                ['Student dashboard', 'Assignments, results, progress, careers'],
                ['Tutor dashboard', 'Classes, sessions, submissions, reports'],
                ['Admin dashboard', 'Students, tutors, approvals, payments'],
              ].map(([title, description]) => (
                <div key={title} className="rounded-2xl border border-brand-marble bg-white/95 p-4 shadow-lg shadow-slate-200/50">
                  <p className="font-semibold text-brand-obsidian">{title}</p>
                  <p className="mt-1 text-sm text-slate-600">{description}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </Reveal>

      <GreekDivider background="white" />

      <Reveal as="section" variant="marble" className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
            <div>
              <SectionIntro title="Built for learners who need maths to make sense" eyebrow="Why families choose us">
                The work is practical: identify the gap, explain the method, practise under pressure, and make the next school task easier to face.
              </SectionIntro>
              <div className="mt-8 flex flex-wrap gap-3">
                <a className="rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white" href="#enquiry">Book a first conversation</a>
                <Link className="rounded-full border border-brand-marble px-5 py-3 text-sm font-semibold text-brand-obsidian" to="/guides/matric-maths-mistakes-guide">Read the matric guide</Link>
              </div>
            </div>
          
          </div>
        </div>
      </Reveal>

      <TutorSection />
      <GreekDivider background="white" tone="gold" />
      <GuideSection />
      <FaqSection />
      <GreekDivider background="slate" tone="gold" />
      <BecomeTutorSection />
      <EnquirySection />
    </PublicLayout>
  );
}

export function AboutRoute() {
  return (
    <PublicLayout>
      <section className="bg-slate-950 px-6 py-20 text-white">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold">About</p>
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
  const programmes = [
    ['Grade 8-9 foundations', 'Strengthen core number skills, algebra, geometry, and problem-solving habits before gaps compound.'],
    ['Grade 10-11 progression', 'Build confidence with functions, trigonometry, analytical geometry, and exam-style application.'],
    ['Grade 12 exam preparation', 'Target weak topics, sharpen exam technique, and practise under realistic time pressure.'],
  ];

  return (
    <PublicLayout>
      <section className="bg-brand-parchment px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <SectionIntro title="CAPS tutoring programmes" eyebrow="Grade 8-12 support">
            Focused tutoring plans for Mathematics, Mathematical Literacy, and Physical Sciences learners who need stronger foundations, clearer methods, and measurable progress.
          </SectionIntro>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {programmes.map(([title, description]) => (
              <article key={title} className="rounded-[1.5rem] border border-brand-marble bg-white p-6 shadow-sm shadow-slate-200/50">
                <h2 className="text-xl font-semibold text-brand-obsidian">{title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
          <a className="mt-8 inline-flex rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white" href="/#enquiry">
            Ask about the right programme
          </a>
        </div>
      </section>
    </PublicLayout>
  );
}





export function GuidesIndexRoute() {
  return (
    <PublicLayout>
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <SectionIntro title="Learning guides" eyebrow="Resources">
            Short, practical resources for learners and parents. These are now served through the React app while the old static guide files remain available for compatibility.
          </SectionIntro>
          <div className="mt-10 rounded-lg border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Matric Maths Mistakes Guide</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              A concise guide to avoid frequent Grade 12 maths mistakes and improve exam consistency.
            </p>
            <Link className="mt-5 inline-flex rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" to="/guides/matric-maths-mistakes-guide">
              Read guide
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

export function MatricMathsMistakesGuideRoute() {
  const guideSections = [
    ['Misreading the question', 'Underline command words and rewrite the ask before calculating. This keeps the method aligned with what the examiner actually wants.'],
    ['Skipping algebra steps', 'Show transformations line by line so method marks are still earned when arithmetic slips happen.'],
    ['No time strategy', 'Allocate time per mark and return to hard questions later. Do not let one difficult question drain marks from the rest of the paper.'],
    ['Weak error review', 'Keep an error log by topic and trigger so revision follows patterns instead of guesswork.'],
  ];

  return (
    <PublicLayout>
      <article className="bg-white px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">Guide</p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-slate-950">Matric Maths Mistakes Guide</h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            A concise Grade 12 maths guide for avoiding common exam mistakes and making revision more consistent.
          </p>
          <div className="mt-10 grid gap-4">
            {guideSections.map(([title, description], index) => (
              <section key={title} className="rounded-lg border border-slate-200 bg-slate-50 p-6">
                <h2 className="text-xl font-semibold text-slate-950">{index + 1}. {title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
              </section>
            ))}
          </div>
          <Link className="mt-8 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800" to="/guides">
            Back to guides
          </Link>
        </div>
      </article>
    </PublicLayout>
  );
}

export function PrivacyRoute() {
  return (
    <LegalRoute title="Privacy">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Last updated: 8 June 2026</p>
      <p>
        This privacy notice explains how Project Odysseus handles personal information for tutoring, learner progress tracking,
        parent or guardian reporting, tutor operations, NGO partner reporting, and platform administration. It is written for
        practical launch readiness and should be reviewed by a legal professional.
      </p>

      <LegalSection title="Information We Collect">
        <p>Depending on how you use the platform, we may collect and process:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Learner information such as name, grade, school context, contact details, account email, assigned tutor, cohort, status, and onboarding information.</li>
          <li>Parent or guardian information such as name, email, phone number, relationship to the learner, communication preference, and report-access permissions.</li>
          <li>Tutor information such as profile details, assigned learners or classes, session records, notes needed for tutoring operations, availability or workflow status, and payment-adjacent admin records where applicable.</li>
          <li>Academic and operational records such as assignments, submissions, uploaded files, marks, feedback, released results, progress summaries, attendance, session notes, and support history.</li>
          <li>NGO partner records such as partner name, permitted cohorts, contact person, and aggregate reporting outputs.</li>
          <li>Account, security, and technical information such as login events, role permissions, audit logs, privacy request records, browser or device diagnostics, and error reports.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Learners And Minors">
        <p>
          Many learners using Project Odysseus are minors. We treat learner names, contact details, marks, feedback, uploaded
          work, tutor notes, attendance, and progress information as sensitive education data. Parent or guardian involvement
          may be required for onboarding, reporting, correction requests, deletion requests, and other privacy decisions.
        </p>
      </LegalSection>

      <LegalSection title="How We Use Information">
        <p>We use personal information to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>provide tutoring services, assignments, feedback, progress tracking, and learner support;</li>
          <li>manage accounts, roles, tutor allocations, classes, results, releases, reports, and operational workflows;</li>
          <li>communicate with learners, parents, guardians, tutors, admins, and approved partners;</li>
          <li>protect the platform through authentication, role-based access, audit logs, retention controls, and error monitoring;</li>
          <li>respond to access, correction, deletion, retention, safety, and support requests.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Who Can Access Data">
        <p>
          Access is role-based. Learners see their own dashboard, assignments, results, progress, and support surfaces. Tutors
          see only the learners, classes, submissions, and session workflows assigned to them. Admin users can manage operational
          records needed to run the tutoring service. Parents or guardians can see released reports only for linked learners
          where report access is enabled. NGO partners receive cohort-level reporting intended to exclude learner names,
          guardian contacts, individual feedback, and raw submission content.
        </p>
      </LegalSection>

      <LegalSection title="Uploads And Learning Records">
        <p>
          Assignment submissions and uploaded files may include learner answers, images, documents, or other schoolwork. These
          files are used for review, marking, feedback, progress tracking, and auditability. Learners and guardians should avoid
          uploading unrelated personal documents or sensitive information that is not needed for tutoring.
        </p>
      </LegalSection>

      <LegalSection title="Third-Party Services">
        <p>
          Project Odysseus uses service providers to operate the platform, including Supabase for authentication, database, and
          storage services, hosting providers for the website and portal, communication tools such as email or WhatsApp links,
          form handling where configured, and error monitoring for technical diagnostics. We do not intentionally send learner
          marks, private notes, uploaded file contents, or guardian contact details to monitoring tools.
        </p>
      </LegalSection>

      <LegalSection title="Security And Retention">
        <p>
          We use Supabase authentication, role-based access controls, row-level security, audit logging, and operational
          retention processes to reduce the risk of unauthorised access. No online service can guarantee perfect security.
          Records are retained only as long as needed for tutoring operations, support, audit, legal, financial, or safety
          reasons, then deleted or anonymised where the platform retention process allows.
        </p>
      </LegalSection>

      <LegalSection title="POPIA And Privacy Requests" id="privacy-requests">
        <p>
          You may ask to access, correct, or delete personal information, subject to identity checks, guardian authority where
          a learner is a minor, and any retention duties that require us to keep or anonymise records instead of deleting them.
          To make a privacy request, email <a className="font-semibold text-brand-deepBlue underline-offset-4 hover:underline" href={`mailto:${contactEmail}?subject=${encodeURIComponent('Privacy request - Project Odysseus')}`}>{contactEmail}</a> with your name,
          the learner or account involved, the request type, and enough detail for us to verify and respond safely.
        </p>
      </LegalSection>
    </LegalRoute>
  );
}

export function TermsRoute() {
  return (
    <LegalRoute title="Terms">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Last updated: 8 June 2026</p>
      <p>
        These terms apply to Project Odysseus tutoring services, learner dashboards, tutor workflows, parent or guardian report
        access, NGO partner reporting, and related admin features.
      </p>

      <LegalSection title="Tutoring Service Expectations">
        <p>
          Project Odysseus provides educational support, tutoring structure, assignments, feedback, and progress visibility. It
          does not replace school attendance, school assessment duties, medical advice, legal advice, or professional educational
          assessments, and it does not guarantee a specific mark, grade, result, or admission outcome.
        </p>
      </LegalSection>

      <LegalSection title="Accounts And Role Access">
        <p>
          Portal access is role-based. Students, parents or guardians, tutors, admins, and NGO partners must use only their own
          accounts and must not try to view another role's protected information. Login details must be kept private. If account
          details, learner records, guardian links, tutor allocations, or report permissions look incorrect, tell Project
          Odysseus promptly so the record can be reviewed.
        </p>
      </LegalSection>

      <LegalSection title="Learner Work, Uploads, And Feedback">
        <p>
          Learners may submit assignments, documents, images, answers, or other schoolwork for tutoring review. Uploaded content
          must be relevant to the tutoring task and must not include material the learner is not allowed to share. Tutors and
          admins may review, mark, return, replace, or remove submissions where needed for the tutoring workflow, safety, or
          platform operation.
        </p>
      </LegalSection>

      <LegalSection title="Sessions, Attendance, And Communication">
        <p>
          Tutoring sessions depend on agreed scheduling, learner readiness, accurate contact details, and respectful
          communication. Session notes, attendance records, progress summaries, and parent or guardian communications may be
          recorded so the team can support the learner consistently and resolve disputes or operational questions.
        </p>
      </LegalSection>

      <LegalSection title="Parent, Guardian, And NGO Access">
        <p>
          Parent or guardian access is limited to linked learners and released reports that Project Odysseus has enabled for
          that guardian relationship. NGO partner reports are intended for authorised cohort-level reporting and should not be
          used to identify individual learners unless a separate, approved process exists.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable Use">
        <p>You must not misuse the service, including by:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>impersonating another learner, parent, guardian, tutor, admin, or partner;</li>
          <li>attempting to bypass role permissions, Supabase security rules, or protected routes;</li>
          <li>uploading harmful, illegal, unrelated, or privacy-invasive content;</li>
          <li>sharing another person's academic records, feedback, contact details, or private notes without permission;</li>
          <li>using tutoring communication channels for harassment, spam, or non-tutoring purposes.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Payments And Admin Records">
        <p>
          Where payments, packages, invoices, tutor pay, or reconciliation records apply, those records are handled for
          operational administration, support, and retention purposes. Specific pricing, cancellation, refund, or package terms
          may be confirmed separately during onboarding or direct communication.
        </p>
      </LegalSection>

      <LegalSection title="Suspension, Corrections, And Changes">
        <p>
          Project Odysseus may restrict access where an account is misused, where a learner safety or privacy concern exists,
          where payment or operational records need review, or where the platform must protect other users. We may update these
          terms as the tutoring platform changes. For account, correction, deletion, or privacy questions, contact
          <a className="ml-1 font-semibold text-brand-deepBlue underline-offset-4 hover:underline" href={`mailto:${contactEmail}?subject=${encodeURIComponent('Terms or account question - Project Odysseus')}`}>{contactEmail}</a>.
        </p>
      </LegalSection>
    </LegalRoute>
  );
}

function PublicLayout({ children }: { children: ReactNode }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const closeMenu = () => setIsMenuOpen(false);

  useEffect(() => {
    if (!isMenuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isMenuOpen]);

  return (
    <div className="min-h-screen bg-slate-50 pb-24 text-slate-950 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-brand-navy/10 bg-white/80 shadow-sm shadow-brand-navy/10 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70">
        <nav className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link className="flex min-w-0 items-center gap-2 rounded-lg text-base font-semibold tracking-tight text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-aegean focus-visible:ring-offset-2 sm:gap-3 sm:text-lg" to="/" onClick={closeMenu}>
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-navy text-sm font-bold text-white">PO</span>
            <span className="greek-display truncate text-xl">Project Odysseus</span>
          </Link>
          <div className="hidden items-center gap-2 text-sm font-semibold md:flex">
            <Link className="rounded-full px-3 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-aegean focus-visible:ring-offset-2" to="/about">About</Link>
            <Link className="rounded-full px-3 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-aegean focus-visible:ring-offset-2" to="/programs">Programs</Link>
            <a className="rounded-full px-3 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-aegean focus-visible:ring-offset-2" href="/#faq">FAQ</a>
            <a className="rounded-full px-3 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-aegean focus-visible:ring-offset-2" href="/#become-a-tutor">Tutor with us</a>
            <Link className="rounded-full bg-brand-navy px-4 py-2 text-white shadow-sm transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-aegean focus-visible:ring-offset-2" to="/dashboard/login">Student Login</Link>
          </div>
          <button
            className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-brand-navy shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-aegean focus-visible:ring-offset-2 md:hidden"
            type="button"
            aria-controls="public-mobile-menu"
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={() => setIsMenuOpen((current) => !current)}
          >
            <span className="sr-only">{isMenuOpen ? 'Close menu' : 'Open menu'}</span>
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {isMenuOpen ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
          <div
            id="public-mobile-menu"
            className={`absolute inset-x-0 top-full border-b border-slate-200 bg-white px-4 py-4 shadow-lg md:hidden ${
              isMenuOpen ? 'block' : 'hidden'
            }`}
          >
            <div className="mx-auto grid max-w-7xl gap-1 text-sm font-semibold">
              <Link className="rounded-lg px-4 py-3 text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-aegean" to="/about" onClick={closeMenu}>About</Link>
              <Link className="rounded-lg px-4 py-3 text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-aegean" to="/programs" onClick={closeMenu}>Programs</Link>
              <a className="rounded-lg px-4 py-3 text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-aegean" href="/#faq" onClick={closeMenu}>FAQ</a>
              <a className="rounded-lg px-4 py-3 text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-aegean" href="/#become-a-tutor" onClick={closeMenu}>Tutor with us</a>
              <Link className="mt-2 rounded-lg bg-brand-navy px-4 py-3 text-center text-white hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-aegean" to="/dashboard/login" onClick={closeMenu}>Student Login</Link>
            </div>
          </div>
        </nav>
      </header>
      {children}
      <a
        className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-emerald-300/70 bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-2xl shadow-emerald-950/30 transition hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 md:hidden"
        href={whatsappEnquiryHref}
        target="_blank"
        rel="noreferrer"
        aria-label="Ask about tutoring support on WhatsApp"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12.04 2a9.84 9.84 0 0 0-8.52 14.76L2 22l5.38-1.42A9.98 9.98 0 0 0 12.04 22 10 10 0 0 0 12.04 2Zm0 18.18a8.18 8.18 0 0 1-4.17-1.14l-.3-.18-3.2.84.86-3.1-.2-.32a8.02 8.02 0 0 1-1.25-4.32 8.22 8.22 0 1 1 8.26 8.22Zm4.5-6.16c-.25-.12-1.46-.72-1.69-.8-.22-.08-.39-.12-.55.13-.16.24-.63.8-.77.96-.14.16-.29.18-.53.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.7-.14-.25-.02-.38.1-.5.12-.1.25-.28.37-.42.13-.14.17-.24.25-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.43.06-.65.3-.23.25-.86.84-.86 2.05s.88 2.38 1 2.54c.12.16 1.73 2.64 4.19 3.7.59.25 1.04.4 1.4.52.59.19 1.12.16 1.54.1.47-.07 1.46-.6 1.67-1.17.2-.58.2-1.07.14-1.17-.06-.1-.22-.16-.47-.28Z" />
        </svg>
        WhatsApp us about tutoring
      </a>
      <footer className="border-t border-slate-200 bg-white px-6 py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 text-sm text-slate-600">
          <p>Project Odysseus</p>
          <div className="flex gap-4">
            <Link to="/privacy">Privacy</Link>
            <a href="/privacy#privacy-requests">POPIA requests</a>
            <Link to="/terms">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function TutorSection() {
  return (
    <Reveal as="section" id="tutors" className="bg-brand-parchment py-16">
      <div className="mx-auto max-w-7xl px-6">
        <SectionIntro title="Meet the tutors" eyebrow="Academic support">
          Preserve the strongest public-site trust signal while the LMS migration moves tutor operations into React.
        </SectionIntro>
        <StaggerReveal className="mt-10 grid gap-4 md:grid-cols-3">
          {tutors.map((tutor) => (
            <TutorCard key={tutor.name} tutor={tutor} />
          ))}
        </StaggerReveal>
      </div>
    </Reveal>
  );
}

function TutorCard({ tutor }: { tutor: (typeof tutors)[number] }) {
  const [isBioVisible, setIsBioVisible] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const bioId = `tutor-bio-${tutor.name.toLowerCase().replace(/\s+/g, '-')}`;
  const transitionClass = prefersReducedMotion ? '' : 'transition duration-300 ease-out';

  return (
    <article
      data-reveal-child
      className="group overflow-hidden rounded-[1.5rem] border border-brand-marble bg-white shadow-sm shadow-slate-200/50"
    >
      <div className="relative overflow-hidden">
        <img
          className={`aspect-[4/3] w-full object-cover ${transitionClass} ${prefersReducedMotion ? '' : 'group-hover:scale-[1.03]'}`}
          src={tutor.image}
          alt={`${tutor.name}, ${tutor.role} for ${tutor.subject}`}
        />
        <button
          className="absolute inset-0 z-10 focus:outline-none focus:ring-4 focus:ring-inset focus:ring-brand-gold"
          type="button"
          aria-label={`Read ${tutor.name}'s bio`}
          aria-controls={bioId}
          aria-expanded={isBioVisible}
          onClick={() => setIsBioVisible(true)}
          onFocus={() => setIsBioVisible(true)}
        />
        <div
          id={bioId}
          className={`absolute inset-0 z-20 flex flex-col justify-end bg-brand-navy/90 p-5 text-white ${
            isBioVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          } ${transitionClass} group-hover:pointer-events-auto group-hover:opacity-100`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-gold">Tutor bio</p>
          <p className="mt-3 text-sm leading-6 text-brand-parchment">{tutor.bio}</p>
          <button
            className="mt-4 w-fit rounded-full border border-white/25 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-brand-gold"
            type="button"
            tabIndex={isBioVisible ? 0 : -1}
            onClick={(event) => {
              setIsBioVisible(false);
              event.currentTarget.blur();
            }}
          >
            Close bio
          </button>
        </div>
      </div>
      <div className="p-5">
        <h3 className="text-xl font-semibold text-brand-obsidian">{tutor.name}</h3>
        <p className="mt-2 text-sm font-semibold text-brand-deepBlue">{tutor.subject}</p>
        <p className="mt-1 text-sm text-slate-600">{tutor.role}</p>
        <button
          className="mt-4 rounded-full border border-brand-marble px-3 py-1.5 text-xs font-semibold text-brand-deepBlue transition hover:border-brand-aegean hover:bg-brand-parchment focus:outline-none focus:ring-2 focus:ring-brand-aegean/50"
          type="button"
          aria-controls={bioId}
          aria-expanded={isBioVisible}
          onClick={() => setIsBioVisible((current) => !current)}
          onFocus={() => setIsBioVisible(true)}
        >
          {isBioVisible ? 'Hide bio' : 'Read bio'}
        </button>
      </div>
    </article>
  );
}





function GuideSection() {
  return (
    <Reveal as="section" variant="marble" className="bg-white py-16">
      <div className="mx-auto grid max-w-7xl gap-6 px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
        <SectionIntro title="Matric maths guide" eyebrow="Free resource">
          Keep the useful lead-magnet path alive during the migration. Learners can still open the guide while future downloads and follow-ups move into onboarding and reporting workflows.
        </SectionIntro>
        <div className="rounded-[1.5rem] border border-brand-marble bg-brand-parchment p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-brand-obsidian">Common matric maths mistakes</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            A practical revision guide for avoiding avoidable marks lost in tests and exams.
          </p>
          <Link className="mt-5 inline-flex rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white" to="/guides/matric-maths-mistakes-guide">
            Open guide
          </Link>
        </div>
      </div>
    </Reveal>
  );
}

function FaqSection() {
  return (
    <Reveal as="section" id="faq" variant="marble" className="bg-white py-16">
      <div className="mx-auto max-w-4xl px-6">
        <SectionIntro title="Frequently asked questions" eyebrow="Tutoring details">
          The core public-site answers are now available in React while the legacy landing page remains in the repository for comparison.
        </SectionIntro>
        <StaggerReveal className="mt-10 grid gap-3" staggerBy={0.08}>
          {faqs.map((faq, index) => <FaqItem key={faq.question} faq={faq} index={index} />)}
        </StaggerReveal>
      </div>
    </Reveal>
  );
}

function FaqItem({ faq, index }: { faq: (typeof faqs)[number]; index: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const answerId = `faq-answer-${index}`;
  const questionId = `faq-question-${index}`;

  return (
    <article data-reveal-child className="rounded-lg border border-brand-marble bg-brand-parchment">
      <h3>
        <button
          id={questionId}
          className="flex w-full items-center justify-between gap-4 rounded-lg px-5 py-4 text-left text-base font-semibold text-slate-950 transition hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-aegean"
          type="button"
          aria-controls={answerId}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
        >
          <span>{faq.question}</span>
          <svg
            className={`h-5 w-5 shrink-0 text-brand-aegean transition-transform duration-200 motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="m5 7.5 5 5 5-5" />
          </svg>
        </button>
      </h3>
      <div
        id={answerId}
        className={`grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
        role="region"
        aria-labelledby={questionId}
        aria-hidden={!isOpen}
      >
        <div className="overflow-hidden">
          <p className="px-5 pb-5 text-sm leading-6 text-slate-600">{faq.answer}</p>
        </div>
      </div>
    </article>
  );
}

function BecomeTutorSection() {
  return (
    <Reveal as="section" id="become-a-tutor" className="bg-slate-950 py-16 text-white">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-gold">Join our team</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight">Passionate about maths? Teach with us.</h2>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            We are looking for talented mathematics tutors who want flexible work, proper operational support, and a learner-first teaching culture.
          </p>
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-white/10 p-6">
            <h3 className="text-xl font-semibold">Why tutor with us</h3>
            <StaggerReveal className="mt-5 grid gap-4 sm:grid-cols-2" staggerBy={0.08}>
              {tutorPerks.map(([title, description]) => (
                <article key={title} data-reveal-child className="rounded-lg border border-white/10 bg-slate-950/40 p-4">
                  <h4 className="font-semibold text-white">{title}</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
                </article>
              ))}
            </StaggerReveal>
          </div>
          <div className="rounded-lg border border-white/10 bg-white p-6 text-slate-950">
            <h3 className="text-xl font-semibold">What we look for</h3>
            <ul className="mt-5 grid gap-3 text-sm leading-6 text-slate-600">
              {tutorRequirements.map((requirement) => (
                <li key={requirement} className="rounded-lg bg-slate-50 px-4 py-3">
                  {requirement}
                </li>
              ))}
            </ul>
            <a
              className="mt-6 inline-flex w-full justify-center rounded-lg bg-brand-gold px-4 py-3 text-sm font-semibold text-brand-obsidian hover:bg-[#f7d24f]"
              href={`mailto:${contactEmail}?subject=${encodeURIComponent('Tutor Application - Project Odysseus')}`}
            >
              Apply now
            </a>
            <p className="mt-3 text-center text-xs leading-5 text-slate-500">Send a brief intro and CV. We aim to reply within 48 hours.</p>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

function EnquirySection() {
  const [form, setForm] = useState<EnquiryFormState>(initialEnquiryForm);
  const [status, setStatus] = useState<EnquiryStatus>({ tone: 'idle', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formspreeEndpoint = import.meta.env.VITE_PO_FORMSPREE_ENDPOINT as string | undefined;
  const hasFormspreeEndpoint = Boolean(formspreeEndpoint && !formspreeEndpoint.includes('YOUR_FORM_ID'));

  function updateField(field: keyof EnquiryFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function buildMailtoHref(details: EnquiryFormState) {
    const subject = 'Tutoring enquiry (React website form)';
    const body = [
      'Hi Project Odysseus,',
      '',
      'I would like help with maths tutoring.',
      '',
      `Name: ${details.name}`,
      `Email: ${details.email}`,
      details.grade ? `Grade: ${details.grade}` : '',
      details.message ? `Message: ${details.message}` : '',
      '',
      'Thanks!',
    ]
      .filter(Boolean)
      .join('\n');

    return `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function buildWhatsappHref(details: EnquiryFormState) {
    const message = `Hi Project Odysseus. My name is ${details.name || 'a learner/parent'}${
      details.grade ? ` for Grade ${details.grade}` : ''
    }. I would like help with maths tutoring.`;

    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  }

  function validateForm() {
    const name = form.name.trim();
    const email = form.email.trim();
    const message = form.message.trim();

    if (form.website.trim()) {
      return 'Spam protection blocked this submission.';
    }

    if (name.length < 2 || name.length > 80 || /<[^>]+>/.test(name)) {
      return 'Please enter a valid name.';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return 'Please enter a valid email address.';
    }

    if (!form.grade) {
      return "Please select the student's grade.";
    }

    if (/<[^>]+>/.test(message) || message.length > 2000) {
      return 'Please keep the message under 2000 characters and remove HTML.';
    }

    const lastSubmit = Number(window.sessionStorage.getItem(enquiryThrottleKey) || '0');
    if (Date.now() - lastSubmit < enquiryThrottleMs) {
      return 'Please wait a few seconds before submitting again.';
    }

    return '';
  }

  async function submitEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationMessage = validateForm();
    if (validationMessage) {
      setStatus({ tone: 'error', message: validationMessage });
      return;
    }

    const trimmedForm = {
      ...form,
      name: form.name.trim(),
      email: form.email.trim(),
      message: form.message.trim(),
    };

    setIsSubmitting(true);
    setStatus({ tone: 'info', message: 'Sending enquiry...' });
    window.sessionStorage.setItem(enquiryThrottleKey, String(Date.now()));

    try {
      if (!hasFormspreeEndpoint || !formspreeEndpoint) {
        window.location.href = buildMailtoHref(trimmedForm);
        setStatus({ tone: 'info', message: 'Opening your email app with the enquiry details.' });
        return;
      }

      const payload = new FormData();
      payload.set('name', trimmedForm.name);
      payload.set('email', trimmedForm.email);
      payload.set('grade', trimmedForm.grade);
      payload.set('message', trimmedForm.message);
      payload.set('form_type', 'react_public_enquiry');

      const response = await fetch(formspreeEndpoint, {
        method: 'POST',
        body: payload,
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Enquiry submission failed');
      }

      setForm(initialEnquiryForm);
      setStatus({ tone: 'success', message: "Thank you. We'll be in touch within 24 hours." });
    } catch {
      setStatus({
        tone: 'error',
        message: 'The form could not submit right now. Please use WhatsApp or email below.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Reveal as="section" id="enquiry" className="bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,1fr)_480px] lg:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold">Next step</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight">Start with a focused learner conversation.</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
            We tutor Monday to Thursday between 5pm and 8pm, with limited weekend slots. Tell us what support the learner needs and we will reply with the next practical step.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-400" href={buildWhatsappHref(form)} target="_blank" rel="noreferrer">
              WhatsApp us
            </a>
            <a className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10" href={`mailto:${contactEmail}`}>
              Email us
            </a>
            <Link className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10" to="/dashboard/login">
              Portal login
            </Link>
          </div>
        </div>
        <form className="rounded-lg border border-white/10 bg-white/10 p-5 backdrop-blur" aria-describedby="enquiry-helper" onSubmit={submitEnquiry}>
          <h3 className="text-xl font-semibold text-white">Quick enquiry</h3>
          <div className="hidden" aria-hidden="true">
            <label htmlFor="enquiry-website">Website</label>
            <input
              id="enquiry-website"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(event) => updateField('website', event.target.value)}
            />
          </div>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-1 text-sm font-medium text-slate-300" htmlFor="enquiry-name">
              Your name
              <input
                id="enquiry-name"
                name="name"
                type="text"
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
                aria-describedby="enquiry-helper enquiry-status"
                className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/40"
                placeholder="John Smith"
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-300" htmlFor="enquiry-email">
              Email address
              <input
                id="enquiry-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                aria-describedby="enquiry-helper enquiry-status"
                className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/40"
                placeholder="john@example.com"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-300" htmlFor="enquiry-grade">
              Student grade
              <select
                id="enquiry-grade"
                name="grade"
                required
                aria-describedby="enquiry-helper enquiry-status"
                className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/40"
                value={form.grade}
                onChange={(event) => updateField('grade', event.target.value)}
              >
                <option className="text-slate-950" value="">Select grade...</option>
                {['8', '9', '10', '11', '12'].map((grade) => (
                  <option className="text-slate-950" key={grade} value={grade}>
                    Grade {grade}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-300" htmlFor="enquiry-message">
              Message
              <textarea
                id="enquiry-message"
                name="message"
                rows={4}
                maxLength={2000}
                aria-describedby="enquiry-helper enquiry-status"
                className="resize-none rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/40"
                placeholder="Tell us about the learner's goals or current challenge."
                value={form.message}
                onChange={(event) => updateField('message', event.target.value)}
              />
            </label>
          </div>
          <p
            id="enquiry-status"
            className={
              status.message
                ? `mt-4 rounded-lg px-3 py-2 text-sm ${
                status.tone === 'success'
                  ? 'bg-green-500/15 text-green-200'
                  : status.tone === 'error'
                    ? 'bg-red-500/15 text-red-200'
                    : 'bg-sky-500/15 text-sky-200'
                  }`
                : 'sr-only'
            }
            role={status.tone === 'error' ? 'alert' : 'status'}
            aria-live="polite"
          >
            {status.message}
          </p>
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-5 w-full rounded-lg bg-brand-gold px-4 py-3 text-sm font-semibold text-brand-obsidian transition hover:bg-[#f7d24f] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Sending...' : 'Send enquiry'}
          </button>
          <p id="enquiry-helper" className="mt-3 text-xs leading-5 text-slate-400">
            We reply within 24 hours, Monday to Thursday. If direct submission is unavailable, we will open a pre-filled email for you.
          </p>
        </form>
      </div>
    </Reveal>
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

function LegalSection({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function SectionIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">{eyebrow}</p>
      <h2 className="greek-display mt-3 text-4xl font-semibold tracking-tight text-slate-950">{title}</h2>
      <p className="mt-4 text-sm leading-7 text-slate-600">{children}</p>
    </div>
  );
}
