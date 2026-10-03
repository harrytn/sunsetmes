type CheckIn = {
  alreadyCheckedIn: boolean;
  granted: number;
  pigeonCoins: number;
  message?: string;
};

export async function recordDailyVisit(userId: string): Promise<CheckIn | null> {
  const key = `sunset-checkin-${userId}-${new Date().toISOString().slice(0, 10)}`;
  if (localStorage.getItem(key)) return null;
  const response = await fetch('/api/economy/check-in', { method: 'POST' });
  if (!response.ok) return null;
  const result = await response.json() as CheckIn;
  localStorage.setItem(key, '1');
  return result;
}
