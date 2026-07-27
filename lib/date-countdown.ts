export type CountdownUrgency = "overdue" | "today" | "soon" | "upcoming";

export type CountdownInfo = {
  daysUntil: number;
  urgency: CountdownUrgency;
  label: string;
};

export function getCountdownInfo(date: Date): CountdownInfo {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date);
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const daysUntil = Math.round((startOfTarget.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) {
    const overdueBy = Math.abs(daysUntil);
    return { daysUntil, urgency: "overdue", label: `Overdue ${overdueBy}d` };
  }
  if (daysUntil === 0) {
    return { daysUntil, urgency: "today", label: "Due today" };
  }
  if (daysUntil <= 3) {
    return { daysUntil, urgency: "soon", label: `Due in ${daysUntil}d` };
  }
  return { daysUntil, urgency: "upcoming", label: `Due in ${daysUntil}d` };
}
