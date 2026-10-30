import Calendar from "../components/calendar/Calendar";
import "./Home.css";

export default function Home() {
  return (
    <section className="home-page">
      <h1>Home</h1>
      <Calendar />
    </section>
  );
}