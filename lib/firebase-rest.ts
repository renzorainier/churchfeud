import { firebaseDatabaseUrl } from "@/lib/firebase";

export async function patchFirebase(values: Record<string, unknown>) {
  if (!firebaseDatabaseUrl) throw new Error("Firebase database URL is missing.");
  const response = await fetch(`${firebaseDatabaseUrl}/.json`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!response.ok) throw new Error(`Firebase returned ${response.status}.`);
}

export async function claimBuzzer(team: "A" | "B") {
  if (!firebaseDatabaseUrl) throw new Error("Firebase database URL is missing.");
  const response = await fetch(`${firebaseDatabaseUrl}/gameState/buzzerStatus.json`, {
    headers: { "X-Firebase-ETag": "true" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Firebase returned ${response.status}.`);
  const current = await response.json();
  const etag = response.headers.get("etag");
  if (current?.locked || !etag) return false;

  const claim = await fetch(`${firebaseDatabaseUrl}/gameState/buzzerStatus.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "if-match": etag },
    body: JSON.stringify({ locked: true, winner: team, timestamp: Date.now() }),
  });
  if (claim.status === 412) return false;
  if (!claim.ok) throw new Error(`Firebase returned ${claim.status}.`);
  return true;
}
