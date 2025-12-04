import React, { useState, useEffect } from 'react';
import type { KafkaConfig } from '../types';

interface KafkaControlsProps {
  config: KafkaConfig;
  onChange: (config: KafkaConfig) => void;
}

export const KafkaControls: React.FC<KafkaControlsProps> = ({ config, onChange }) => {
  const [localConfig, setLocalConfig] = useState<KafkaConfig>(config);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setLocalConfig({
      ...localConfig,
      [name]: type === 'checkbox' ? checked : (name === 'acks' || name === 'compression' ? value : Number(value)),
    });
  };

  const handleApply = () => {
    onChange(localConfig);
  };

  return (
    <div className="controls-container" style={{ padding: '20px', borderRight: '1px solid #ccc', width: '300px', overflowY: 'auto' }}>
      <h2>Configuration</h2>
      
      <button 
        onClick={handleApply}
        style={{
            width: '100%',
            padding: '10px',
            marginBottom: '20px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '14px'
        }}
      >
        Apply Changes
      </button>

      <div className="control-group">
        <label>Brokers</label>
        <input
          type="number"
          name="brokers"
          value={localConfig.brokers}
          onChange={handleChange}
          min="1"
          max="10"
        />
      </div>

      <div className="control-group">
        <label>Producers</label>
        <input
          type="number"
          name="producers"
          value={localConfig.producers}
          onChange={handleChange}
          min="1"
          max="20"
        />
      </div>

      <div className="control-group">
        <label>
          <input
            type="checkbox"
            name="rackAwareness"
            checked={localConfig.rackAwareness}
            onChange={handleChange}
            style={{ width: 'auto', marginRight: '8px' }}
          />
          Rack Awareness
        </label>
      </div>

      <div className="control-group">
        <label>Partitions</label>
        <input
          type="number"
          name="partitions"
          value={localConfig.partitions}
          onChange={handleChange}
          min="1"
          max="50"
        />
      </div>

      <div className="control-group">
        <label>Replication Factor</label>
        <input
          type="number"
          name="replicationFactor"
          value={localConfig.replicationFactor}
          onChange={handleChange}
          min="1"
          max="5"
        />
      </div>

      <div className="control-group">
        <label>Consumer Group Members</label>
        <input
          type="number"
          name="consumerGroupMembers"
          value={localConfig.consumerGroupMembers}
          onChange={handleChange}
          min="0"
          max="50"
        />
      </div>

      <div className="control-group">
        <label>Acks</label>
        <select name="acks" value={localConfig.acks} onChange={handleChange}>
          <option value="0">0 (No Ack)</option>
          <option value="1">1 (Leader)</option>
          <option value="all">all (ISR)</option>
        </select>
      </div>

      <div className="control-group">
        <label>Retries</label>
        <input
          type="number"
          name="retries"
          value={localConfig.retries}
          onChange={handleChange}
          min="0"
        />
      </div>

      <div className="control-group">
        <label>Batch Size (bytes)</label>
        <input
          type="number"
          name="batchSize"
          value={localConfig.batchSize}
          onChange={handleChange}
          step="1024"
        />
      </div>

      <div className="control-group">
        <label>Compression</label>
        <select name="compression" value={localConfig.compression} onChange={handleChange}>
          <option value="none">None</option>
          <option value="gzip">Gzip</option>
          <option value="snappy">Snappy</option>
          <option value="lz4">LZ4</option>
          <option value="zstd">Zstd</option>
        </select>
      </div>

      <div className="control-group">
        <label>Message Rate (msg/sec)</label>
        <input
          type="range"
          name="messageRate"
          value={localConfig.messageRate}
          onChange={handleChange}
          min="1"
          max="100"
        />
        <span>{localConfig.messageRate}</span>
      </div>

      <div className="control-group">
        <label>Consumer Intake Rate (msg/sec)</label>
        <input
          type="range"
          name="consumerIntakeRate"
          value={localConfig.consumerIntakeRate}
          onChange={handleChange}
          min="1"
          max="100"
        />
        <span>{localConfig.consumerIntakeRate}</span>
      </div>
    </div>
  );
};
