# Kafka Flow Visualizer

This is an interactive React application to visualize Kafka message flow rates and behavior based on various configuration parameters.

## Features

- **Interactive Controls**: Adjust partitions, replication factor, consumer group members, acks, retries, batch size, and compression.
- **Visual Representation**: See messages flow from Producer to Brokers (Partitions) to Consumers.
- **Simulation**:
  - **Compression**: Increases message speed (simulating higher throughput).
  - **Acks**: 'all' slows down the flow (simulating latency).
  - **Batch Size**: Larger batches slightly slow down individual message speed but represent higher throughput potential.
  - **Partitions/Consumers**: Visualizes how messages are distributed.

## Getting Started

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Run the development server:
    ```bash
    npm run dev
    ```

3.  Open [http://localhost:5173](http://localhost:5173) in your browser.

## Technologies

-   React
-   TypeScript
-   Vite
