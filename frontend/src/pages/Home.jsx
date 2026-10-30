import Calendar from "../components/calendar/Calendar";
import "./Home.css";

export default function Home() {
  return (
    <section className="home-page">
      <div className="home-intro">
        <span className="home-intro-label">
          Consultazione pubblica
        </span>

        <h1>Calendario aule</h1>

        <p>
          Seleziona un dipartimento e, se vuoi, un’aula.
          Apri un giorno per consultare le prenotazioni approvate,
          gli orari e il docente.
        </p>

        <p className="home-intro-note">
          Il calendario è consultabile anche senza effettuare il login.
        </p>
      </div>
      <Calendar />
    </section>
  );
}