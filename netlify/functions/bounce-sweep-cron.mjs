// Daily trigger for the CRM bounce sweep.
// Runs at 00:30 UTC = 08:30 Asia/Manila (just after the follow-up digest).
// Pings the sweep, which marks any newly-bounced leads as Status=Bounced.

export default async () => {
  try {
    await fetch("https://balaynibruno.co/.netlify/functions/bounce-sweep");
  } catch (e) {
    console.log("bounce-sweep-cron error:", String(e).slice(0, 200));
  }
  return new Response("ok");
};

export const config = { schedule: "30 0 * * *" };
