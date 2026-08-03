import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { captureAppMessage } from '../../lib/monitoring/errorReporting';

export function NotFoundRoute() {
  const location = useLocation();

  useEffect(() => {
    captureAppMessage('not_found_route', {
      featureArea: 'routing',
      action: 'not_found',
      route: location.pathname,
    });
  }, [location.pathname]);

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,_rgba(31,111,139,0.22),_transparent_35%),linear-gradient(180deg,_#071326_0%,_#0f172a_100%)] px-4 py-12 text-white" data-page-status="not-found">
      <section className="w-full max-w-2xl rounded-[2rem] border border-white/[0.15] bg-white/10 p-6 text-center shadow-[0_30px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-10" aria-labelledby="not-found-title">
        <Link className="mx-auto inline-flex items-center gap-3 rounded-full px-3 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold" to="/">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-sm font-bold text-brand-navy">PO</span>
          Project Odysseus
        </Link>
        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.28em] text-brand-gold">404 · Off course</p>
        <h1 id="not-found-title" className="greek-display mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">Page not found</h1>
        <p className="mx-auto mt-5 max-w-lg text-sm leading-7 text-slate-200 sm:text-base">
          We could not find <span className="break-all font-semibold text-white">{location.pathname}</span>. The link may be outdated, or the page may have moved.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand-gold px-5 py-3 text-sm font-semibold text-brand-obsidian transition hover:bg-[#f7d24f]" to="/">
            Return home
          </Link>
          <Link className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.15]" to="/programs">
            View tutoring programmes
          </Link>
        </div>
      </section>
    </main>
  );
}
