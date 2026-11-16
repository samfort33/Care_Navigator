import Link from 'next/link';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { LandingTriagePreview } from '@/components/triage/LandingTriagePreview';

const accessModes = [
  {
    icon: 'record_voice_over',
    title: 'Speak in your language, type, or share an image',
    body: 'Let people describe symptoms in their own words. Regional dialect recognition and image-based screening need clinical validation before use.',
    href: '/assessments/media-voice',
    action: 'Explore voice and image intake',
  },
  {
    icon: 'wifi_off',
    title: 'Design for weak connections',
    body: 'Keep the experience light and make connection state clear. Offline inference and store-and-forward are planned; this demo still needs internet for a live assessment.',
    href: '/assessments/new',
    action: 'See the assessment flow',
  },
  {
    icon: 'fact_check',
    title: 'Show the reason and the next step',
    body: 'Pair a preliminary urgency signal with the factors behind it, supporting guideline evidence, and a route to clinician review when needed.',
    href: '/assessments/CN-2026-8841/results',
    action: 'View an example result',
  },
];

const pathway = [
  {
    icon: 'forum',
    title: 'Describe what is happening',
    body: 'A guided intake captures symptoms, timing, and relevant context by text or voice.',
  },
  {
    icon: 'health_and_safety',
    title: 'Check for urgent warning signs',
    body: 'Safety rules surface red flags early. Emergency guidance stays visible throughout.',
  },
  {
    icon: 'menu_book',
    title: 'Explain the care suggestion',
    body: 'The result should show what information shaped the recommendation and which guidance supports it.',
  },
  {
    icon: 'clinical_notes',
    title: 'Connect with a person',
    body: 'Prepare a concise summary for follow-up, care navigation, or clinician review.',
  },
];

export default function LandingPage() {
  return (
    <div className="w-full">
      <div className="border-b border-error/20 bg-error-container/60 px-4 py-2.5 text-center text-sm text-on-error-container">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2">
          <MaterialIcon name="emergency" filled className="shrink-0 text-[18px] text-error" />
          <p>
            <strong>In an emergency, contact your local emergency service now.</strong> CareNavigator is decision support, not a substitute for emergency care or a clinician.
          </p>
        </div>
      </div>

      <section className="bg-surface py-12 sm:py-16 lg:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-8">
          <div className="space-y-6 lg:col-span-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-fixed/60 px-3 py-1.5 text-sm font-semibold text-on-primary-fixed">
              <MaterialIcon name="health_and_safety" className="text-[18px]" />
              Care guidance, with people in the loop
            </div>
            <h1 className="max-w-xl text-4xl font-bold leading-tight tracking-tight text-on-surface sm:text-5xl">
              Care that meets you where the signal fades.
            </h1>
            <p className="max-w-xl text-lg leading-8 text-on-surface-variant">
              Describe symptoms by voice, text, or image. Get a clear next step, see why it was suggested, and find a path to human care.
            </p>
            <div className="flex flex-col gap-3 pt-1 sm:flex-row">
              <Link href="/assessments/new" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary transition hover:bg-primary-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                Start a symptom assessment <MaterialIcon name="arrow_forward" className="text-[20px]" />
              </Link>
              <Link href="#how-it-works" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-5 py-3 font-semibold text-primary transition hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                How it works <MaterialIcon name="south" className="text-[18px]" />
              </Link>
            </div>
            <p className="flex items-start gap-2 text-sm leading-6 text-on-surface-variant">
              <MaterialIcon name="info" className="mt-0.5 shrink-0 text-[18px] text-primary" />
              <span>Preliminary guidance only. It does not diagnose. Seek a licensed clinician for medical advice.</span>
            </p>
          </div>
          <div className="lg:col-span-7">
            <LandingTriagePreview />
            <p className="mt-3 text-center text-xs text-on-surface-variant">Interactive example · synthetic scenario · not a live clinical assessment</p>
          </div>
        </div>
      </section>

      <section className="border-y border-outline-variant/30 bg-surface-container-low py-14 sm:py-18" aria-labelledby="access-title">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-9 max-w-3xl">
            <h2 id="access-title" className="text-3xl font-semibold leading-tight tracking-tight text-on-surface sm:text-4xl">Make the first step easier to reach.</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-on-surface-variant">CareAnywhere brings intake, safety checks, and care navigation into one clear flow—built around access barriers and honest about what the current demo supports.</p>
          </div>
          <div className="divide-y divide-outline-variant/50 border-y border-outline-variant/50">
            {accessModes.map((item, index) => (
              <article key={item.title} className="grid gap-3 py-6 sm:grid-cols-[3rem_1fr_1fr_auto] sm:items-start sm:gap-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container text-primary" aria-hidden="true"><MaterialIcon name={item.icon} className="text-[22px]" /></span>
                <h3 className="text-lg font-semibold text-on-surface">{item.title}</h3>
                <p className="max-w-xl text-sm leading-6 text-on-surface-variant">{item.body}</p>
                <Link href={item.href} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{item.action}<MaterialIcon name="arrow_forward" className="text-[16px]" /></Link>
                <span className="sr-only">Capability {index + 1}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-surface py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div>
              <h2 className="text-3xl font-semibold leading-tight tracking-tight text-on-surface sm:text-4xl">A clear path from concern to care.</h2>
              <p className="mt-4 max-w-lg leading-7 text-on-surface-variant">Each step should reduce uncertainty while keeping people—not a model—responsible for clinical decisions.</p>
              <Link href="/assessments/history" className="mt-6 inline-flex items-center gap-2 font-semibold text-primary hover:underline">See how clinician review works <MaterialIcon name="arrow_forward" className="text-[18px]" /></Link>
            </div>
            <ol className="divide-y divide-outline-variant/50 border-y border-outline-variant/50">
              {pathway.map((step, index) => (
                <li key={step.title} className="grid grid-cols-[2rem_2rem_1fr] gap-3 py-5 sm:grid-cols-[2.5rem_2.5rem_1fr] sm:gap-4">
                  <span className="pt-0.5 font-mono text-xs font-semibold text-primary">{String(index + 1).padStart(2, '0')}</span>
                  <MaterialIcon name={step.icon} className="text-[22px] text-primary" />
                  <div><h3 className="font-semibold text-on-surface">{step.title}</h3><p className="mt-1 text-sm leading-6 text-on-surface-variant">{step.body}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="bg-inverse-surface py-12 text-inverse-on-surface sm:py-16">
        <div className="mx-auto grid max-w-7xl gap-9 px-4 sm:px-6 lg:grid-cols-[1fr_1fr_auto] lg:items-center lg:px-8">
          <div>
            <h2 className="text-2xl font-semibold leading-tight sm:text-3xl">Grounded guidance. Accountable care.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-inverse-on-surface/80">The product direction pairs retrieval from trusted clinical guidance with deterministic safety checks and clinician review. The example on this page is synthetic; source coverage and local-language performance must be validated before clinical use. Measure access through assessment completion, referral follow-through, and time to care, broken down by language, connection quality, and location.</p>
          </div>
          <div className="space-y-3 text-sm">
            <p><strong>Guideline sources to validate:</strong> Merck Manuals and WHO guidance</p>
            <p><strong>Shared terminology:</strong> NLM MeSH</p>
            <p><strong>Access mapping:</strong> OpenStreetMap health locations</p>
          </div>
          <Link href="/admin/impact" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 font-semibold text-primary transition hover:bg-surface-container-low">Review access measures <MaterialIcon name="arrow_forward" className="text-[18px]" /></Link>
        </div>
        <div className="mx-auto mt-8 max-w-7xl border-t border-white/20 px-4 pt-5 text-xs leading-5 text-inverse-on-surface/75 sm:px-6 lg:px-8">
          MIMIC-IV and mortality or outbreak datasets are research inputs that require appropriate governance and validation. Their presence here does not mean they are connected to live triage.
        </div>
      </section>
    </div>
  );
}
