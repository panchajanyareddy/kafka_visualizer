export interface KafkaConfig {
  partitions: number;
  replicationFactor: number;
  consumerGroupMembers: number;
  acks: '0' | '1' | 'all';
  retries: number;
  batchSize: number;
  compression: 'none' | 'gzip' | 'snappy' | 'lz4' | 'zstd';
  messageRate: number;
  consumerIntakeRate: number;
  brokers: number;
  rackAwareness: boolean;
  producers: number;
}

export const defaultConfig: KafkaConfig = {
  partitions: 3,
  replicationFactor: 1,
  consumerGroupMembers: 1,
  acks: '1',
  retries: 0,
  batchSize: 16384,
  compression: 'none',
  messageRate: 10,
  consumerIntakeRate: 50,
  brokers: 3,
  rackAwareness: false,
  producers: 1,
};
