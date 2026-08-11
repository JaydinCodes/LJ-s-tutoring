import { useEffect, useState } from 'react';
import { FormField, TextInput } from '../../components/ui/FormField';
import { parseCriteria, serializeCriteria, type TeachingCriterion } from './learningEvidence';

const blankCriterion = (): TeachingCriterion => ({ id: '', label: '', maxMarks: 10, topic: '', cognitiveLevel: 'Routine Procedure', description: '' });

export function RubricBuilder({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [criteria, setCriteria] = useState<TeachingCriterion[]>(() => parseCriteria(safeJson(value)));
  useEffect(() => { setCriteria(parseCriteria(safeJson(value))); }, [value]);
  function update(next: TeachingCriterion[]) { setCriteria(next); onChange(serializeCriteria(next)); }
  return <fieldset className="rounded-lg border border-slate-200 bg-slate-50 p-4" data-storage-format="Rubric JSON">
    <legend className="px-1 text-sm font-semibold text-slate-900">Success criteria</legend>
    <p className="mb-3 text-sm text-slate-600">Use plain teaching language. Each row can connect evidence to a CAPS topic and thinking level.</p>
    <div className="space-y-3">
      {criteria.map((criterion, index) => <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-2" key={`${criterion.id}-${index}`}>
        <FormField label="Criterion"><TextInput value={criterion.label} onChange={(event) => update(criteria.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} placeholder="Show a clear method" /></FormField>
        <FormField label="Marks"><TextInput type="number" min="1" value={String(criterion.maxMarks)} onChange={(event) => update(criteria.map((item, itemIndex) => itemIndex === index ? { ...item, maxMarks: Number(event.target.value) } : item))} /></FormField>
        <FormField label="CAPS topic"><TextInput value={criterion.topic || ''} onChange={(event) => update(criteria.map((item, itemIndex) => itemIndex === index ? { ...item, topic: event.target.value } : item))} placeholder="Factorisation" /></FormField>
        <FormField label="Thinking level"><select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" value={criterion.cognitiveLevel || ''} onChange={(event) => update(criteria.map((item, itemIndex) => itemIndex === index ? { ...item, cognitiveLevel: event.target.value } : item))}><option>Knowledge</option><option>Routine Procedure</option><option>Complex Procedure</option><option>Problem Solving</option></select></FormField>
        <button className="justify-self-start text-sm font-semibold text-rose-700" type="button" onClick={() => update(criteria.filter((_, itemIndex) => itemIndex !== index))}>Remove criterion</button>
      </div>)}
    </div>
    <button className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800" type="button" onClick={() => update([...criteria, blankCriterion()])}>Add criterion</button>
  </fieldset>;
}

function safeJson(value: string) { try { return JSON.parse(value); } catch { return []; } }
