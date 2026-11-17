import { Subject, Subscription, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { GraphDefinition, validateGraph } from './graphValidator.js';
import { resolveDependencyOrder } from './dependencyResolver.js';
import { ExecutionContext, PipelinePacket } from './executionContext.js';
import { createNodeOperator } from '../operators/streamOperators.js';
import { TelemetryDocument } from '../database/mongo.js';

export interface CompiledPipeline {
  graphId: string;
  graphName: string;
  inputSubject: Subject<PipelinePacket>;
  subscription: Subscription;
  context: ExecutionContext;
  status: 'active' | 'paused' | 'stopped';
  stats: {
    processedCount: number;
    lastExecutedAt: Date | null;
    errorCount: number;
    matchedCount: number;
  };
  push: (telemetry: TelemetryDocument) => void;
  destroy: () => void;
}

/**
 * Compiles a visual JSON graph definition into an executable RxJS pipeline.
 */
export function compileGraph(graph: GraphDefinition): CompiledPipeline {
  const validation = validateGraph(graph);
  if (!validation.isValid) {
    throw new Error(`Graph compilation failed:\n${validation.errors.join('\n')}`);
  }

  const graphId = graph.id || `graph-${Date.now()}`;
  const graphName = graph.name || 'Unnamed Pipeline';
  const { sortedNodeIds } = resolveDependencyOrder(graph);
  const context = new ExecutionContext(graphId);
  const inputSubject = new Subject<PipelinePacket>();

  const stats = {
    processedCount: 0,
    lastExecutedAt: null as Date | null,
    errorCount: 0,
    matchedCount: 0,
  };

  let pipeline$ = inputSubject.asObservable();

  // Apply operators in topological order
  const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
  for (const nodeId of sortedNodeIds) {
    const node = nodeMap.get(nodeId);
    if (node) {
      pipeline$ = pipeline$.pipe(createNodeOperator(node, context));
    }
  }

  // Graceful error isolation: errors in one packet do not kill the pipeline
  pipeline$ = pipeline$.pipe(
    catchError((err, caught$) => {
      console.error(`[Pipeline Error in ${graphId}]:`, err);
      stats.errorCount++;
      return caught$; // continue processing subsequent packets
    })
  );

  let status: 'active' | 'paused' | 'stopped' = 'active';

  const subscription = pipeline$.subscribe({
    next: (packet) => {
      stats.processedCount++;
      stats.lastExecutedAt = new Date();
      if (Object.values(packet.matchedConditions).some(Boolean)) {
        stats.matchedCount++;
      }
    },
    error: (err) => {
      stats.errorCount++;
      console.error(`[Fatal Pipeline Error ${graphId}]:`, err);
    },
  });

  const push = (telemetry: TelemetryDocument) => {
    if (status !== 'active') return;

    const packet: PipelinePacket = {
      packetId: `pkt-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      graphId,
      timestamp: telemetry.timestamp || new Date(),
      deviceId: telemetry.metadata.deviceId,
      deviceType: telemetry.metadata.deviceType,
      location: telemetry.metadata.location,
      rawTelemetry: telemetry.measurements || {},
      currentValue: 0,
      evaluatedValues: {},
      matchedConditions: {},
    };

    inputSubject.next(packet);
  };

  const destroy = () => {
    status = 'stopped';
    subscription.unsubscribe();
    inputSubject.complete();
    context.reset();
  };

  return {
    graphId,
    graphName,
    inputSubject,
    subscription,
    context,
    get status() { return status; },
    set status(val) { status = val; },
    stats,
    push,
    destroy,
  };
}
