'use client';

import { useEffect } from 'react';

export function MaterialSymbolsLoader() {
  useEffect(() => {
    const fontStylesheet = document.createElement('link');
    fontStylesheet.rel = 'stylesheet';
    fontStylesheet.href =
      'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap';
    fontStylesheet.onload = () => document.documentElement.classList.add('fonts-ready');
    fontStylesheet.onerror = () => document.documentElement.classList.add('fonts-ready');
    document.head.appendChild(fontStylesheet);

    return () => fontStylesheet.remove();
  }, []);

  return null;
}
