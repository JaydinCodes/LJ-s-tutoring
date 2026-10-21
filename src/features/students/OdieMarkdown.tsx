import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const markdownComponents: Components = {
  a: ({ children, ...props }) => (
    <a {...props} className="font-semibold text-academy-aegean underline decoration-academy-aegean/35 underline-offset-4 hover:decoration-current dark:text-academy-gold" rel="noreferrer" target="_blank">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="my-4 max-w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
      <table className="my-0 min-w-[32rem] border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  h1: ({ children }) => <h1 className="mb-3 mt-6 font-display text-2xl font-semibold text-academy-navy dark:text-white">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-3 mt-6 font-display text-xl font-semibold text-academy-navy dark:text-white">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 mt-5 font-display text-lg font-semibold text-academy-navy dark:text-white">{children}</h3>,
  p: ({ children }) => <p className="my-3">{children}</p>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  strong: ({ children }) => <strong className="font-bold text-academy-navy dark:text-white">{children}</strong>,
  blockquote: ({ children }) => <blockquote className="my-4 border-l-2 border-academy-gold pl-4 text-slate-600 dark:text-slate-300">{children}</blockquote>,
  th: ({ children }) => <th className="border-b border-slate-200 bg-slate-50 px-3 py-2 font-bold text-academy-navy dark:border-white/10 dark:bg-white/[0.05] dark:text-white">{children}</th>,
  td: ({ children }) => <td className="border-b border-slate-100 px-3 py-2 align-top dark:border-white/5">{children}</td>,
  hr: () => <hr className="my-5 border-slate-200 dark:border-white/10" />,
};

export default function OdieMarkdown({ children }: { children: string }) {
  return <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>;
}
