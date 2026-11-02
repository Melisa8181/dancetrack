import { Link, Navigate } from 'react-router-dom';
import { homePathFor, useAuth } from '../auth/AuthContext';
import { Logo } from '../components/Layout';
import { cx } from '../components/ui';

// Fotografía de portada: archivo LOCAL `src/assets/hero/portada.(jpg|jpeg|webp|avif|png)`.
// Vite la incluye en el build; si el archivo no existe, la portada es la original (con el trazo decorativo).
// Origen y licencia de la fotografía: ver `src/assets/hero/LEEME.md`.
const heroFiles = import.meta.glob('../assets/hero/portada.{jpg,jpeg,webp,avif,png}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const heroPhoto: string | undefined = Object.values(heroFiles)[0];

export default function Landing() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to={homePathFor(user.role)} replace />;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-2 gap-y-1 px-4 py-5">
        <Logo />
        <nav aria-label="Acceso" className="flex items-center gap-0.5 sm:gap-2">
          <Link to="/ingresar" className="whitespace-nowrap rounded-lg px-2 py-2 text-sm font-semibold text-wine-700 hover:bg-wine-50 sm:px-4">Iniciar sesión</Link>
          <Link to="/registro" className="whitespace-nowrap rounded-lg bg-wine-600 px-2.5 py-2 text-sm font-semibold text-white hover:bg-wine-700 sm:px-4">Crear cuenta</Link>
        </nav>
      </header>

      <main>
        <section className={cx('relative overflow-hidden', heroPhoto && 'bg-wine-800')}>
          {!heroPhoto && (
            <>
              {/* Línea curva decorativa: un arabesco trazado de una sola pasada */}
              <svg aria-hidden="true" viewBox="0 0 800 400" className="pointer-events-none absolute -right-24 top-0 h-full w-[60rem] max-w-none text-clay-200" preserveAspectRatio="xMaxYMid slice">
                <path d="M20 340C180 320 230 90 380 90s150 190 260 170c60-10 100-90 140-120" fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="round" />
              </svg>
            </>
          )}
          <div className={heroPhoto
            ? 'relative mx-auto flex max-w-6xl flex-col px-4 pt-16 sm:pt-20 md:min-h-[34rem] md:justify-center md:py-16 lg:min-h-[44rem]'
            : 'relative mx-auto max-w-6xl px-4 pb-24 pt-16 sm:pt-24'}>
            {heroPhoto && (
              /*
                Fotografía vertical (2:3): se muestra COMPLETA, ajustada al alto disponible, sin recorte ni deformación.
                En escritorio y tablet ocupa la columna derecha; en móvil va debajo del texto.
                `mix-blend-screen` hace que el negro de la foto adopte el bordó del fondo (y de la luz de escenario
                del degradado), mientras el vestido blanco se conserva; así no se ve ningún rectángulo ni borde.
              */
              <div
                aria-hidden="true"
                className="order-last mt-8 flex h-[30rem] items-center justify-center md:absolute md:inset-y-0 md:right-0 md:order-none md:mt-0 md:h-auto md:w-[46%]"
                style={{ backgroundImage: 'radial-gradient(ellipse 62% 54% at 50% 44%, rgb(133 50 74 / 0.6), transparent 78%)' }}
              >
                <img
                  src={heroPhoto}
                  alt=""
                  width={1714}
                  height={2576}
                  decoding="async"
                  fetchPriority="high"
                  className="h-auto max-h-full w-auto max-w-full mix-blend-screen"
                  style={{
                    // Bordes difuminados: el casi-negro de la foto no deja un rectángulo visible sobre el bordó.
                    maskImage: 'linear-gradient(to right, transparent, #000 14%, #000 86%, transparent), linear-gradient(to bottom, transparent, #000 4%, #000 88%, transparent)',
                    maskComposite: 'intersect',
                    WebkitMaskComposite: 'source-in',
                  }}
                />
              </div>
            )}
            <div className={heroPhoto ? 'relative md:w-[54%]' : undefined}>
              <h1 className={heroPhoto ? 'text-5xl leading-[1.05] text-white sm:text-6xl lg:text-7xl' : 'max-w-3xl text-5xl leading-[1.05] sm:text-7xl'}>Cada clase y cada ensayo, en un solo lugar.</h1>
              <p className={cx('mt-6 max-w-xl text-lg', heroPhoto ? 'text-wine-50' : 'text-mute')}>
                DanceTrack te ayuda a registrar cuánto entrenás, con qué intensidad y cómo llegás a cada sesión, para que veas tu semana de un vistazo.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/registro" className={cx('rounded-lg bg-wine-600 px-6 py-3 font-semibold text-white hover:bg-wine-700', heroPhoto && 'ring-1 ring-white/30')}>Empezar a registrar</Link>
                <Link to="/ingresar" className="rounded-lg border border-wine-200 bg-card px-6 py-3 font-semibold text-wine-700 hover:bg-wine-50">Ya tengo cuenta</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-line bg-card">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-3">
            <div>
              <h2 className="text-2xl">Registrás</h2>
              <p className="mt-2 text-mute">Fecha, disciplina, tipo de actividad, duración, intensidad percibida, energía y descanso previo. Si hubo molestias o algo para recordar, lo anotás aparte.</p>
            </div>
            <div>
              <h2 className="text-2xl">Visualizás</h2>
              <p className="mt-2 text-mute">Sesiones de la semana, tiempo total, intensidad promedio y actividad por día, calculados con tus propios registros y comparados con la semana anterior.</p>
            </div>
            <div>
              <h2 className="text-2xl">Decidís qué compartir</h2>
              <p className="mt-2 text-mute">Tus profesores solo ven lo que les autorices. Las molestias y las observaciones son privadas hasta que vos decidas lo contrario.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-6 text-sm text-mute">
          DanceTrack es una herramienta de registro personal. No es una aplicación médica: no diagnostica lesiones ni ofrece recomendaciones de salud.
        </p>
      </footer>
    </div>
  );
}
