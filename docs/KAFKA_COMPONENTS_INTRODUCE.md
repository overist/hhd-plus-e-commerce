# Kafka 구성요소 소개

가정

- Topic의 partition 수: **3**
- 앱 스케일아웃: **2개 인스턴스**(A, B)

---

## 1) Kafka 구성요소(정의)

### Broker & Partition

#### 관점별 브로커의 정의

- 인프라 관점 : 이벤트 메시지를 저장/전달하는 서버 프로세스이자 통신 엔드포인트
- API Server 관점 : Publisher를 통해 메시지를 Kafka에 전달하는 목적지
- Consumer 관점 : 메시지를 구독하기 위해 연결하는 대상
- 코드 레벨 : kafkaClient 생성 시 지정하는 `brokers` 배열의 각 항목(호스트:포트)
- 파티션 관점 : 파티션 자신을 책임지고 제공해주는 리더/팔로워(복제) 역할을 하는 서버 프로세스

#### 특징

- 다수의 브로커가 클러스터를 이루어 고가용성/확장성을 제공함.
  - 브로커 클러스터는 내부적으로 1파티션 1브로커리더 선출, n-1브로커 팔로워 복제 구조를 가짐.
  - Controller가 클러스터 메타데이터를 관리함.

#### 구현된 코드

```typescript
const kafkaClient = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'ecommerce-app',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9094').split(','),
});
```

### Topic & Partition

#### 정의

- Topic: 메시지가 Publish / Subscribe 되는 채널
- Partition: Topic이 쪼개져 실제로 저장되는 큐

#### 특징

- 메시지의 파티션 저장 위치는 프로듀스 시점에 의도적으로 결정하여 활용함
  - 지정시 순서보장, 동시성제어 목적
  - 미지정시 라운드로빈 배분하여 병렬 처리 고성능 목적
- 프로듀서는 "key"를 명세하여 특정 파티션에 몰아넣을 수 있음 (순서 보장)
- 한 파티션은 동시간에 읽을 수 있는 컨슈머 수가 반드시 1개로 제한됨 (동시성 제어)
- 한 토픽에 파티션이 3개로 나뉘어 있으면, 최대 3개의 컨슈머가 동시에 읽을 수 있음 (병렬 성능)

#### 구현된 코드 예시

```typescript
await this.kafkaProducer.send({
  topic: TOPIC_ORDER_PROCESSING_SUCCESS,
  messages: [{ key: String(message.orderId), value: JSON.stringify(message) }],
});
```

### Producer

#### 정의

- Kafka에 메시지를 발행하는 클라이언트.

#### 구현된 코드 예시

```typescript
const producer = kafkaClient.producer();
await producer.connect();
await producer.send(messagePayload);
await producer.disconnect();
```

### Consumer & Consumer Group

#### 정의

- Consumer : Message를 구독하다 꺼내 쓰고 offset을 1 증가시키는 서버 인스턴스
- Consumer Group : 같은 groupId를 가진 Consumer들의 집합, **컨슈머의 논리적 단위**

> Coordinator
> "야 컨슈머그룹 A, (1)파티션에 이벤트 10개 생겼어. 컨슈머a1, 니가 대표자로 읽어. 너네그룹은 지금까지 생긴 10개중 10개 메시지 다 가져갔다? 오케이, 다음."(실제로는 A,B가 병렬처리)
> "야 컨슈머그룹 B, (1)파티션에 이벤트 10개 생겼어. 컨슈머b1, 니가 대표자로 읽어. 너네그룹은 지금까지 생긴 10개중 1개 메시지 가져갔다? 9개 마저 읽어가라."

#### 혼동하기 쉬운 포인트 (컨슈머의 갯수)

- "컨슈머 서버인스턴스" 수 : consumer 모듈을 활성화시킨 NestJS 앱 인스턴스 수
- 컨슈머의 수1 : "컨슈머 서버 인스턴스(NestJS)"가 서버 스케일 아웃시 똑같은 컨슈머가 여러개 존재하게 되나 "같은 groupId"로 묶여 있음
- 컨슈머의 수2 : "컨슈머 서버 인스턴스(NestJS)" 내에서 수십개의 컨슈머를 생성할 수 있으나 "groupId"로 반드시 묶어서 생성함
- **컨슈머 그룹의 수** : 컨슈머 수와 무관하게 groupId 수로 항상 고정됨.

#### 특징

- 파티션이 3개라면 컨슈머 그룹 내 컨슈머 수는 3개로 늘려야 최고 효율 (3:3 병렬 처리)
  - 컨슈머 서버 인스턴스의 스케일 아웃 or 컨슈머 클래스를 늘려서 효율 달성
  - 파티션 수 < 컨슈머 수 : Idle 컨슈머 발생
  - 파티션 수 > 컨슈머 수 : 병렬 처리 한계 발생
- 한 파티션에 동시간에 한 컨슈머만 접근할 수 있음, 코디네이터에 의해 접근가능 컨슈머가 선출됨
- 한 파티션에 연속적으로 여러 컨슈머그룹이 "그룹별 offset"으로 "각자 재접근"하여 다시 읽을 수 있음 (재처리 가능, 관심사 분리)

#### 구현된 코드 예시

```typescript
const consumer = kafkaClient.consumer({ groupId: 'order-processing-group' });
await consumer.connect();
await consumer.subscribe({ topic: 'order.processing', fromBeginning: false });
await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    // 메시지 처리 로직
  },
});
```

### 저장 정책

#### Retention Policy

- 토픽에 저장된 메시지를 보관하는 기간 또는 크기를 지정하는 정책
- 기간 기반: 예: 7일간 보관 후 삭제
- 크기 기반: 예: 1GB 초과 시 오래된 메시지부터 삭제

#### Log Compaction

- 동일 키를 가진 메시지 중 최신 메시지만 보관하는 정책
- Job 등 상태 업데이트 이벤트에 유용

### 카프카의 주요 활용 전략

- 파티션 키를 적절히 설계하여 순서 보장 및 동시성 제어 달성
- 컨슈머 그룹을 활용하여 관심사에 따른 메시지 소비주체 확장(재처리)
- 컨슈머의 능력 범위 내에서 처리가 일어나므로 DB 부하를 카프카로 분산 (모놀리식 아키텍처에도 유용)
