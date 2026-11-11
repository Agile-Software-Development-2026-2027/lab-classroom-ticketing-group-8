
import "./CalendarFilters.css";
export default function CalendarFilters({
  departments,
  classrooms,
  departmentId,
  classroomId,
  departmentDisabled = false,
  onDepartmentChange,
  onClassroomChange,
}) {
  const availableClassrooms = classrooms.filter(
    (classroom) => classroom.departmentId === departmentId
  );
  return (
    <div className="calendar-filters">
      <label className="calendar-filter">
        <span>Dipartimento</span>
        <select
          value={departmentId}
          disabled={departmentDisabled}
          onChange={(event) => onDepartmentChange(event.target.value)}
        >
          {(!departmentDisabled || !departmentId) && (
            <option value="">
              {departmentDisabled
                ? "Dipartimento non disponibile"
                : "Seleziona un dipartimento"}
            </option>
          )}
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </label>
      <label className="calendar-filter">
        <span>Aula (facoltativa)</span>
        <select
          value={classroomId}
          disabled={!departmentId}
          onChange={(event) => onClassroomChange(event.target.value)}
        >
          <option value="">
            {departmentId
              ? "Tutte le aule"
              : "Seleziona prima un dipartimento"}
          </option>
          {availableClassrooms.map((classroom) => (
            <option key={classroom.id} value={classroom.id}>
              {classroom.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
