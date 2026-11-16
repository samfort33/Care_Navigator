import React from 'react';
import { MediaVoiceWorkspace, type MultimodalTab } from '@/components/triage/MediaVoiceWorkspace';

export default async function MediaVoiceAssessmentPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const resolved = await searchParams;
  const initialTab: MultimodalTab = resolved.tab === 'voice' ? 'voice' : 'media';

  return <MediaVoiceWorkspace initialTab={initialTab} />;
}
