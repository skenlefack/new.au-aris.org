declare module '@aris/kafka-client' {
  export const fastifyKafka: any;
  export const KafkaProducerService: any;
  export const KafkaConsumerService: any;
  const _default: any;
  export default _default;
}
declare module '@aris/kafka-client/fastify' {
  export interface FastifyKafka {
    subscribe(opts: any, handler: any): Promise<void>;
    send(topic: string, key: string, payload: unknown, headers?: any): Promise<void>;
    [key: string]: any;
  }
  const _default: any;
  export default _default;
}
