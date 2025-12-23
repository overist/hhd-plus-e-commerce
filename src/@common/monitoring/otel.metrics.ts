import {
  AggregationType,
  InstrumentType,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';

const collectorUrl =
  process.env.OTEL_COLLECTOR_METRICS_URL ||
  'http://otel-collector:4318/v1/metrics';

const metricExporter = new OTLPMetricExporter({ url: collectorUrl });

const metricReader = new PeriodicExportingMetricReader({
  exporter: metricExporter,
  exportIntervalMillis: 5000,
});

const meterProvider = new MeterProvider({
  views: [
    {
      instrumentType: InstrumentType.HISTOGRAM,
      instrumentName: 'http.server.duration',
      aggregation: {
        type: AggregationType.EXPLICIT_BUCKET_HISTOGRAM,
        options: {
          // seconds; cover k6 timeout(60s) and observed long-tail
          boundaries: [
            0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 20, 30, 40,
            50, 60,
          ],
        },
      },
    },
  ],
  readers: [metricReader],
});

const meter = meterProvider.getMeter('hhplus-ecommerce-meter');

export const requestCounter = meter.createCounter('http.server.requests', {
  description: 'Incoming HTTP requests',
});

export const requestDuration = meter.createHistogram('http.server.duration', {
  description: 'HTTP request duration in seconds',
  unit: 's',
});

export function recordRequest(
  method: string,
  route: string,
  statusCode: string,
  durationSeconds: number,
) {
  requestCounter.add(1, { method, route, status_code: statusCode });
  requestDuration.record(durationSeconds, {
    method,
    route,
    status_code: statusCode,
  });
}

export default meterProvider;
