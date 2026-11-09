import { useState } from 'react';
import "./TypePicker.css";

export default function TypePicker( {onTypeChange} ) {//passo una funzione
  const [isOpen, setIsOpen] = useState(false);

  const toggleDropdown = () => setIsOpen(!isOpen);

  const handleOptionClick = (option) => {
    onTypeChange(option);
    setIsOpen(false); 
  };

  return (
    <div className="dropdown-container">
      <button type="button" aria-expanded={isOpen} onClick={toggleDropdown}>
        Seleziona la vista
      </button>

      {isOpen && (
        <ul className="dropdown-menu">
          <li onClick={() => handleOptionClick("month")}>Mese</li>
          <li onClick={() => handleOptionClick("week")}>Settimana</li>
          <li onClick={() => handleOptionClick("day")}>Giorno</li>
        </ul>
      )}
    </div>
  );
}
