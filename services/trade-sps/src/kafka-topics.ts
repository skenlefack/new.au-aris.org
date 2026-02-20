// Trade & SPS Kafka topic constants (local to this service)
// Convention: {scope}.{domain}.{entity}.{action}.v{version}

export const TOPIC_MS_TRADE_FLOW_CREATED = 'ms.trade.flow.created.v1';
export const TOPIC_MS_TRADE_FLOW_UPDATED = 'ms.trade.flow.updated.v1';
export const TOPIC_MS_TRADE_SPS_CERTIFIED = 'ms.trade.sps.certified.v1';
export const TOPIC_MS_TRADE_SPS_UPDATED = 'ms.trade.sps.updated.v1';
export const TOPIC_MS_TRADE_PRICE_RECORDED = 'ms.trade.price.recorded.v1';
export const TOPIC_MS_TRADE_PRICE_UPDATED = 'ms.trade.price.updated.v1';
