import { calendarCatalogMock, calendarBookingsMock } from "../data/calendarMock";

export async function getCalendarCatalog() {
  return calendarCatalogMock;
}


export async function getCalendarBookings(filters) {
  const { fromDate, toDateExclusive, departmentId, classroomId } = filters;
  if (!departmentId && !classroomId) return [];
  return calendarBookingsMock.filter((booking) =>
    booking.status === "APPROVED" &&
    booking.date >= fromDate && booking.date < toDateExclusive &&
    (!departmentId || booking.departmentId === departmentId) &&
    (!classroomId || booking.classroomId === classroomId)
  );
}