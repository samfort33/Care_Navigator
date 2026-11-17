// Production and Preview currently share the same managed database integration.
// Skip all non-production deployments until a separate Preview database is configured.
process.exit(process.env.VERCEL_ENV === 'production' ? 1 : 0);
