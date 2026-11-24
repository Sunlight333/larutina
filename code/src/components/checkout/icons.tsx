// Purchase icons in the site's set: one 24px grid, 1.7 stroke, round caps
// (components/icons.tsx). Only what the cart, checkout and order pages need.
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 22, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={`${size / 16}rem`}
      height={`${size / 16}rem`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export const Truck = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 6.5h10.5v9.5H3z" />
    <path d="M13.5 9.5h3.8l3.2 3.4V16h-7" />
    <circle cx="7" cy="17.5" r="1.8" />
    <circle cx="17" cy="17.5" r="1.8" />
  </Icon>
)

export const Card = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
    <path d="M3 10h18M7 15h3" />
  </Icon>
)

export const Bank = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 9.5L12 4.5l8.5 5" />
    <path d="M5.5 10v7M10 10v7M14 10v7M18.5 10v7M3.5 19.5h17" />
  </Icon>
)

export const Tag = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 12.2V4.5a1 1 0 011-1h7.7l8.3 8.3a1.5 1.5 0 010 2.1l-6.6 6.6a1.5 1.5 0 01-2.1 0z" />
    <circle cx="8" cy="8" r="1.4" />
  </Icon>
)

export const Copy = (p: IconProps) => (
  <Icon {...p}>
    <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.5" />
    <path d="M15.5 8.5V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7.5a2 2 0 002 2h2.5" />
  </Icon>
)

export const Upload = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 15.5V4.5M7.5 9L12 4.5 16.5 9" />
    <path d="M4.5 15v2.5a2 2 0 002 2h11a2 2 0 002-2V15" />
  </Icon>
)

export const Lock = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
    <path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5M12 14.5v2" />
  </Icon>
)

export const Pin = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.4" />
  </Icon>
)

export const Box = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 7.5L12 3.5l8.5 4v9L12 20.5l-8.5-4z" />
    <path d="M3.5 7.5L12 11.5l8.5-4M12 11.5v9" />
  </Icon>
)

export const User = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8.5" r="3.8" />
    <path d="M4.5 20a7.5 7.5 0 0115 0" />
  </Icon>
)

export const Pencil = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14.5 5.5l4 4L9 19H5v-4z" />
    <path d="M12.5 7.5l4 4" />
  </Icon>
)
