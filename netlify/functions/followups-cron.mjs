// Daily trigger for the outreach follow-up digest.
// DISABLED 2026-07-06 (RJ): the daily "Outreach: N follow-ups due today" reminder is retired,
// replaced by the automated Brevo campaigns (welcome + workflow newsletter). The schedule
// export is removed so Netlify no longer registers this as a scheduled function. The handler
// is a no-op kept only so the deploy does not error on a missing default export.

export default async () => {
  return new Response("followups-cron disabled");
};

// (schedule intentionally removed — no longer runs on Netlify's scheduler)
