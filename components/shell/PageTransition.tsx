'use client'
import { usePathname } from 'next/navigation'

export function PageTransition({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  return (
    <div key={path} className="u-page-enter">
      {children}
    </div>
  )
}
