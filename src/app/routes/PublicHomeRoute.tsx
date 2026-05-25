import { Link } from 'react-router-dom';

export function PublicHomeRoute() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto grid min-h-screen max-w-7xl content-center gap-10 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-teal-300">Project Odysseus LMS migration</p>
          <h1 className="mt-5 text-5xl font-semibold tracking-tight md:text-7xl">Maths support, tutoring operations, and learner progress in one platform.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            This React entry point is the migration target for the existing public site, student dashboard, admin console, tutor portal, and ProVision NGO rollout workflows.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="rounded-lg bg-amber-400 px-5 py-3 font-semibold text-slate-950" to="/dashboard/student">Student dashboard</Link>
            <Link className="rounded-lg border border-white/20 px-5 py-3 font-semibold text-white" to="/dashboard/admin">Admin dashboard</Link>
          </div>
        </div>
        <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
          {['Student Dashboard', 'Admin Dashboard', 'Assignments', 'Progress', 'Payments', 'NGO reporting'].map((item) => (
            <div key={item} className="rounded-xl border border-white/10 bg-slate-900/80 p-4 text-slate-200">{item}</div>
          ))}
        </div>
      </section>
    </main>
  );
}
