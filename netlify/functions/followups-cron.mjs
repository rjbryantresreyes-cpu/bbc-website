// Daily trigger for the outreach follow-up digest.
// Runs on Netlify's scheduler at 00:00 UTC = 08:00 Asia/Manila, every day.
// It just pings the digest function, which emails RJ only if any follow-ups are due.

export default async () => {
  try {
    await fetch("https://balaynibruno.co/.netlify/functions/followups-digest");
  } catch (e) {
    console.log("followups-cron error:", String(e).slice(0, 200));
  }
  return new Response("ok");
};

// Netlify scheduled function. Cron is UTC. 00:00 UTC = 08:00 Manila (UTC+8, no DST).
export const config = { schedule: "0 0 * * *" };
