# Kafka Operations Runbook

> Apache Kafka 3.7 KRaft mode — 3-broker cluster, no ZooKeeper.

## Cluster Overview

| Component | Endpoints |
|-----------|----------|
| Broker 1 | `kafka-1:29092` (internal), `localhost:9092` (external) |
| Broker 2 | `kafka-2:29094` (internal), `localhost:9094` (external) |
| Broker 3 | `kafka-3:29096` (internal), `localhost:9096` (external) |
| Kafka UI | `http://localhost:8080` |
| Schema Registry | `http://localhost:8081` |

| Setting | Value |
|---------|-------|
| Cluster ID | `MkU3OEVBNTcwNTJENDM2Qk` |
| Replication factor | 3 |
| Min ISR | 2 |
| Default partitions | 3 |
| Retention | 168 hours (7 days) |
| Auto topic creation | Disabled |

---

## 1. Topic Management

### List All Topics

```bash
docker exec kafka-1 kafka-topics.sh \
  --bootstrap-server kafka-1:29092 \
  --list
```

### Create a Topic

```bash
docker exec kafka-1 kafka-topics.sh \
  --bootstrap-server kafka-1:29092 \
  --create \
  --topic ms.health.event.created.v1 \
  --partitions 3 \
  --replication-factor 3 \
  --config min.insync.replicas=2
```

### Describe a Topic

```bash
docker exec kafka-1 kafka-topics.sh \
  --bootstrap-server kafka-1:29092 \
  --describe \
  --topic ms.health.event.created.v1
```

### Modify Partitions (increase only)

```bash
docker exec kafka-1 kafka-topics.sh \
  --bootstrap-server kafka-1:29092 \
  --alter \
  --topic ms.health.event.created.v1 \
  --partitions 6
```

### Delete a Topic

```bash
docker exec kafka-1 kafka-topics.sh \
  --bootstrap-server kafka-1:29092 \
  --delete \
  --topic <topic-name>
```

### Bulk Topic Initialization

All topics are auto-created on `docker compose up` via the `kafka-init` service. To re-initialize:

```bash
pnpm kafka:topics
```

---

## 2. Consumer Group Management

### List Consumer Groups

```bash
docker exec kafka-1 kafka-consumer-groups.sh \
  --bootstrap-server kafka-1:29092 \
  --list
```

### Describe Consumer Group (show lag)

```bash
docker exec kafka-1 kafka-consumer-groups.sh \
  --bootstrap-server kafka-1:29092 \
  --describe \
  --group analytics-health-consumer
```

Output columns: `TOPIC | PARTITION | CURRENT-OFFSET | LOG-END-OFFSET | LAG | CONSUMER-ID | HOST | CLIENT-ID`

### Known Consumer Groups

| Consumer Group | Service | Topics Consumed |
|---------------|---------|-----------------|
| `analytics-health-consumer` | analytics | `ms.health.event.*` |
| `analytics-lab-consumer` | analytics | `ms.health.lab.*` |
| `analytics-vaccination-consumer` | analytics | `ms.health.vaccination.*` |
| `workflow-quality-consumer` | workflow | `au.quality.record.validated.v1` |
| `realtime-health-consumer` | realtime | `ms.health.*`, `au.workflow.*` |
| `interop-wahis-consumer` | interop-hub | `au.workflow.wahis.ready.v1` |
| `data-contract-compliance` | data-contract | `au.quality.*` |

### Reset Consumer Group Offset

**To earliest (reprocess all messages):**

```bash
docker exec kafka-1 kafka-consumer-groups.sh \
  --bootstrap-server kafka-1:29092 \
  --group analytics-health-consumer \
  --topic ms.health.event.created.v1 \
  --reset-offsets \
  --to-earliest \
  --execute
```

**To latest (skip all pending):**

```bash
docker exec kafka-1 kafka-consumer-groups.sh \
  --bootstrap-server kafka-1:29092 \
  --group analytics-health-consumer \
  --topic ms.health.event.created.v1 \
  --reset-offsets \
  --to-latest \
  --execute
```

**To specific offset:**

```bash
docker exec kafka-1 kafka-consumer-groups.sh \
  --bootstrap-server kafka-1:29092 \
  --group analytics-health-consumer \
  --topic ms.health.event.created.v1:0 \
  --reset-offsets \
  --to-offset 42 \
  --execute
```

> Consumer group must be inactive (service stopped) before resetting offsets.

---

## 3. Consumer Lag Monitoring

### Quick Lag Check

```bash
docker exec kafka-1 kafka-consumer-groups.sh \
  --bootstrap-server kafka-1:29092 \
  --describe \
  --group analytics-health-consumer \
  | awk 'NR>1 {sum += $5} END {print "Total lag:", sum}'
```

### Alerting Thresholds

| Severity | Lag Threshold | Action |
|----------|--------------|--------|
| Info | < 100 | Normal operation |
| Warning | 100 - 1,000 | Monitor; check consumer throughput |
| Critical | > 1,000 | Investigate; possible consumer failure |
| Emergency | > 10,000 | Scale consumers or pause producers |

### Prometheus Metrics (Production)

With `kafka-exporter` configured:

```promql
# Consumer lag per group
kafka_consumergroup_lag_sum{consumergroup="analytics-health-consumer"}

# Alert rule
ALERT KafkaConsumerLagHigh
  IF kafka_consumergroup_lag_sum > 1000
  FOR 5m
  LABELS {severity="warning"}
  ANNOTATIONS {summary="High consumer lag on {{ $labels.consumergroup }}"}
```

---

## 4. Partition Rebalancing

### When to Rebalance

- After adding/removing brokers
- After increasing partitions on a topic
- When partition leadership is unevenly distributed

### Check Partition Distribution

```bash
docker exec kafka-1 kafka-topics.sh \
  --bootstrap-server kafka-1:29092 \
  --describe \
  --topic ms.health.event.created.v1
```

Look for uneven `Leader` distribution across broker IDs.

### Preferred Leader Election

```bash
docker exec kafka-1 kafka-leader-election.sh \
  --bootstrap-server kafka-1:29092 \
  --election-type PREFERRED \
  --all-topic-partitions
```

### Reassign Partitions

1. Generate reassignment plan:
```bash
docker exec kafka-1 kafka-reassign-partitions.sh \
  --bootstrap-server kafka-1:29092 \
  --topics-to-move-json-file /tmp/topics.json \
  --broker-list "1,2,3" \
  --generate
```

2. Execute reassignment:
```bash
docker exec kafka-1 kafka-reassign-partitions.sh \
  --bootstrap-server kafka-1:29092 \
  --reassignment-json-file /tmp/reassignment.json \
  --execute
```

3. Verify completion:
```bash
docker exec kafka-1 kafka-reassign-partitions.sh \
  --bootstrap-server kafka-1:29092 \
  --reassignment-json-file /tmp/reassignment.json \
  --verify
```

---

## 5. Message Inspection

### Consume from Topic (Console Consumer)

```bash
# Latest messages
docker exec kafka-1 kafka-console-consumer.sh \
  --bootstrap-server kafka-1:29092 \
  --topic ms.health.event.created.v1 \
  --from-beginning \
  --max-messages 10 \
  --property print.key=true \
  --property print.headers=true
```

### Produce Test Message

```bash
echo '{"eventId":"test-001","diseaseId":"d-001","eventType":"SUSPECT"}' | \
docker exec -i kafka-1 kafka-console-producer.sh \
  --bootstrap-server kafka-1:29092 \
  --topic ms.health.event.created.v1
```

### Inspect DLQ Messages

```bash
docker exec kafka-1 kafka-console-consumer.sh \
  --bootstrap-server kafka-1:29092 \
  --topic dlq.all.v1 \
  --from-beginning \
  --property print.key=true \
  --property print.headers=true
```

---

## 6. Broker Health

### Check Broker Status

```bash
docker exec kafka-1 kafka-metadata.sh \
  --snapshot /var/lib/kafka/data/__cluster_metadata-0/00000000000000000000.log \
  --cluster-id MkU3OEVBNTcwNTJENDM2Qk
```

### Check Under-Replicated Partitions

```bash
docker exec kafka-1 kafka-topics.sh \
  --bootstrap-server kafka-1:29092 \
  --describe \
  --under-replicated-partitions
```

If any under-replicated partitions exist, check:
1. Broker connectivity (`docker logs kafka-1`)
2. Disk space (`docker exec kafka-1 df -h /var/lib/kafka`)
3. Network latency between brokers

### Restart a Broker

```bash
docker compose restart kafka-2
```

Wait for ISR to catch up before restarting another broker.

---

## 7. Common Issues

| Issue | Symptom | Resolution |
|-------|---------|------------|
| Broker not starting | `ERROR ClusterId mismatch` | Verify `CLUSTER_ID` matches across all brokers |
| Consumer not receiving | Lag increasing, no errors | Check consumer group is active; verify topic name |
| Message too large | `RecordTooLargeException` | Increase `message.max.bytes` on broker and topic |
| Replication lag | Under-replicated partitions | Check broker disk I/O and network |
| Topic not found | `UnknownTopicOrPartitionException` | Auto-create is disabled; create topic manually |
| Consumer rebalancing loop | Frequent `JoinGroup` in logs | Increase `session.timeout.ms` and `max.poll.interval.ms` |

---

## 8. Kafka UI

The Kafka UI is available at `http://localhost:8080` and provides:

- Cluster overview (brokers, topics, consumer groups)
- Topic browser (produce/consume messages)
- Consumer group lag monitoring
- Schema registry browser
- Topic configuration management

No authentication is required for the local development UI.
