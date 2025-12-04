import React, { useEffect, useState, useRef } from 'react';
import type { KafkaConfig } from '../types';

interface KafkaVisualizerProps {
  config: KafkaConfig;
}

interface Message {
  id: number;
  partition: number;
  producerId: number;
  progress: number; // 0 to 100
  stage: 'producing' | 'brokered' | 'consuming';
}

export const KafkaVisualizer: React.FC<KafkaVisualizerProps> = ({ config }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]); // Source of truth for animation loop
  const [intakeRate, setIntakeRate] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const messageIdRef = useRef(0);
  const consumedTimestampsRef = useRef<number[]>([]);
  const consumerTokensRef = useRef<number>(0);

  // Dynamic Height Calculation
  const PRODUCER_HEIGHT = Math.max(500, config.producers * 80);
  const CONSUMER_HEIGHT = Math.max(500, config.consumerGroupMembers * 80);
  
  // Broker Height Calculation
  // Base height + height for partitions inside
  const partitionsPerBroker = Math.ceil(config.partitions / config.brokers);
  const minBrokerHeight = 40 + (partitionsPerBroker * 35); // Header + partitions
  const BROKER_HEIGHT = Math.max(500, config.brokers * Math.max(120, minBrokerHeight));

  const CONTAINER_HEIGHT = Math.max(PRODUCER_HEIGHT, BROKER_HEIGHT, CONSUMER_HEIGHT);
  
  const PRODUCER_X_PCT = 10;
  const PARTITION_X_PCT = 40;
  const CONSUMER_X_PCT = 80;

  // Helper to get Y position of a producer
  const getProducerY = (index: number) => {
    const heightPerProducer = CONTAINER_HEIGHT / config.producers;
    return (index * heightPerProducer) + (heightPerProducer / 2);
  };

  // Helper to get Y position of a partition on a specific broker
  const getPartitionY = (partitionIndex: number, targetBrokerIndex?: number) => {
    const leaderBroker = partitionIndex % config.brokers;
    const brokerIndex = targetBrokerIndex !== undefined ? targetBrokerIndex : leaderBroker;
    
    const brokerHeight = CONTAINER_HEIGHT / config.brokers;
    const brokerTop = brokerIndex * brokerHeight;
    
    // Count how many partitions (leaders + followers) are in this broker
    let partitionsInThisBroker = 0;
    let localIndex = 0;
    
    // We need to iterate all partitions to see if they land on this broker
    for (let p = 0; p < config.partitions; p++) {
        const pLeaderBroker = p % config.brokers;
        let isHere = false;
        
        if (pLeaderBroker === brokerIndex) isHere = true;
        else {
            // Check replicas
            for (let r = 0; r < config.replicationFactor - 1; r++) {
                let tBrokerIdx = (pLeaderBroker + r + 1) % config.brokers;
                // Rack Awareness Logic (Must match rendering logic)
                if (config.rackAwareness && config.brokers > 2) {
                    const leaderRack = pLeaderBroker % 2;
                    const targetRack = tBrokerIdx % 2;
                    if (leaderRack === targetRack) {
                         const alternativeBroker = (tBrokerIdx + 1) % config.brokers;
                         if (alternativeBroker !== pLeaderBroker) {
                             tBrokerIdx = alternativeBroker;
                         }
                    }
                }
                if (tBrokerIdx === brokerIndex) isHere = true;
            }
        }

        if (isHere) {
            if (p === partitionIndex) localIndex = partitionsInThisBroker;
            partitionsInThisBroker++;
        }
    }
    
    const brokerGap = 10;
    const headerHeight = 27; 
    const actualBrokerHeight = brokerHeight - brokerGap;
    const availableHeight = actualBrokerHeight - headerHeight - 5;
    
    const heightPerPartition = availableHeight / partitionsInThisBroker;
    const boxTop = brokerTop + (brokerGap / 2);
    
    return boxTop + headerHeight + (localIndex * heightPerPartition) + (heightPerPartition / 2);
  };

  // Helper to get Y position of a consumer
  const getConsumerY = (index: number) => {
    if (config.consumerGroupMembers === 0) return -1;
    const heightPerConsumer = CONTAINER_HEIGHT / config.consumerGroupMembers;
    return (index * heightPerConsumer) + (heightPerConsumer / 2);
  };

  // Calculate partition assignment for consumers
  const getConsumerForPartition = (partitionIndex: number) => {
    if (config.consumerGroupMembers === 0) return -1;
    return partitionIndex % config.consumerGroupMembers;
  };

  const animate = (time: number) => {
    if (lastTimeRef.current !== 0) {
      const deltaTime = time - lastTimeRef.current;
      const scaledDeltaTime = deltaTime * simulationSpeed;

      // Add tokens for consumption
      consumerTokensRef.current += (config.consumerIntakeRate * scaledDeltaTime / 1000);
      if (consumerTokensRef.current > config.consumerIntakeRate) {
          consumerTokensRef.current = config.consumerIntakeRate; // Cap at 1 sec burst
      }

      let currentMessages = [...messagesRef.current];

      // Spawn new messages
      if (Math.random() < (config.messageRate / 60) * simulationSpeed) {
        const newMessage: Message = {
          id: messageIdRef.current++,
          partition: Math.floor(Math.random() * config.partitions),
          producerId: Math.floor(Math.random() * config.producers),
          progress: 0,
          stage: 'producing'
        };
        currentMessages.push(newMessage);
      }

      // Update message positions
      const updated = currentMessages.map(msg => {
        let speed = 1;
        
        if (config.compression !== 'none') speed *= 1.2;
        if (config.acks === 'all') speed *= 0.8;
        if (config.batchSize > 16384) speed *= 0.9;

        let newProgress = msg.progress + (speed * simulationSpeed);
        
        // Check for consumption bottleneck
        // Transition from Brokered (approx 66) to Consuming
        if (msg.progress < 66 && newProgress >= 66) {
            if (consumerTokensRef.current >= 1) {
                consumerTokensRef.current -= 1;
            } else {
                // Blocked by intake rate
                newProgress = 65.9; 
            }
        }

        let newStage = msg.stage;

        if (newProgress < 33) {
            newStage = 'producing';
        } else if (newProgress < 66) {
            newStage = 'brokered';
        } else {
            newStage = 'consuming';
        }

        return { ...msg, progress: newProgress, stage: newStage };
      });

      const kept = updated.filter(msg => msg.progress < 100);
      const consumedCount = updated.length - kept.length;
      
      if (consumedCount > 0) {
          const now = Date.now();
          for(let i=0; i<consumedCount; i++) consumedTimestampsRef.current.push(now);
      }
      
      // Update Ref and State
      messagesRef.current = kept;
      setMessages(kept);

      // Calculate rate
      const now = Date.now();
      consumedTimestampsRef.current = consumedTimestampsRef.current.filter(t => t > now - 1000);
      setIntakeRate(consumedTimestampsRef.current.length);
    }
    lastTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = 0;
      requestRef.current = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(requestRef.current!);
  }, [config, isPlaying, simulationSpeed]);

  // Calculate lag per partition (messages waiting in broker)
  const partitionLags = messages.reduce((acc, msg) => {
    if (msg.stage === 'brokered') {
      acc[msg.partition] = (acc[msg.partition] || 0) + 1;
    }
    return acc;
  }, {} as Record<number, number>);

  return (
    <div className="visualizer-container" style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h2 style={{ margin: 0 }}>Visualization</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '5px', marginRight: '10px' }}>
                {[0.5, 1, 2, 4].map(speed => (
                    <button
                        key={speed}
                        onClick={() => setSimulationSpeed(speed)}
                        style={{
                            padding: '4px 8px',
                            backgroundColor: simulationSpeed === speed ? '#2196F3' : '#e0e0e0',
                            color: simulationSpeed === speed ? 'white' : 'black',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                        }}
                    >
                        {speed}x
                    </button>
                ))}
            </div>
            <button 
                onClick={() => setIsPlaying(!isPlaying)}
                style={{
                    padding: '8px 16px',
                    backgroundColor: isPlaying ? '#f44336' : '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                }}
            >
                {isPlaying ? 'Pause' : 'Play'}
            </button>
        </div>
      </div>
      
      <div style={{ 
          position: 'relative', 
          height: `${CONTAINER_HEIGHT}px`, 
          border: '1px solid #eee',
          background: '#fafafa',
          overflow: 'hidden'
      }}>
        
        {/* Producer Nodes */}
        {Array.from({ length: config.producers }).map((_, i) => {
            const top = getProducerY(i);
            const height = (CONTAINER_HEIGHT / config.producers) - 10;
            return (
                <div key={i} style={{ 
                    position: 'absolute',
                    left: '2%',
                    top: top,
                    transform: 'translateY(-50%)',
                    width: '80px', 
                    height: `${Math.min(height, 80)}px`,
                    border: '2px solid #333', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    background: '#e0e0e0',
                    borderRadius: '8px',
                    zIndex: 10
                }}>
                  <span style={{fontSize: '12px'}}>Producer {i}</span>
                </div>
            );
        })}

        {/* Brokers and Partitions */}
        {Array.from({ length: config.brokers }).map((_, brokerIndex) => {
            const brokerHeight = CONTAINER_HEIGHT / config.brokers;
            const top = brokerIndex * brokerHeight;
            const height = brokerHeight - 10; // gap
            
            const isRack1 = config.rackAwareness && brokerIndex % 2 === 0;
            const rackColor = config.rackAwareness ? (isRack1 ? '#FFF3E0' : '#E0F2F1') : '#FAFAFA';
            const rackLabel = config.rackAwareness ? (isRack1 ? 'Rack A' : 'Rack B') : '';
            const borderColor = config.rackAwareness ? (isRack1 ? '#FF9800' : '#009688') : '#757575';

            return (
                <div key={brokerIndex} style={{
                    position: 'absolute',
                    left: `${PARTITION_X_PCT}%`,
                    top: top + (brokerHeight/2),
                    transform: 'translate(-50%, -50%)',
                    width: '180px',
                    height: `${height}px`,
                    border: `2px solid ${borderColor}`,
                    background: rackColor,
                    borderRadius: '8px',
                    zIndex: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    paddingTop: '5px',
                    boxSizing: 'border-box'
                }}>
                    <div style={{fontSize: '12px', fontWeight: 'bold', marginBottom: '2px', height: '20px'}}>
                        Broker {brokerIndex} {rackLabel && <span style={{fontSize:'10px', fontWeight:'normal', color: '#555'}}>({rackLabel})</span>}
                    </div>
                    
                    <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', padding: '0 5px 5px 5px', boxSizing: 'border-box' }}>
                        {Array.from({ length: config.partitions }).map((_, pIndex) => {
                            const leaderBroker = pIndex % config.brokers;
                            let isLeader = leaderBroker === brokerIndex;
                            let isFollower = false;

                            if (!isLeader) {
                                // Check if this broker is a replica
                                for (let r = 0; r < config.replicationFactor - 1; r++) {
                                    let targetBrokerIdx = (leaderBroker + r + 1) % config.brokers;
                                    // Rack Awareness Logic
                                    if (config.rackAwareness && config.brokers > 2) {
                                        const leaderRack = leaderBroker % 2;
                                        const targetRack = targetBrokerIdx % 2;
                                        if (leaderRack === targetRack) {
                                            const alternativeBroker = (targetBrokerIdx + 1) % config.brokers;
                                            if (alternativeBroker !== leaderBroker) {
                                                targetBrokerIdx = alternativeBroker;
                                            }
                                        }
                                    }
                                    if (targetBrokerIdx === brokerIndex) isFollower = true;
                                }
                            }

                            if (!isLeader && !isFollower) return null;

                            return (
                                <div key={pIndex} style={{
                                    flex: 1,
                                    width: '100%',
                                    margin: '2px 0',
                                    border: isLeader ? '2px solid #2196F3' : '1px dashed #90CAF9',
                                    background: isLeader ? '#E3F2FD' : '#F5F5F5',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '4px',
                                    minHeight: '0',
                                    opacity: isLeader ? 1 : 0.7
                                }}>
                                    <span style={{fontSize: '10px', fontWeight: isLeader ? 'bold' : 'normal'}}>
                                        P{pIndex} {isLeader ? '(L)' : '(F)'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        })}

        {/* Consumer Group Info */}
        <div style={{ 
            position: 'absolute',
            left: `${CONSUMER_X_PCT}%`,
            top: '10px',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            zIndex: 10,
            background: 'rgba(255,255,255,0.8)',
            padding: '4px',
            borderRadius: '4px',
            border: '1px solid #ccc'
        }}>
            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>Consumer Group</div>
            <div style={{ fontSize: '12px', color: '#4CAF50' }}>Intake: {intakeRate} msg/s</div>
        </div>

        {/* Consumer Nodes */}
        {config.consumerGroupMembers > 0 && Array.from({ length: config.consumerGroupMembers }).map((_, i) => {
            const top = getConsumerY(i);
            const height = (CONTAINER_HEIGHT / config.consumerGroupMembers) - 10;
            
            let consumerLag = 0;
            for (let p = 0; p < config.partitions; p++) {
                if (p % config.consumerGroupMembers === i) {
                    consumerLag += (partitionLags[p] || 0);
                }
            }

            return (
                <div key={i} style={{ 
                    position: 'absolute',
                    left: `${CONSUMER_X_PCT}%`,
                    top: top,
                    transform: 'translate(-50%, -50%)',
                    width: '100px',
                    height: `${Math.min(height, 80)}px`,
                    border: '2px solid #4CAF50', 
                    background: '#E8F5E9',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px',
                    zIndex: 5
                }}>
                    <span style={{ fontWeight: 'bold' }}>Consumer {i}</span>
                    <span style={{ fontSize: '11px', color: '#d32f2f' }}>Lag: {consumerLag}</span>
                </div>
            );
        })}

        {/* Messages */}
        {messages.map(msg => {
            let x = 0;
            let y = 0;
            let color = '#000';
            const partitionY = getPartitionY(msg.partition);

            if (msg.stage === 'producing') {
                // Interpolate from Producer to Partition
                // Progress 0 -> 33 maps to 0 -> 1
                const localProgress = msg.progress / 33;
                
                // X: ProducerX -> PartitionX
                const startX = PRODUCER_X_PCT;
                const endX = PARTITION_X_PCT;
                x = startX + (endX - startX) * localProgress;

                // Y: ProducerY -> PartitionY
                const startY = getProducerY(msg.producerId);
                const endY = partitionY;
                y = startY + (endY - startY) * localProgress;
                
                color = '#FF5722';
            } else if (msg.stage === 'brokered') {
                // Stay at Partition
                // Progress 33 -> 66 maps to 0 -> 1
                // Maybe move slightly right inside the box?
                const localProgress = (msg.progress - 33) / 33;
                
                // X: PartitionX -> PartitionX + small offset? Or just stay
                // Let's make it move slightly across the partition box width
                x = PARTITION_X_PCT + (localProgress * 5); // Move 5% right
                y = partitionY;
                
                color = '#2196F3';
            } else if (msg.stage === 'consuming') {
                // Interpolate from Partition to Consumer
                const consumerIdx = getConsumerForPartition(msg.partition);
                
                if (consumerIdx === -1) {
                    // Drop message if no consumer
                    return null;
                }

                const consumerY = getConsumerY(consumerIdx);
                const localProgress = (msg.progress - 66) / 34;

                // X: PartitionX -> ConsumerX
                const startX = PARTITION_X_PCT + 5; // Start where brokered left off
                const endX = CONSUMER_X_PCT;
                x = startX + (endX - startX) * localProgress;

                // Y: PartitionY -> ConsumerY
                const startY = partitionY;
                const endY = consumerY;
                y = startY + (endY - startY) * localProgress;

                color = '#4CAF50';
            }

            return (
                <React.Fragment key={msg.id}>
                    {/* Main Message */}
                    <div style={{
                        position: 'absolute',
                        left: `${x}%`,
                        top: `${y}px`,
                        transform: 'translate(-50%, -50%)',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: color,
                        zIndex: 20,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                    }} />

                    {/* Replication Visuals (Only in brokered stage) */}
                    {msg.stage === 'brokered' && config.replicationFactor > 1 && (
                        Array.from({ length: config.replicationFactor - 1 }).map((_, rI) => {
                            // Calculate replication animation
                            // Progress 33 -> 66 (33 units)
                            // 33 -> 49.5: Outbound (Data)
                            // 49.5 -> 66: Inbound (Ack)
                            const localProgress = (msg.progress - 33) / 33; // 0 to 1
                            
                            let repX = x;
                            let repY = y;
                            let repColor = '#90CAF9'; // Data color

                            // Target Brokers, not Partitions
                            const leaderBrokerIdx = msg.partition % config.brokers;
                            
                            // Simple Round Robin for replicas to ensure they hit different brokers
                            let targetBrokerIdx = (leaderBrokerIdx + rI + 1) % config.brokers;

                            // Rack Awareness Logic
                            if (config.rackAwareness && config.brokers > 2) {
                                const leaderRack = leaderBrokerIdx % 2;
                                const targetRack = targetBrokerIdx % 2;
                                if (leaderRack === targetRack) {
                                     // Try to find a better broker that isn't the leader
                                     const alternativeBroker = (targetBrokerIdx + 1) % config.brokers;
                                     if (alternativeBroker !== leaderBrokerIdx) {
                                         targetBrokerIdx = alternativeBroker;
                                     }
                                }
                            }

                            // Calculate Target Y based on Broker Center
                            // const brokerHeight = CONTAINER_HEIGHT / config.brokers;
                            // const headerHeight = 27;
                            // const targetBrokerTop = targetBrokerIdx * brokerHeight;
                            // // Target the center of the content area of the broker
                            // const targetY = targetBrokerTop + headerHeight + ((brokerHeight - headerHeight) / 2);
                            
                            // Target the specific Follower Partition Box
                            const targetY = getPartitionY(msg.partition, targetBrokerIdx);
                            
                            // Offset X slightly for replicas so they don't overlap exactly with leaders in that partition
                            const targetXOffset = 3 + rI; // %
                            
                            if (localProgress < 0.5) {
                                // Outbound
                                const phaseProgress = localProgress * 2; // 0 to 1
                                repY = y + (targetY - y) * phaseProgress;
                                repX = x + (phaseProgress * targetXOffset); 
                            } else {
                                // Inbound (Ack) - Hidden
                                return null;
                            }

                            return (
                                <div key={`rep-${msg.id}-${rI}`} style={{
                                    position: 'absolute',
                                    left: `${repX}%`,
                                    top: `${repY}px`,
                                    transform: 'translate(-50%, -50%)',
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    backgroundColor: repColor,
                                    zIndex: 19,
                                    opacity: 0.8,
                                    transition: 'background-color 0.2s'
                                }} />
                            );
                        })
                    )}

                    {/* Producer Ack Visuals */}
                    {config.acks !== '0' && (() => {
                        let showAck = false;
                        let ackProgress = 0;

                        // Acks = 1: Ack immediately upon arrival at Leader (Progress 33)
                        if (config.acks === '1' && msg.progress >= 33 && msg.progress < 50) {
                            showAck = true;
                            ackProgress = (msg.progress - 33) / 17;
                        }
                        // Acks = all: Ack after ISR replication completes (Progress 66)
                        else if (config.acks === 'all' && msg.progress >= 66 && msg.progress < 83) {
                            showAck = true;
                            ackProgress = (msg.progress - 66) / 17;
                        }

                        if (!showAck) return null;

                        const producerY = getProducerY(msg.producerId);
                        // Start at Partition (Leader), End at Producer
                        const startX = PARTITION_X_PCT;
                        const endX = PRODUCER_X_PCT;
                        
                        const ackX = startX + (endX - startX) * ackProgress;
                        const ackY = partitionY + (producerY - partitionY) * ackProgress;

                        return (
                            <div style={{
                                position: 'absolute',
                                left: `${ackX}%`,
                                top: `${ackY}px`,
                                transform: 'translate(-50%, -50%)',
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: '#4CAF50', // Green Ack
                                zIndex: 21,
                                boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                            }} />
                        );
                    })()}
                </React.Fragment>
            );
        })}

      </div>
      
      <div style={{ marginTop: '20px', padding: '10px', background: '#f5f5f5' }}>
        <strong>Stats:</strong> Active Messages: {messages.length}
      </div>
    </div>
  );
};
