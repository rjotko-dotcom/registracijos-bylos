import { brandPaths } from '../brandPaths'
import { Icon } from './Icon'

interface BrandLogoProps {
  brand: string
}

const ALIASES: Record<string, string> = {
  vw: 'volkswagen',
  dsautomobiles: 'ds',
}

function normalizeBrand(brand: string): string {
  const key = brand
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Škoda → skoda, Citroën → citroen
    .replace(/[^a-z]/g, '')
  return ALIASES[key] ?? key
}

export function BrandLogo({ brand }: BrandLogoProps) {
  const path = brandPaths[normalizeBrand(brand)]
  return (
    <div className="brand-logo" aria-label={brand} title={brand}>
      {path ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d={path} fill="currentColor" />
        </svg>
      ) : (
        <Icon name="car" size={22} strokeWidth={1.8} />
      )}
    </div>
  )
}
