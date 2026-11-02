import {
  createContext, useCallback, useContext, useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

// ---------- Botones
type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-wine-600 text-white hover:bg-wine-700 disabled:bg-wine-300',
  secondary: 'bg-card text-wine-700 border border-wine-200 hover:bg-wine-50 disabled:text-mute',
  danger: 'bg-card text-red-800 border border-red-300 hover:bg-red-50 disabled:text-mute',
  ghost: 'text-wine-700 hover:bg-wine-100',
};

/**
 * Clases de botón para usar también en <Link>: mismo tamaño, radio y tipografía que <Button>.
 * Si `extra` define su propio alto, padding o tamaño de texto, se omite el valor base correspondiente
 * (en Tailwind el orden de las clases en el HTML no decide cuál gana, así que no pueden convivir).
 */
export const buttonClass = (variant: Variant = 'primary', extra = '') =>
  cx(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg py-2 font-semibold transition-colors disabled:cursor-not-allowed',
    !/(^|\s)min-h-/.test(extra) && 'min-h-11',
    !/(^|\s)px-/.test(extra) && 'px-4',
    !/(^|\s)text-(sm|base|lg)/.test(extra) && 'text-sm',
    VARIANTS[variant],
    extra,
  );

export function Button({ variant = 'primary', loading, className, children, disabled, type = 'button', ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, className)}
      {...rest}
    >
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />}
      {children}
    </button>
  );
}

// ---------- Campos de formulario (siempre con etiqueta visible y error asociado)
interface FieldShell { label: string; error?: string; hint?: string; optional?: boolean }

function Shell({ id, label, error, hint, optional, children }: FieldShell & { id: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">
        {label}
        {optional && <span className="ml-1 font-normal text-mute">(opcional)</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-sm text-mute">{hint}</p>}
      {error && <p id={`${id}-err`} className="mt-1 text-sm font-medium text-red-800">{error}</p>}
    </div>
  );
}

const inputCls = (error?: string) =>
  cx('block min-h-11 w-full rounded-lg border bg-card px-3 py-2 text-base placeholder:text-mute/70', error ? 'border-red-600' : 'border-field hover:border-wine-500');

const describe = (id: string, e?: string, h?: string) => (e ? `${id}-err` : h ? `${id}-hint` : undefined);

export function TextField({ label, error, hint, optional, className, ...rest }: FieldShell & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Shell id={id} label={label} error={error} hint={hint} optional={optional}>
      <input id={id} aria-invalid={!!error || undefined} aria-describedby={describe(id, error, hint)} className={cx(inputCls(error), className)} {...rest} />
    </Shell>
  );
}

export function TextArea({ label, error, hint, optional, ...rest }: FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Shell id={id} label={label} error={error} hint={hint} optional={optional}>
      <textarea id={id} rows={3} aria-invalid={!!error || undefined} aria-describedby={describe(id, error, hint)} className={inputCls(error)} {...rest} />
    </Shell>
  );
}

export function SelectField({ label, error, hint, optional, children, ...rest }: FieldShell & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Shell id={id} label={label} error={error} hint={hint} optional={optional}>
      <select id={id} aria-invalid={!!error || undefined} aria-describedby={describe(id, error, hint)} className={inputCls(error)} {...rest}>{children}</select>
    </Shell>
  );
}

// ---------- Mensajes y estados
export function Alert({ kind = 'error', children }: { kind?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const styles = { error: 'border-red-300 bg-red-50 text-red-900', success: 'border-green-300 bg-green-50 text-green-900', info: 'border-wine-200 bg-wine-50 text-wine-800' };
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={cx('rounded-lg border px-4 py-3 text-sm', styles[kind])}>{children}</div>
  );
}

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-mute">
      <span className="size-5 animate-spin rounded-full border-2 border-wine-400 border-t-transparent" aria-hidden="true" />
      {label}
    </div>
  );
}

/** Trazo con tres puntos: eco del logotipo y de los patrones de piso de la coreografía. */
function PathMark() {
  return (
    <svg viewBox="0 0 96 40" className="mx-auto mb-4 h-10 w-24 text-clay-400" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 30C22 30 24 8 42 8s14 22 30 22c8 0 14-6 18-12" />
      <circle cx="6" cy="30" r="3.5" fill="currentColor" stroke="none" />
      <circle cx="42" cy="8" r="3.5" fill="currentColor" stroke="none" />
      <circle cx="90" cy="18" r="5" className="fill-card" />
    </svg>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-clay-300 bg-clay-50 px-6 py-10 text-center sm:py-12">
      <PathMark />
      <h3 className="text-xl">{title}</h3>
      {children && <p className="mx-auto mt-2 max-w-md text-mute">{children}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 sm:mb-8">
      <div className="min-w-0">
        <h1 className="text-3xl text-wine-800 sm:text-4xl">{title}</h1>
        {children && <p className="mt-1 max-w-prose text-mute">{children}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'wine' | 'ok' | 'warn'; children: ReactNode }) {
  const t = { neutral: 'bg-sand text-stone-700', wine: 'bg-wine-100 text-wine-800', ok: 'bg-green-100 text-green-900', warn: 'bg-clay-100 text-clay-800' };
  return <span className={cx('inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold', t[tone])}>{children}</span>;
}

// ---------- Confirmación (usa <dialog> nativo: foco atrapado, Esc para cerrar)
export function ConfirmDialog({ open, title, children, confirmLabel, danger, loading, onConfirm, onCancel }: {
  open: boolean; title: string; children: ReactNode; confirmLabel: string; danger?: boolean; loading?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onCancel={(e) => { e.preventDefault(); if (!loading) onCancel(); }} aria-labelledby={titleId}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-line bg-card p-6 text-ink shadow-lg">
      <h2 id={titleId} className="text-xl">{title}</h2>
      <div className="mt-2 text-mute">{children}</div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>Cancelar</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </dialog>
  );
}

// ---------- Notificaciones (mensajes de éxito/error)
interface Toast { id: number; kind: 'success' | 'error'; text: string }
const ToastCtx = createContext<(kind: Toast['kind'], text: string) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, kind, text }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 5000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-96">
        {items.map((t) => (
          <div key={t.id} className={cx('w-full rounded-lg border px-4 py-3 text-sm font-medium shadow-md', t.kind === 'success' ? 'border-green-300 bg-green-50 text-green-900' : 'border-red-300 bg-red-50 text-red-900')}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export { cx };
