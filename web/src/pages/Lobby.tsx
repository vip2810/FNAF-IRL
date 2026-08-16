import { Link } from 'react-router-dom';
import { useGame } from '../lib/socket';

export default function Lobby() {
  const { state } = useGame();

  return (
    <div className="page">
      <h1 className="title-glow">FNAF IRL</h1>
      <p className="muted">
        Cinq nuits en vrai — un surveillant, de vraies caméras Tapo, des monstres humains dans le
        bâtiment.
      </p>

      <div className="role-cards">
        <Link className="role-card" to="/guard">
          <div className="emoji">🖥️</div>
          <h2>Surveillant</h2>
          <p className="muted">
            Sur le PC. Observe les caméras, ferme les portes, survis jusqu'à 6h. Une seule caméra à
            la fois, énergie limitée !
          </p>
        </Link>
        <Link className="role-card" to="/monster">
          <div className="emoji">👹</div>
          <h2>Monstre</h2>
          <p className="muted">
            Sur ton téléphone (casque Bluetooth conseillé, téléphone en poche). Avance de zone en
            zone… mais fige-toi quand la caméra te regarde !
          </p>
        </Link>
        <Link className="role-card" to="/admin">
          <div className="emoji">⚙️</div>
          <h2>Configuration</h2>
          <p className="muted">
            Caméras Tapo C210 (IP + compte caméra), plan des zones, durée de la nuit.
          </p>
        </Link>
      </div>

      <div className="panel">
        <h2>Monstres connectés : {state?.monsters.filter((m) => m.connected).length ?? 0}</h2>
        <p className="muted">
          {state?.phase === 'night'
            ? `Nuit ${state.night} en cours — ${state.hour}h00`
            : 'En attente du lancement de la nuit par le surveillant.'}
        </p>
      </div>

      <div className="panel muted">
        <h2>Règles rapides</h2>
        <ol>
          <li>Chaque zone du bâtiment est couverte par une caméra.</li>
          <li>
            Quand le surveillant regarde ta zone, ton oreillette dit « STOP » : immobilise-toi,
            comme un animatronique.
          </li>
          <li>Caméra baissée = tu peux avancer vers le bureau (déclare ta zone sur le téléphone).</li>
          <li>Arrivé à une entrée du bureau, porte ouverte → ATTAQUE → jumpscare !</li>
          <li>
            Le surveillant a une énergie limitée : caméras et portes la vident. À 0 % : blackout…
          </li>
        </ol>
      </div>
    </div>
  );
}
