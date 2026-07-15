import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Role permission helpers
export function isAdminRole(role: string | null | undefined): boolean {
  return role === 'administrador' || role === 'socio';
}

export function isManagerOrAbove(role: string | null | undefined): boolean {
  return role === 'administrador' || role === 'socio' || role === 'gerente';
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}