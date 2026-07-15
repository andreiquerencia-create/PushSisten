'use client';

import { useSession } from 'next-auth/react';
import { Bell, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function AppHeader({ title }: { title?: string }) {
  const { data: session } = useSession() || {};

  return (
    <header className="sticky top-0 z-30 bg-background lg:bg-background/80 lg:backdrop-blur-xl border-b border-border/50">
      <div className="flex items-center justify-between h-14 px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <div className="lg:hidden w-10" />
          {title && (
            <h1 className="text-lg font-display font-bold text-foreground tracking-tight">
              {title}
            </h1>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
            <Input
              placeholder="Buscar..."
              className="pl-9 w-56 h-9 text-sm bg-muted/30 border-border/50 focus:bg-background transition-colors"
            />
          </div>
          <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground">
            <Bell className="w-[18px] h-[18px]" />
          </Button>
          <div className="hidden sm:flex items-center gap-2.5 pl-3 ml-1 border-l border-border/50">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/15 to-violet-500/10 ring-1 ring-primary/10 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">
                {(session?.user?.name ?? 'U')?.[0]?.toUpperCase?.() ?? 'U'}
              </span>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium leading-none">{session?.user?.name ?? 'Usuário'}</p>
              <p className="text-[11px] text-muted-foreground/70 capitalize mt-0.5">{session?.user?.role ?? ''}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
