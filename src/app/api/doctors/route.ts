import { NextRequest, NextResponse } from 'next/server';
import { queryDoctors } from '@/server/directory/service';
import { logger } from '@/lib/logger';

/**
 * GET /api/doctors
 * Returns verified doctor profiles with real database filtering by:
 * - specialty
 * - region
 * - telehealth (boolean)
 * - inNetwork (boolean)
 * - availableToday (boolean)
 * - q (search keyword)
 * - pagination
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const specialty = searchParams.get('specialty') || undefined;
    const region = searchParams.get('region') || undefined;
    const telehealthParam = searchParams.get('telehealth');
    const inNetworkParam = searchParams.get('inNetwork');
    const availableTodayParam = searchParams.get('availableToday');
    const searchQuery = searchParams.get('q') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '12', 10);

    const result = await queryDoctors({
      specialty,
      region,
      telehealth: telehealthParam === null ? undefined : telehealthParam === 'true',
      inNetwork: inNetworkParam === null ? undefined : inNetworkParam === 'true',
      availableToday: availableTodayParam === null ? undefined : availableTodayParam === 'true',
      searchQuery,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    logger.error('DOCTORS_QUERY_FAILED', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to query doctors.' },
      { status: 500 }
    );
  }
}
