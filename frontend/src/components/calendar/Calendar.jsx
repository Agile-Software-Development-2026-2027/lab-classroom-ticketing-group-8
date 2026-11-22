
import { useContext, useEffect, useRef, useState } from "react";

import "./Calendar.css";

import CalendarToolbar from "./toolbar/CalendarToolBar";
import CalendarDayDetails from "./grid/calendarDayDetails/CalendarDayDetails";
import CalendarGrid from "./grid/CalendarGrid";
import CalendarFilters from "./filters/CalendarFilters";

import useCalendarBookings from "../../hooks/useCalendarBookings";
import useCalendarCatalog from "../../hooks/useCalendarCatalog";
import useDepartmentAccessRequests from "../../hooks/useDepartmentAccessRequests";

import { AuthContext } from "../../contexts/AuthContextValue";
import { getAssignedDepartmentId } from "../../services/userService";

function dateKey(date) {
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export default function Calendar() {
  const session = useContext(AuthContext);

  const authLoading = Boolean(session?.loading);
  const role = session?.profile?.role;

  const isProfessor = role === "PROFESSOR";
  const isAdmin = role === "ADMIN";
  const isRestricted = isProfessor || isAdmin;

  const assignedDepartmentId =
    getAssignedDepartmentId(session?.profile);

  const {
    departments,
    classrooms,
    loading: catalogLoading,
    error: catalogError,
  } = useCalendarCatalog();

  const {
    requests: accessRequests,
  } = useDepartmentAccessRequests(
    session?.user,
    session?.profile,
    departments
  );

  const approvedIds = new Set(
    accessRequests
      .filter((request) => request.status === "APPROVED")
      .map((request) => request.departmentId)
  );

  const [referenceDate, setReferenceDate] =
    useState(() => new Date());

  const [today, setToday] =
    useState(() => new Date());

  const [selectedDay, setSelectedDay] =
    useState(null);

  const [guestDepartmentId, setGuestDepartmentId] =
    useState("");

  const [
    professorDepartmentId,
    setProfessorDepartmentId,
  ] = useState("");

  const [classroomId, setClassroomId] =
    useState("");

  const [typeView, setTypeView] =
    useState("month");

  const lastDayButton = useRef(null);

  // Story 29 + Story 52: dipartimenti visibili.
  const visibleDepartments = authLoading
    ? []
    : isProfessor
      ? departments.filter(
        (department) =>
          department.id === assignedDepartmentId ||
          approvedIds.has(department.id)
      )
      : isAdmin
        ? departments.filter(
          (department) =>
            department.id === assignedDepartmentId
        )
        : departments;

  const selectedProfessorDepartment =
    visibleDepartments.some(
      (department) =>
        department.id === professorDepartmentId
    )
      ? professorDepartmentId
      : assignedDepartmentId;

  const departmentId = authLoading
    ? ""
    : isProfessor
      ? visibleDepartments.some(
        (department) =>
          department.id === selectedProfessorDepartment
      )
        ? selectedProfessorDepartment
        : ""
      : isAdmin
        ? visibleDepartments[0]?.id ?? ""
        : guestDepartmentId;

  const visibleClassrooms = authLoading
    ? []
    : isRestricted
      ? classrooms.filter(
        (room) =>
          room.departmentId === departmentId
      )
      : classrooms;

  const activeClassroomId = visibleClassrooms.some(
    (room) =>
      room.id === classroomId &&
      room.departmentId === departmentId
  )
    ? classroomId
    : "";

  useEffect(() => {
    setGuestDepartmentId("");
    setProfessorDepartmentId("");
    setClassroomId("");
    setSelectedDay(null);
  }, [
    role,
    assignedDepartmentId,
    session?.user?.uid,
  ]);

  const hasDepartment = departmentId !== "";

  const firstDate = new Date(referenceDate);
  firstDate.setHours(0, 0, 0, 0);

  if (typeView === "month") {
    firstDate.setDate(1);
    firstDate.setDate(
      firstDate.getDate() -
      ((firstDate.getDay() + 6) % 7)
    );
  } else if (typeView === "week") {
    firstDate.setDate(
      firstDate.getDate() -
      ((firstDate.getDay() + 6) % 7)
    );
  }

  let daysCount = 42;

  if (typeView === "week") {
    daysCount = 7;
  } else if (typeView === "day") {
    daysCount = 1;
  }

  const days = Array.from(
    { length: daysCount },
    (_, index) => {
      const date = new Date(firstDate);
      date.setDate(date.getDate() + index);

      return {
        date,
        dateKey: dateKey(date),
      };
    }
  );

  const endDate = new Date(firstDate);
  endDate.setDate(endDate.getDate() + days.length);

  const {
    bookings: loadedBookings,
    loading: bookingsLoading,
    error: bookingsError,
  } = useCalendarBookings({
    fromDate: days[0].dateKey,
    toDateExclusive: dateKey(endDate),
    departmentId,
    departments,
    classrooms,
  });

  const filterMessage = hasDepartment
    ? ""
    : authLoading || catalogLoading
      ? "Caricamento dipartimenti..."
      : isRestricted
        ? "Dipartimento assegnato non disponibile."
        : "Seleziona un dipartimento per visualizzare le prenotazioni.";

  const message =
    catalogError ||
    bookingsError ||
    filterMessage;

  const bookings = loadedBookings.filter(
    (booking) =>
      hasDepartment &&
      booking.departmentId === departmentId &&
      (
        !activeClassroomId ||
        booking.classroomId === activeClassroomId
      )
  );

  function changeDate(date) {
    setToday(new Date());
    setReferenceDate(date);
    setSelectedDay(null);

    if (typeView === "day") {
      setSelectedDay({
        date,
        dateKey: dateKey(date),
      });
    }
  }

  function changeMonth(amount) {
    const next = new Date(referenceDate);

    if (typeView === "month") {
      next.setDate(1);
      next.setMonth(next.getMonth() + amount);
    } else if (typeView === "week") {
      next.setDate(
        next.getDate() + amount * 7
      );
    } else if (typeView === "day") {
      next.setDate(
        next.getDate() + amount
      );
    }

    changeDate(next);
  }

  function openDay(day, button) {
    lastDayButton.current = button;
    setSelectedDay(day);
  }

  function closeDay() {
    setSelectedDay(null);
    lastDayButton.current?.focus();
  }

  function changeDepartment(nextDepartmentId) {
    if (authLoading || isAdmin) {
      return;
    }

    if (isProfessor) {
      const allowed = visibleDepartments.some(
        (department) =>
          department.id === nextDepartmentId
      );

      if (!allowed) {
        return;
      }

      setProfessorDepartmentId(nextDepartmentId);
    } else {
      setGuestDepartmentId(nextDepartmentId);
    }

    setClassroomId("");

    if (typeView !== "day") {
      setSelectedDay(null);
    }
  }

  function changeView(type) {
    if (type === "day") {
      const date = new Date(referenceDate);

      setSelectedDay({
        date,
        dateKey: dateKey(date),
      });
    }

    setTypeView(type);
  }

  let periodLabel = "";

  if (typeView === "month") {
    periodLabel = referenceDate.toLocaleDateString(
      "it-IT",
      {
        month: "long",
        year: "numeric",
      }
    );
  } else if (typeView === "day") {
    periodLabel = referenceDate.toLocaleDateString(
      "it-IT",
      {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    );
  } else if (typeView === "week") {
    const firstDay = days[0];
    const lastDay = days[days.length - 1];

    const options = {
      day: "numeric",
      month: "long",
      year: "numeric",
    };

    const startLabel = firstDay.date.toLocaleDateString(
      "it-IT",
      options
    );

    const endLabel = lastDay.date.toLocaleDateString(
      "it-IT",
      options
    );

    periodLabel = `${startLabel} – ${endLabel}`;
  }

  const activeDay = selectedDay ?? {
    date: referenceDate,
    dateKey: dateKey(referenceDate),
  };

  const departmentDisabled =
    authLoading ||
    isAdmin ||
    (
      isProfessor &&
      visibleDepartments.length <= 1
    );

  return (
    <section
      className="classroom-calendar"
      aria-label="Calendario delle aule"
    >
      <CalendarToolbar
        periodLabel={periodLabel}
        onPrevious={() => changeMonth(-1)}
        onNext={() => changeMonth(1)}
        onToday={() => changeDate(new Date())}
        referenceDate={referenceDate}
        onDateChange={changeDate}
        onTypeChange={changeView}
      />

      <CalendarFilters
        departments={visibleDepartments}
        classrooms={visibleClassrooms}
        departmentId={departmentId}
        classroomId={activeClassroomId}
        departmentDisabled={departmentDisabled}
        onDepartmentChange={changeDepartment}
        onClassroomChange={setClassroomId}
      />

      {selectedDay && typeView !== "day" && (
        <CalendarDayDetails
          day={selectedDay}
          bookings={bookings.filter(
            (booking) =>
              booking.date === selectedDay.dateKey
          )}
          message={
            bookingsLoading
              ? "Caricamento prenotazioni..."
              : message
          }
          onClose={closeDay}
        />
      )}

      {message && (
        <p
          className="calendar-message"
          role={
            catalogError || bookingsError
              ? "alert"
              : undefined
          }
        >
          {message}
        </p>
      )}

      {(typeView === "month" ||
        typeView === "week") && (
          <CalendarGrid
            days={days}
            today={today}
            view="month"
            referenceDate={referenceDate}
            bookings={bookings}
            selectedDay={selectedDay}
            showCounts={
              hasDepartment &&
              !bookingsLoading &&
              !bookingsError
            }
            onSelectDay={openDay}
          />
        )}

      {typeView === "day" && (
        <CalendarDayDetails
          type={typeView}
          day={activeDay}
          bookings={bookings.filter(
            (booking) =>
              booking.date === activeDay.dateKey
          )}
          message={
            bookingsLoading
              ? "Caricamento prenotazioni..."
              : message
          }
        />
      )}
    </section>
  );
}
