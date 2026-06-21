import { useNavigate } from 'react-router-dom';
import { Gamepad2, Edit3, Map } from 'lucide-react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import './HomePage.css';

export function HomePage() {
  const navigate = useNavigate();
  const theme = useStore((state) => state.theme);

  const cards = [
    {
      id: 'game',
      title: 'Game Page',
      description: 'Play and experience the rhythm game',
      icon: <Gamepad2 size={40} />,
      path: '/game',
      cssClass: 'card-game'
    },
    {
      id: 'playground',
      title: 'Playground',
      description: 'Experiment and create notes in detail',
      icon: <Edit3 size={40} />,
      path: '/playground',
      cssClass: 'card-editor'
    },
    {
      id: 'level-editor',
      title: 'Level Editor Page',
      description: 'Design and layout game stages visually',
      icon: <Map size={40} />,
      path: '/level-editor',
      cssClass: 'card-level-editor'
    }
  ];

  return (
    <div className={`home-container ${theme}`}>
      <div className="home-bg-animation"></div>
      
      <motion.div 
        className="home-content"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <h1 className="home-title">YBNote</h1>
        <p className="home-subtitle">Choose your destination</p>

        <div className="home-cards-container">
          {cards.map((card, index) => (
            <motion.div
              key={card.id}
              className={`home-card ${card.cssClass}`}
              onClick={() => navigate(card.path)}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + index * 0.1, ease: "easeOut" }}
              whileHover={{ scale: 1.03, y: -8 }}
              whileTap={{ scale: 0.97 }}
            >
              <div className="card-icon-wrapper">
                {card.icon}
              </div>
              <div className="card-text-content">
                <h2 className="card-title">{card.title}</h2>
                <p className="card-description">{card.description}</p>
              </div>
              <div className="card-glow"></div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
