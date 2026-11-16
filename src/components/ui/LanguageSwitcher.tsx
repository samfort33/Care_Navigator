'use client';

import React from 'react';
import { useLanguage } from '@/lib/language';

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <label className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-2 text-xs font-semibold text-on-surface">
      <span className="sr-only">Website language</span>
      <select
        aria-label="Website language"
        value={language}
        onChange={(event) => setLanguage(event.target.value === 'bn' ? 'bn' : 'en')}
        className="max-w-[90px] cursor-pointer bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <option value="en">English</option>
        <option value="bn">বাংলা</option>
      </select>
    </label>
  );
}
