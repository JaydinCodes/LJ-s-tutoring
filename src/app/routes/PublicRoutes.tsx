import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
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
  {
    name: 'Logan Petrus', 
    focus: 'Data Handling, Financial Mathematics, Critical Thinking',
    image: '/images/logan-petrus.jpeg'
  }
];

const stats = [
  ['150+', 'Students helped'],
  ['500+', 'Sessions delivered'],
  ['Grade 8-12', 'CAPS Maths'],
  ['Cape Town', 'Online and local suFppport'],
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
const enquiryThrottleKey = 'po_react_enquiry_last_submit';
const enquiryThrottleMs = 30000;

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
      <section className="relative overflow-hidden bg-brand-navy text-white">
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-45"
          src="./images/e_b_e_bc_f_cb_b_mp_.mp4"
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,_rgba(8,19,38,0.96)_0%,_rgba(8,19,38,0.76)_48%,_rgba(8,19,38,0.28)_100%)]" />
        <div className="relative mx-auto flex min-h-[86svh] max-w-7xl flex-col justify-center px-6 py-20">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-amber-300">GRADE 8–12 CAPS TUTORING</p>
          <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-tight md:text-7xl">Project Odysseus</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-blue-50">
              Targeted CAPS support for Mathematics, Mathematical Literacy, and Physical Sciences, from core concepts to exam prep.
              We identify learning gaps, rebuild confidence, and keep every session focused on what each learner needs next.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a className="rounded-full bg-amber-400 px-5 py-3 font-semibold text-slate-950 shadow-lg shadow-amber-900/20 transition hover:bg-amber-300" href="#enquiry">Join Our Tutoring Programme</a>
            <a className="rounded-full border border-[#1F6F8B]/70 bg-[#1f6f8b] px-5 py-3 font-semibold text-slate-100 backdrop-blur transition hover:bg-[#1f6f8b]/20 hover:text-white" href="#tutors">Meet Our Tutors</a>
          </div>
          <div className="mt-10 grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map(([value, label]) => (
              <div key={label} className="rounded-[1.5rem] border border-white/15 bg-white/10 p-5 backdrop-blur">
                <p className="text-3xl font-semibold text-amber-300">{value}</p>
                <p className="mt-1 text-sm text-blue-50">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(135deg,_#eef6ff_0%,_#f8fafc_48%,_#fff8e6_100%)] py-16">
        <div className="mx-auto grid max-w-7xl gap-6 px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
          <div>
            <SectionIntro title="Tutoring that feels connected, not scattered" eyebrow="React LMS workflow">
              Students get direct maths support. Parents get clarity. Tutors get a review workflow. Admins get visibility. The public site now matches that same clean LMS identity.
            </SectionIntro>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                ['Diagnose gaps', 'Baseline weak topics and turn them into focused study goals.'],
                ['Assign focused work', 'Publish tasks, track submissions, and reduce homework ambiguity.'],
                ['Track progress', 'Surface marks, feedback, attendance, and momentum in one place.'],
              ].map(([title, description], index) => (
                <article key={title} className="rounded-[1.5rem] border border-white/80 bg-white/90 p-6 shadow-lg shadow-slate-200/60">
                  <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Step {index + 1}</p>
                  <h3 className="mt-3 text-xl font-semibold text-slate-950">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                </article>
              ))}
            </div>
          </div>
          <aside className="space-y-4">
            <div className="rounded-[1.5rem] bg-[linear-gradient(135deg,_#0f4db8_0%,_#1697df_100%)] p-5 text-white shadow-xl shadow-blue-900/20">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">Student snapshot</p>
              <h3 className="mt-3 text-2xl font-semibold">This week in Maths</h3>
              <div className="mt-5 grid gap-3">
                {[
                  ['Assignments due', '2 priority tasks'],
                  ['Latest result', '78% Algebra revision'],
                  ['Progress', 'Functions improving'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 rounded-2xl bg-white/12 px-4 py-3">
                    <span className="text-sm text-blue-50">{label}</span>
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
                <div key={title} className="rounded-2xl border border-white/80 bg-white/95 p-4 shadow-lg shadow-slate-200/50">
                  <p className="font-semibold text-slate-950">{title}</p>
                  <p className="mt-1 text-sm text-slate-600">{description}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
            <div>
              <SectionIntro title="Built for learners who need maths to make sense" eyebrow="Why families choose us">
                The work is practical: identify the gap, explain the method, practise under pressure, and make the next school task easier to face.
              </SectionIntro>
              <div className="mt-8 flex flex-wrap gap-3">
                <a className="rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white" href="#enquiry">Book a first conversation</a>
                <Link className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800" to="/guides/matric-maths-mistakes-guide">Read the matric guide</Link>
              </div>
            </div>
          
          </div>
        </div>
      </section>

      <TutorSection />
      <GuideSection />
      <FaqSection />
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
      <header className="sticky top-0 z-40 border-b border-white/70 bg-white/90 shadow-sm shadow-slate-200/60 backdrop-blur">
        <nav className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link className="flex items-center gap-3 text-lg font-semibold tracking-tight text-slate-950" to="/">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-navy text-sm font-bold text-white">PO</span>
            <span>Project Odysseus</span>
          </Link>
          <div className="flex items-center gap-1 text-sm font-semibold sm:gap-2">
            <Link className="rounded-full px-3 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950" to="/about">About</Link>
          

            <a className="hidden rounded-full px-3 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 sm:inline-flex" href="/#faq">FAQ</a>
            <a className="hidden rounded-full px-3 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 lg:inline-flex" href="/#become-a-tutor">Tutor with us</a>
            <Link className="rounded-full bg-brand-navy px-4 py-2 text-white shadow-sm transition hover:bg-blue-900" to="/dashboard/login">Student Login</Link>
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
    <section id="tutors" className="bg-slate-50 py-16">
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





function GuideSection() {
  return (
    <section className="bg-slate-50 py-16">
      <div className="mx-auto grid max-w-7xl gap-6 px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
        <SectionIntro title="Matric maths guide" eyebrow="Free resource">
          Keep the useful lead-magnet path alive during the migration. Learners can still open the guide while future downloads and follow-ups move into onboarding and reporting workflows.
        </SectionIntro>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-950">Common matric maths mistakes</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            A practical revision guide for avoiding avoidable marks lost in tests and exams.
          </p>
          <Link className="mt-5 inline-flex rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" to="/guides/matric-maths-mistakes-guide">
            Open guide
          </Link>
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section id="faq" className="bg-white py-16">
      <div className="mx-auto max-w-4xl px-6">
        <SectionIntro title="Frequently asked questions" eyebrow="Tutoring details">
          The core public-site answers are now available in React while the legacy landing page remains in the repository for comparison.
        </SectionIntro>
        <div className="mt-10 grid gap-3">
          {faqs.map((faq) => (
            <details key={faq.question} className="rounded-lg border border-slate-200 bg-slate-50 p-5">
              <summary className="cursor-pointer text-base font-semibold text-slate-950">{faq.question}</summary>
              <p className="mt-3 text-sm leading-6 text-slate-600">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function BecomeTutorSection() {
  return (
    <section id="become-a-tutor" className="bg-slate-950 py-16 text-white">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">Join our team</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight">Passionate about maths? Teach with us.</h2>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            We are looking for talented mathematics tutors who want flexible work, proper operational support, and a learner-first teaching culture.
          </p>
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-white/10 p-6">
            <h3 className="text-xl font-semibold">Why tutor with us</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {tutorPerks.map(([title, description]) => (
                <article key={title} className="rounded-lg border border-white/10 bg-slate-950/40 p-4">
                  <h4 className="font-semibold text-white">{title}</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
                </article>
              ))}
            </div>
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
              className="mt-6 inline-flex w-full justify-center rounded-lg bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-300"
              href={`mailto:${contactEmail}?subject=${encodeURIComponent('Tutor Application - Project Odysseus')}`}
            >
              Apply now
            </a>
            <p className="mt-3 text-center text-xs leading-5 text-slate-500">Send a brief intro and CV. We aim to reply within 48 hours.</p>
          </div>
        </div>
      </div>
    </section>
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
    <section id="enquiry" className="bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,1fr)_480px] lg:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-300">Next step</p>
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
        <form className="rounded-lg border border-white/10 bg-white/10 p-5 backdrop-blur" onSubmit={submitEnquiry}>
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
                className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300 focus:ring-2 focus:ring-amber-300/40"
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
                className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300 focus:ring-2 focus:ring-amber-300/40"
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
                className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-300/40"
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
                className="resize-none rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300 focus:ring-2 focus:ring-amber-300/40"
                placeholder="Tell us about the learner's goals or current challenge."
                value={form.message}
                onChange={(event) => updateField('message', event.target.value)}
              />
            </label>
          </div>
          {status.message ? (
            <p
              className={`mt-4 rounded-lg px-3 py-2 text-sm ${
                status.tone === 'success'
                  ? 'bg-green-500/15 text-green-200'
                  : status.tone === 'error'
                    ? 'bg-red-500/15 text-red-200'
                    : 'bg-sky-500/15 text-sky-200'
              }`}
            >
              {status.message}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-5 w-full rounded-lg bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Sending...' : 'Send enquiry'}
          </button>
          {!hasFormspreeEndpoint ? (
            <p className="mt-3 text-xs leading-5 text-slate-400">
              Configure `VITE_PO_FORMSPREE_ENDPOINT` to submit directly from this React form. Until then, it opens a pre-filled email.
            </p>
          ) : null}
        </form>
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
