import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { ActivityType, Discipline, Training, TrainingInput } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Alert, Button, Loading, PageHeader, SelectField, TextArea, TextField, useToast, buttonClass, cx } from '../components/ui';
import { ACTIVITY_OPTIONS, ENERGY_LABELS, localToday } from '../lib/format';
import { validateTraining, type FieldErrors } from '../lib/validation';

interface FormState {
  date: string; disciplineId: string; activityType: ActivityType; durationMinutes: string; intensity: number;
  energyLevel: number; restHours: string; hasDiscomfort: boolean; discomfortDescription: string; notes: string;
}

export default function TrainingForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [form, setForm] = useState<FormState>({
    date: localToday(), disciplineId: user?.mainDisciplineId ? String(user.mainDisciplineId) : '', activityType: 'CLASS',
    durationMinutes: '60', intensity: 5, energyLevel: 3, restHours: '', hasDiscomfort: false, discomfortDescription: '', notes: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [d, t] = await Promise.all([
          api.get<{ items: Discipline[] }>('/disciplines'),
          editing ? api.get<{ training: Training }>(`/trainings/${id}`) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        let list = d.items;
        if (t) {
          const x = t.training;
          if (!list.some((i) => i.id === x.disciplineId)) list = [...list, x.discipline]; // disciplina luego desactivada
          setForm({
            date: x.date, disciplineId: String(x.disciplineId), activityType: x.activityType, durationMinutes: String(x.durationMinutes),
            intensity: x.intensity, energyLevel: x.energyLevel, restHours: x.restHours === null ? '' : String(x.restHours),
            hasDiscomfort: x.hasDiscomfort, discomfortDescription: x.discomfortDescription ?? '', notes: x.notes ?? '',
          });
        }
        setDisciplines(list);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof ApiError ? e.message : 'No se pudo cargar el formulario.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [editing, id]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const payload = {
      date: form.date,
      disciplineId: form.disciplineId ? Number(form.disciplineId) : null,
      activityType: form.activityType,
      durationMinutes: form.durationMinutes === '' ? NaN : Number(form.durationMinutes),
      intensity: form.intensity,
      energyLevel: form.energyLevel,
      restHours: form.restHours === '' ? null : Number(form.restHours),
      hasDiscomfort: form.hasDiscomfort,
      discomfortDescription: form.hasDiscomfort && form.discomfortDescription.trim() ? form.discomfortDescription.trim() : null,
      notes: form.notes.trim() ? form.notes.trim() : null,
    };
    const errs = validateTraining(payload);
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length) { setFormError('Revisá los campos marcados.'); return; }
    setSaving(true);
    try {
      const body = payload as TrainingInput;
      if (editing) await api.put(`/trainings/${id}`, body);
      else await api.post('/trainings', body);
      toast('success', editing ? 'Entrenamiento actualizado.' : 'Entrenamiento guardado.');
      navigate('/entrenamientos');
    } catch (err) {
      if (err instanceof ApiError) { setErrors(err.fields ?? {}); setFormError(err.message); }
      else setFormError('No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading />;
  if (loadError) return <Alert>{loadError}</Alert>;

  return (
    <>
      <PageHeader title={editing ? 'Editar entrenamiento' : 'Registrar entrenamiento'} />
      <form onSubmit={submit} noValidate className="max-w-2xl space-y-5 surface p-5 sm:p-8">
        {formError && <Alert>{formError}</Alert>}

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Fecha" type="date" max={localToday()} value={form.date} onChange={(e) => set('date', e.target.value)} error={errors.date} />
          <SelectField label="Disciplina" value={form.disciplineId} onChange={(e) => set('disciplineId', e.target.value)} error={errors.disciplineId}>
            <option value="">Elegí una disciplina</option>
            {disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </SelectField>
          <SelectField label="Tipo de actividad" value={form.activityType} onChange={(e) => set('activityType', e.target.value as ActivityType)} error={errors.activityType}>
            {ACTIVITY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </SelectField>
          <TextField label="Duración (minutos)" type="number" inputMode="numeric" min={1} max={600} step={1} value={form.durationMinutes} onChange={(e) => set('durationMinutes', e.target.value)} error={errors.durationMinutes} />
        </div>

        <div>
          <label htmlFor="intensity" className="mb-1 block text-sm font-semibold">Intensidad percibida: <output htmlFor="intensity" className="text-wine-700">{form.intensity} / 10</output></label>
          <input id="intensity" type="range" min={1} max={10} step={1} value={form.intensity} onChange={(e) => set('intensity', Number(e.target.value))} className="w-full accent-wine-600" aria-describedby="intensity-hint" />
          <p id="intensity-hint" className="text-sm text-mute">1 = muy suave, 10 = máximo esfuerzo.</p>
          {errors.intensity && <p className="mt-1 text-sm font-medium text-red-800">{errors.intensity}</p>}
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Nivel de energía</legend>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className={cx('cursor-pointer rounded-lg border px-4 py-2 text-sm has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-wine-400', form.energyLevel === n ? 'border-wine-600 bg-wine-100 font-semibold text-wine-800' : 'border-field bg-card hover:border-wine-500')}>
                <input type="radio" name="energy" className="sr-only" checked={form.energyLevel === n} onChange={() => set('energyLevel', n)} />
                {n} · {ENERGY_LABELS[n]}
              </label>
            ))}
          </div>
          {errors.energyLevel && <p className="mt-1 text-sm font-medium text-red-800">{errors.energyLevel}</p>}
        </fieldset>

        <TextField label="Horas de descanso previas" optional type="number" inputMode="decimal" min={0} max={24} step={0.5} value={form.restHours} onChange={(e) => set('restHours', e.target.value)} error={errors.restHours} hint="Horas que dormiste o descansaste antes de entrenar." />

        <fieldset className="rounded-lg border border-line p-4">
          <legend className="px-1 text-sm font-semibold">Molestias y observaciones (privadas)</legend>
          <p className="mb-3 text-sm text-mute">Solo vos las ves. Podés autorizar a un profesor a verlas desde <Link to="/privacidad" className="font-semibold text-wine-700 underline">Privacidad</Link>.</p>
          <label className="mb-3 flex min-h-11 items-center gap-3 text-sm font-semibold">
            <input type="checkbox" className="size-5 accent-wine-600" checked={form.hasDiscomfort} onChange={(e) => set('hasDiscomfort', e.target.checked)} />
            Tuve molestias en esta sesión
          </label>
          {form.hasDiscomfort && (
            <div className="mb-4"><TextArea label="Descripción de la molestia" optional maxLength={500} value={form.discomfortDescription} onChange={(e) => set('discomfortDescription', e.target.value)} error={errors.discomfortDescription} /></div>
          )}
          <TextArea label="Observaciones personales" optional maxLength={2000} value={form.notes} onChange={(e) => set('notes', e.target.value)} error={errors.notes} />
        </fieldset>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={saving}>{editing ? 'Guardar cambios' : 'Guardar entrenamiento'}</Button>
          <Link to="/entrenamientos" className={buttonClass('ghost')}>Cancelar</Link>
        </div>
      </form>
    </>
  );
}
