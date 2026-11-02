import { useEffect, useId, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { Role } from '../api/types';
import { homePathFor, useAuth } from '../auth/AuthContext';
import { ROLE_LABELS } from '../lib/format';
import { Button, cx } from './ui';

export function Logo({ light }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap font-display text-base font-semibold min-[400px]:text-lg sm:text-xl">
      <svg viewBox="0 0 32 32" className="size-6 shrink-0 sm:size-7" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill={light ? '#fff' : '#85324A'} />
        <path d="M7 22c6-1 6-12 11-12s3 9 7 9" fill="none" stroke={light ? '#85324A' : '#fff'} strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      DanceTrack
    </span>
  );
}

// `account`: si está definido, es una opción de cuenta. En escritorio (≥1024 px) se muestra en el desplegable
// de la cuenta (ordenada por este número); en tablet y móvil sigue en la lista principal, como en la versión 2.
interface NavItem { to: string; label: string; isActive: (path: string) => boolean; account?: number }

const exact = (to: string) => (path: string) => path === to;
const PROFILE: NavItem = { to: '/perfil', label: 'Perfil', isActive: exact('/perfil'), account: 0 };
const PRIVACY: NavItem = { to: '/privacidad', label: 'Privacidad', isActive: exact('/privacidad'), account: 1 };

// Mismas opciones y rutas de siempre. Solo cambia cómo se decide cuál está activa:
// "Historial" también lo está al editar un registro; "Mis bailarines" y "Administración" en sus subpáginas.
const NAV: Record<Role, NavItem[]> = {
  DANCER: [
    { to: '/panel', label: 'Panel', isActive: exact('/panel') },
    { to: '/entrenamientos', label: 'Historial', isActive: (p) => p === '/entrenamientos' || /^\/entrenamientos\/[^/]+\/editar$/.test(p) },
    { to: '/entrenamientos/nuevo', label: 'Registrar', isActive: exact('/entrenamientos/nuevo') },
    PRIVACY,
    PROFILE,
  ],
  TEACHER: [{ to: '/profesor', label: 'Mis bailarines', isActive: (p) => p === '/profesor' || p.startsWith('/profesor/') }, PROFILE],
  ADMIN: [{ to: '/admin', label: 'Administración', isActive: (p) => p === '/admin' || p.startsWith('/admin/') }, PROFILE],
};

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      {open ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className={cx('size-4 shrink-0 text-wine-700 transition-transform', open && 'rotate-180')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 8l5 5 5-5" />
    </svg>
  );
}

/**
 * Desplegable de la cuenta (solo escritorio). Patrón "disclosure": el botón abre una lista de enlaces y
 * una acción. Teclado: Enter/Espacio abren; ↓ abre y enfoca la primera opción; ↑/↓/Inicio/Fin recorren;
 * Esc cierra y devuelve el foco al botón; Tab fuera, clic fuera o navegar también lo cierran.
 */
function AccountMenu({ name, roleLabel, items, pathname, onLogout }: {
  name: string; roleLabel: string; items: NavItem[]; pathname: string; onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const accountActive = items.some((i) => i.isActive(pathname));

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const entries = () => Array.from(wrapRef.current?.querySelectorAll<HTMLElement>('[data-account-item]') ?? []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    if (!open) { setOpen(true); requestAnimationFrame(() => entries()[0]?.focus()); return; }
    const list = entries();
    const i = list.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : e.key === 'ArrowDown' ? (i + 1) % list.length : (i <= 0 ? list.length - 1 : i - 1);
    list[next]?.focus();
  }

  const itemCls = 'flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-semibold transition-colors';

  return (
    <div
      ref={wrapRef}
      className="relative hidden lg:col-start-3 lg:row-start-1 lg:block"
      onKeyDown={onKeyDown}
      onBlur={(e) => { if (open && !wrapRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false); }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          'flex min-h-11 items-center gap-3 rounded-lg border px-3 py-1 text-left transition-colors hover:bg-wine-50',
          open || accountActive ? 'border-wine-300 bg-wine-100' : 'border-wine-200 bg-card',
        )}
      >
        <span className="block min-w-0 leading-tight">
          <span className="block max-w-[12rem] truncate text-sm font-semibold">{name}</span>
          <span className="block text-xs text-mute">{roleLabel}</span>
        </span>
        <Chevron open={open} />
      </button>

      {open && (
        <div id={panelId} className="absolute right-0 top-full z-40 mt-2 w-60 rounded-xl border border-line bg-card p-1.5 shadow-md">
          <ul>
            {items.map((i) => {
              const active = i.isActive(pathname);
              return (
                <li key={i.to}>
                  <Link to={i.to} data-account-item aria-current={active ? 'page' : undefined} className={cx(itemCls, active ? 'bg-wine-100 text-wine-800' : 'text-ink hover:bg-wine-50')}>
                    {i.label}
                  </Link>
                </li>
              );
            })}
            <li className="mt-1 border-t border-line pt-1">
              <button type="button" data-account-item onClick={onLogout} className={cx(itemCls, 'text-ink hover:bg-wine-50')}>Cerrar sesión</button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

/*
  Header en grilla de una sola estructura HTML:
  - móvil (<768):   [logo ........ Menú]  y, desplegado, enlaces apilados + usuario/cerrar sesión
  - tablet (768+):  [logo ......... usuario · Cerrar sesión]  /  fila propia con los enlaces
  - escritorio (1024+): [logo ........ enlaces principales · botón de cuenta ▾] en una sola fila,
                        enlaces alineados a la derecha; Perfil, Privacidad y Cerrar sesión van en el desplegable
*/
export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!user) return null;
  const links = NAV[user.role];
  const accountItems = links.filter((l) => l.account !== undefined).sort((a, b) => (a.account ?? 0) - (b.account ?? 0));
  const doLogout = async () => { await logout(); navigate('/'); };

  return (
    <div className="min-h-screen">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-card focus:px-3 focus:py-2">Saltar al contenido</a>
      <header className="border-b border-t-[3px] border-line border-t-wine-700 bg-card">
        <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-center gap-x-4 px-4 md:grid-cols-[auto_1fr_auto] md:px-6 lg:gap-x-8">
          <Link to={homePathFor(user.role)} aria-label="DanceTrack, ir al inicio" className="col-start-1 row-start-1 justify-self-start py-3">
            <Logo />
          </Link>

          <button
            type="button"
            className="col-start-2 row-start-1 inline-flex min-h-11 items-center gap-2 rounded-lg border border-wine-200 bg-card px-3 text-sm font-semibold text-wine-700 hover:bg-wine-50 md:hidden"
            aria-expanded={open}
            aria-controls="menu-principal"
            onClick={() => setOpen((o) => !o)}
          >
            <MenuIcon open={open} />
            Menú
          </button>

          <nav
            id="menu-principal"
            aria-label="Principal"
            className={cx(
              'col-span-full row-start-2 border-t border-line py-2 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:justify-self-end lg:border-t-0 lg:py-0',
              open ? 'block' : 'hidden md:block',
            )}
          >
            <ul className="flex flex-col gap-1 md:flex-row md:flex-wrap">
              {links.map((l) => {
                const active = l.isActive(pathname);
                return (
                  <li key={l.to} className={cx(l.account !== undefined && 'lg:hidden')}>
                    <Link
                      to={l.to}
                      aria-current={active ? 'page' : undefined}
                      className={cx(
                        'flex min-h-11 items-center whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-colors',
                        active ? 'bg-wine-100 text-wine-800' : 'text-ink hover:bg-wine-50',
                      )}
                    >
                      {l.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div
            className={cx(
              'col-span-full row-start-3 items-center justify-between gap-4 border-t border-line py-3 md:col-span-1 md:col-start-3 md:row-start-1 md:justify-end md:border-t-0',
              open ? 'flex' : 'hidden md:flex',
              'lg:hidden',
            )}
          >
            <p className="min-w-0 leading-tight md:text-right">
              <span className="block max-w-[14rem] truncate text-sm font-semibold">{user.name}</span>
              <span className="block text-xs text-mute">{ROLE_LABELS[user.role]}</span>
            </p>
            <Button variant="secondary" className="shrink-0" onClick={doLogout}>Cerrar sesión</Button>
          </div>

          <AccountMenu name={user.name} roleLabel={ROLE_LABELS[user.role]} items={accountItems} pathname={pathname} onLogout={doLogout} />
        </div>
      </header>
      <main id="contenido" className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10"><Outlet /></main>
    </div>
  );
}
