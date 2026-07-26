import { brandPaths } from '../brandPaths'

interface BrandLogoProps {
  brand: string
  size?: number
}

const ALIASES: Record<string, string> = {
  vw: 'volkswagen',
  dsautomobiles: 'ds',
  mercedesbenz: 'mercedes',
}

function normalizeBrand(brand: string): string {
  const key = brand
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Škoda → skoda, Citroën → citroen
    .replace(/[^a-z]/g, '')
  return ALIASES[key] ?? key
}

function FallbackCarLogo() {
  return (
    <svg viewBox="0 0 48 48" fill="none">
      <path
        d="M10 28l2.5-7a3 3 0 0 1 2.8-2h17.4a3 3 0 0 1 2.8 2l2.5 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="7" y="27" width="34" height="8" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="14" cy="31" r="1.6" fill="currentColor" />
      <circle cx="34" cy="31" r="1.6" fill="currentColor" />
    </svg>
  )
}

export function BrandLogo({ brand }: BrandLogoProps) {
  const path = brandPaths[normalizeBrand(brand)]
  return (
    <div className="brand-logo" aria-label={brand} title={brand}>
      {path ? (
        <svg viewBox="0 0 24 24">
          <path d={path} fill="currentColor" />
        </svg>
      ) : (
        <FallbackCarLogo />
      )}
    </div>
  )
}
