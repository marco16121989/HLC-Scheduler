export const getEventEndTime = (event) => {
  for (const value of [event.endsAt, event.startsAt]) {
    if (!value) continue;
    const timestamp = new Date(value).getTime();
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return Infinity;
};

export const filterEventsByPeriod = (events, period, now, userId) => events.filter((event) =>
  period === "mine" ? Boolean(userId) && event.createdBy === userId
    : period === "past" ? getEventEndTime(event) <= now : getEventEndTime(event) > now,
);

export const filterEventsByResponse = (events, response, userId) => response === "all" ? events
  : events.filter((event) => event.invitees?.some((invitee) =>
    invitee.userId === userId && invitee.status === response,
  ));
