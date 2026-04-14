import { useState } from 'react';
import { CpuIcon, type LucideIcon, SlidersHorizontalIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { GeneralSection } from './general-section';
import { ModelsSection } from './models-section';

type SettingsSection = 'general' | 'models';

export function SettingsPage() {
  const [activeSection, setActiveSection] =
    useState<SettingsSection>('general');

  const navItems: {
    id: SettingsSection;
    label: string;
    icon: LucideIcon;
  }[] = [
    { id: 'general', label: 'General', icon: SlidersHorizontalIcon },
    { id: 'models', label: 'Models', icon: CpuIcon },
  ];

  return (
    <div className="flex h-full bg-background">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border/60 bg-card/20">
        <nav className="flex-1 px-2 pb-4">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                activeSection === id
                  ? 'bg-accent font-medium text-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
              )}>
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <ScrollArea className="flex-1">
        {activeSection === 'general' ? <GeneralSection /> : <ModelsSection />}
      </ScrollArea>
    </div>
  );
}
