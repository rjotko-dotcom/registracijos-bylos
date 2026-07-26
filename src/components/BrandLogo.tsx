interface BrandLogoProps {
  brand: string
  size?: number
}

function NissanLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="15" stroke="currentColor" strokeWidth="2" />
      <rect x="6" y="21.4" width="36" height="5.2" rx="1" fill="var(--card-bg, #10151f)" />
      <text
        x="24"
        y="26.4"
        textAnchor="middle"
        fill="currentColor"
        fontSize="7.5"
        fontWeight="700"
        fontFamily="inherit"
        letterSpacing="0.5"
      >
        NISSAN
      </text>
    </svg>
  )
}

function HyundaiLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <ellipse cx="24" cy="24" rx="17" ry="11" stroke="currentColor" strokeWidth="2" />
      <path
        d="M20.5 30.5 24 17.5M31 30.5l3.5-13M21.5 24.5h10"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CitroenLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <path
        d="M10 20 24 10l14 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 32 24 22l14 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ToyotaLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <ellipse cx="24" cy="24" rx="17" ry="11" stroke="currentColor" strokeWidth="2" />
      <ellipse cx="24" cy="24" rx="7" ry="11" stroke="currentColor" strokeWidth="2" />
      <ellipse cx="24" cy="19" rx="14" ry="4.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function FallbackCarLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
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

export function BrandLogo({ brand, size = 30 }: BrandLogoProps) {
  const key = brand.trim().toLowerCase()
  let logo
  switch (key) {
    case 'nissan':
      logo = <NissanLogo size={size} />
      break
    case 'hyundai':
      logo = <HyundaiLogo size={size} />
      break
    case 'citroen':
    case 'citroën':
      logo = <CitroenLogo size={size} />
      break
    case 'toyota':
      logo = <ToyotaLogo size={size} />
      break
    default:
      logo = <FallbackCarLogo size={size} />
  }
  return (
    <div className="brand-logo" aria-label={brand} title={brand}>
      {logo}
    </div>
  )
}
