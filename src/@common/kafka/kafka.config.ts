import { Kafka } from 'kafkajs';

export const getKafkaClient = () =>
  new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID || 'ecommerce-app',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9094').split(','),
  });
