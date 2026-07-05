/**
 * Whether reverting a working-day filing should also remove the class's
 * shared dayOrderOverride. If any OTHER class member still has a DayLog on
 * this date, the override must survive — the outfit's shared calendar
 * still says this day happened, even though this one user is taking back
 * their own filing.
 */
export function shouldRemoveOverride(otherMemberFilingsCount: number): boolean {
  return otherMemberFilingsCount === 0;
}
