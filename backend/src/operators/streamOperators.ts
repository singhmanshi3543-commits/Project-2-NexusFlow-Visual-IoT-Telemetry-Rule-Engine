import { Observable, OperatorFunction } from 'rxjs';
import { map, filter, tap } from 'rxjs/operators';
import { PipelinePacket, ExecutionContext } from '../compiler/executionContext.js';
import { GraphNode } from '../compiler/graphValidator.js';
import { smsService } from '../alerts/smsService.js';
import { webhookService } from '../webhooks/webhookService.js';
import { getDatabase, AlertDocument } from '../database/mongo.js';
import { wsHub } from '../websockets/hub.js';

/**
 * Creates an RxJS operator for a specific graph node.
 */
export function createNodeOperator(
  node: GraphNode,
  context: ExecutionContext
): OperatorFunction<PipelinePacket, PipelinePacket> {
  const nodeType = node.type;
  const config = node.data || {};

  return (source$: Observable<PipelinePacket>) => {
    switch (nodeType) {
      // --- Data Sources ---
      case 'dataSource':
      case 'turbineSensor':
      case 'temperatureSensor':
      case 'humiditySensor':
      case 'energySensor':
      case 'airQualitySensor': {
        const targetDeviceId = config.deviceId;
        const targetMetric = config.metric || 'temperature';

        return source$.pipe(
          filter((packet: PipelinePacket) => {
            const matches = !targetDeviceId || packet.deviceId === targetDeviceId;
            return matches;
          }),
          map((packet: PipelinePacket) => {
            const startTime = Date.now();
            let metricVal = packet.rawTelemetry[targetMetric];
            if (metricVal === undefined && packet.rawTelemetry.measurements) {
              metricVal = packet.rawTelemetry.measurements[targetMetric];
            }
            const val = typeof metricVal === 'number' ? metricVal : packet.currentValue;

            packet.currentValue = val;
            packet.evaluatedValues[node.id] = val;

            context.emitNodeExecution({
              graphId: context.getGraphId(),
              nodeId: node.id,
              nodeType,
              deviceId: packet.deviceId,
              status: 'success',
              inputValue: packet.rawTelemetry,
              outputValue: val,
              executionTimeMs: Date.now() - startTime,
              timestamp: new Date().toISOString(),
            });

            return packet;
          })
        );
      }

      // --- Math Operations ---
      case 'addition': {
        const operand = Number(config.operand || 0);
        return source$.pipe(
          map((packet: PipelinePacket) => {
            const start = Date.now();
            const inputVal = packet.currentValue;
            const outputVal = Number((inputVal + operand).toFixed(3));
            packet.currentValue = outputVal;
            packet.evaluatedValues[node.id] = outputVal;

            context.emitNodeExecution({
              graphId: context.getGraphId(),
              nodeId: node.id,
              nodeType,
              deviceId: packet.deviceId,
              status: 'success',
              inputValue: inputVal,
              outputValue: outputVal,
              executionTimeMs: Date.now() - start,
              timestamp: new Date().toISOString(),
            });
            return packet;
          })
        );
      }

      case 'subtraction': {
        const operand = Number(config.operand || 0);
        return source$.pipe(
          map((packet: PipelinePacket) => {
            const start = Date.now();
            const inputVal = packet.currentValue;
            const outputVal = Number((inputVal - operand).toFixed(3));
            packet.currentValue = outputVal;
            packet.evaluatedValues[node.id] = outputVal;

            context.emitNodeExecution({
              graphId: context.getGraphId(),
              nodeId: node.id,
              nodeType,
              deviceId: packet.deviceId,
              status: 'success',
              inputValue: inputVal,
              outputValue: outputVal,
              executionTimeMs: Date.now() - start,
              timestamp: new Date().toISOString(),
            });
            return packet;
          })
        );
      }

      case 'multiplication': {
        const operand = Number(config.operand !== undefined ? config.operand : 1);
        return source$.pipe(
          map((packet: PipelinePacket) => {
            const start = Date.now();
            const inputVal = packet.currentValue;
            const outputVal = Number((inputVal * operand).toFixed(3));
            packet.currentValue = outputVal;
            packet.evaluatedValues[node.id] = outputVal;

            context.emitNodeExecution({
              graphId: context.getGraphId(),
              nodeId: node.id,
              nodeType,
              deviceId: packet.deviceId,
              status: 'success',
              inputValue: inputVal,
              outputValue: outputVal,
              executionTimeMs: Date.now() - start,
              timestamp: new Date().toISOString(),
            });
            return packet;
          })
        );
      }

      case 'division': {
        const operand = Number(config.operand || 1) || 1; // prevent divide-by-zero
        return source$.pipe(
          map((packet: PipelinePacket) => {
            const start = Date.now();
            const inputVal = packet.currentValue;
            const outputVal = Number((inputVal / operand).toFixed(3));
            packet.currentValue = outputVal;
            packet.evaluatedValues[node.id] = outputVal;

            context.emitNodeExecution({
              graphId: context.getGraphId(),
              nodeId: node.id,
              nodeType,
              deviceId: packet.deviceId,
              status: 'success',
              inputValue: inputVal,
              outputValue: outputVal,
              executionTimeMs: Date.now() - start,
              timestamp: new Date().toISOString(),
            });
            return packet;
          })
        );
      }

      case 'movingAverage': {
        const windowSize = Math.max(2, Number(config.windowSize || 5));
        return source$.pipe(
          map((packet: PipelinePacket) => {
            const start = Date.now();
            const inputVal = packet.currentValue;
            const window = context.updateWindow(node.id, inputVal, windowSize);
            const sum = window.reduce((a, b) => a + b, 0);
            const avg = Number((sum / window.length).toFixed(3));

            packet.currentValue = avg;
            packet.evaluatedValues[node.id] = avg;

            context.emitNodeExecution({
              graphId: context.getGraphId(),
              nodeId: node.id,
              nodeType,
              deviceId: packet.deviceId,
              status: 'success',
              inputValue: inputVal,
              outputValue: avg,
              executionTimeMs: Date.now() - start,
              timestamp: new Date().toISOString(),
            });
            return packet;
          })
        );
      }

      case 'minimum': {
        const windowSize = Math.max(2, Number(config.windowSize || 5));
        return source$.pipe(
          map((packet: PipelinePacket) => {
            const start = Date.now();
            const inputVal = packet.currentValue;
            const window = context.updateWindow(node.id, inputVal, windowSize);
            const min = Math.min(...window);

            packet.currentValue = min;
            packet.evaluatedValues[node.id] = min;

            context.emitNodeExecution({
              graphId: context.getGraphId(),
              nodeId: node.id,
              nodeType,
              deviceId: packet.deviceId,
              status: 'success',
              inputValue: inputVal,
              outputValue: min,
              executionTimeMs: Date.now() - start,
              timestamp: new Date().toISOString(),
            });
            return packet;
          })
        );
      }

      case 'maximum': {
        const windowSize = Math.max(2, Number(config.windowSize || 5));
        return source$.pipe(
          map((packet: PipelinePacket) => {
            const start = Date.now();
            const inputVal = packet.currentValue;
            const window = context.updateWindow(node.id, inputVal, windowSize);
            const max = Math.max(...window);

            packet.currentValue = max;
            packet.evaluatedValues[node.id] = max;

            context.emitNodeExecution({
              graphId: context.getGraphId(),
              nodeId: node.id,
              nodeType,
              deviceId: packet.deviceId,
              status: 'success',
              inputValue: inputVal,
              outputValue: max,
              executionTimeMs: Date.now() - start,
              timestamp: new Date().toISOString(),
            });
            return packet;
          })
        );
      }

      case 'thresholdComparison': {
        const op = config.operator || '>';
        const threshold = Number(config.threshold || 50);

        return source$.pipe(
          filter((packet: PipelinePacket) => {
            const start = Date.now();
            const val = packet.currentValue;
            let conditionMet = false;

            switch (op) {
              case '>': conditionMet = val > threshold; break;
              case '<': conditionMet = val < threshold; break;
              case '>=': conditionMet = val >= threshold; break;
              case '<=': conditionMet = val <= threshold; break;
              case '==': conditionMet = val === threshold; break;
              case '!=': conditionMet = val !== threshold; break;
            }

            packet.matchedConditions[node.id] = conditionMet;
            packet.evaluatedValues[node.id] = { val, threshold, operator: op, conditionMet };

            context.emitNodeExecution({
              graphId: context.getGraphId(),
              nodeId: node.id,
              nodeType,
              deviceId: packet.deviceId,
              status: conditionMet ? 'alert' : 'filtered',
              inputValue: val,
              outputValue: { threshold, conditionMet },
              executionTimeMs: Date.now() - start,
              timestamp: new Date().toISOString(),
            });

            if (conditionMet) {
              wsHub.broadcast('rule:matched', {
                graphId: context.getGraphId(),
                nodeId: node.id,
                deviceId: packet.deviceId,
                value: val,
                threshold,
                operator: op,
                timestamp: new Date().toISOString(),
              });
            }

            return conditionMet; // only allow packet to continue down the pipe if condition is met
          })
        );
      }

      // --- Action Trigger Nodes ---
      case 'smsAlert': {
        const cooldown = Number(config.cooldownSeconds || 30);
        const recipient = config.recipient || '+1 (555) 019-2834';

        return source$.pipe(
          tap((packet: PipelinePacket) => {
            if (context.shouldTriggerAlert(node.id, cooldown)) {
              smsService.sendAlertSms({
                recipient,
                deviceId: packet.deviceId,
                parameter: 'Telemetry Sensor',
                value: packet.currentValue,
                threshold: 0,
                message: `[NexusFlow Pipeline Alert] Device ${packet.deviceId} value=${packet.currentValue}`,
              }).catch(err => console.error('[SMS Trigger Error]', err));

              context.emitNodeExecution({
                graphId: context.getGraphId(),
                nodeId: node.id,
                nodeType,
                deviceId: packet.deviceId,
                status: 'alert',
                inputValue: packet.currentValue,
                outputValue: 'SMS Sent',
                executionTimeMs: 1,
                timestamp: new Date().toISOString(),
              });
            }
          })
        );
      }

      case 'webhook': {
        const targetUrl = config.url || 'http://127.0.0.1:8000/api/mock-webhook-receiver';
        const retries = Number(config.retries || 3);
        const timeoutMs = Number(config.timeoutMs || 4000);

        return source$.pipe(
          tap((packet: PipelinePacket) => {
            webhookService.dispatch({
              url: targetUrl,
              payload: {
                graphId: context.getGraphId(),
                nodeId: node.id,
                deviceId: packet.deviceId,
                currentValue: packet.currentValue,
                timestamp: packet.timestamp,
              },
              retries,
              timeoutMs,
            }).catch(err => console.error('[Webhook Dispatch Error]', err));

            context.emitNodeExecution({
              graphId: context.getGraphId(),
              nodeId: node.id,
              nodeType,
              deviceId: packet.deviceId,
              status: 'success',
              inputValue: packet.currentValue,
              outputValue: `Webhook queued: ${targetUrl}`,
              executionTimeMs: 1,
              timestamp: new Date().toISOString(),
            });
          })
        );
      }

      case 'dashboardAlert': {
        const severity = config.severity || 'critical';
        const cooldown = Number(config.cooldownSeconds || 30);

        return source$.pipe(
          tap((packet: PipelinePacket) => {
            if (context.shouldTriggerAlert(node.id, cooldown)) {
              const alertMsg = config.message || `Pipeline rule triggered on ${packet.deviceId}: value is ${packet.currentValue}`;

              const alertDoc: AlertDocument = {
                graphId: context.getGraphId(),
                nodeId: node.id,
                deviceId: packet.deviceId,
                parameter: 'Pipeline Node ' + node.id,
                observedValue: packet.currentValue,
                thresholdValue: 0,
                severity,
                status: 'active',
                message: alertMsg,
                createdAt: new Date(),
              };

              try {
                const db = getDatabase();
                db.collection('alerts').insertOne(alertDoc).then(res => {
                  alertDoc.id = res.insertedId.toString();
                  wsHub.broadcast('alert:created', alertDoc);
                }).catch(err => console.error('[Alert Insert Error]', err));
              } catch (dbErr) {
                // If db disconnected, broadcast via websocket directly
                wsHub.broadcast('alert:created', alertDoc);
              }

              context.emitNodeExecution({
                graphId: context.getGraphId(),
                nodeId: node.id,
                nodeType,
                deviceId: packet.deviceId,
                status: 'alert',
                inputValue: packet.currentValue,
                outputValue: 'Alert Dispatched',
                executionTimeMs: 1,
                timestamp: new Date().toISOString(),
              });
            }
          })
        );
      }

      case 'logEvent': {
        return source$.pipe(
          tap((packet: PipelinePacket) => {
            try {
              const db = getDatabase();
              db.collection('executionLogs').insertOne({
                graphId: context.getGraphId(),
                nodeId: node.id,
                deviceId: packet.deviceId,
                status: 'success',
                observedValue: packet.currentValue,
                latencyMs: 1,
                timestamp: new Date(),
              }).catch(() => {});
            } catch {}

            context.emitNodeExecution({
              graphId: context.getGraphId(),
              nodeId: node.id,
              nodeType,
              deviceId: packet.deviceId,
              status: 'success',
              inputValue: packet.currentValue,
              outputValue: 'Logged to DB',
              executionTimeMs: 1,
              timestamp: new Date().toISOString(),
            });
          })
        );
      }

      default:
        return source$;
    }
  };
}
