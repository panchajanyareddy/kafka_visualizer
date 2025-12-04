import { useState } from 'react';
import { KafkaControls } from './components/KafkaControls';
import { KafkaVisualizer } from './components/KafkaVisualizer';
import { defaultConfig, type KafkaConfig } from './types';
import './App.css';

function App() {
  const [config, setConfig] = useState<KafkaConfig>(defaultConfig);

  return (
    <div className="App" style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <KafkaControls config={config} onChange={setConfig} />
      <KafkaVisualizer config={config} />
    </div>
  );
}

export default App;
