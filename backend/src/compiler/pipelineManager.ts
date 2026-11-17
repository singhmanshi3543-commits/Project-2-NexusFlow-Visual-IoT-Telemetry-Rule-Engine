import { CompiledPipeline, compileGraph } from './graphCompiler.js';
import { GraphDefinition } from './graphValidator.js';
import { TelemetryDocument, getDatabase, GraphDefinitionDocument } from '../database/mongo.js';
import { wsHub } from '../websockets/hub.js';

class PipelineManager {
  private pipelines: Map<string, CompiledPipeline> = new Map();

  async loadFromDatabase(): Promise<void> {
    try {
      const db = getDatabase();
      const activeGraphs = await db
        .collection<GraphDefinitionDocument>('graphDefinitions')
        .find({ isActive: true })
        .toArray();

      for (const graphDoc of activeGraphs) {
        try {
          this.compileAndActivate({
            id: graphDoc.id,
            name: graphDoc.name,
            version: graphDoc.version,
            nodes: graphDoc.nodes,
            edges: graphDoc.edges,
          });
          console.log(`[PipelineManager] Auto-loaded and compiled active graph: "${graphDoc.name}" (${graphDoc.id})`);
        } catch (compileErr: any) {
          console.error(`[PipelineManager] Failed to compile saved graph ${graphDoc.id}:`, compileErr.message);
        }
      }
    } catch (err) {
      console.error('[PipelineManager] Error loading graphs from DB:', err);
    }
  }

  compileAndActivate(graph: GraphDefinition): CompiledPipeline {
    const id = graph.id || `graph-${Date.now()}`;
    graph.id = id;

    // If an existing pipeline exists, gracefully destroy it first
    if (this.pipelines.has(id)) {
      this.stop(id);
    }

    const compiled = compileGraph(graph);
    this.pipelines.set(id, compiled);

    wsHub.broadcast('graph:activated', {
      graphId: id,
      name: compiled.graphName,
      status: compiled.status,
      timestamp: new Date().toISOString(),
    });

    console.log(`[PipelineManager] Activated pipeline: ${id} ("${compiled.graphName}")`);
    return compiled;
  }

  pause(graphId: string): boolean {
    const pipeline = this.pipelines.get(graphId);
    if (pipeline) {
      pipeline.status = 'paused';
      wsHub.broadcast('graph:status', { graphId, status: 'paused' });
      return true;
    }
    return false;
  }

  resume(graphId: string): boolean {
    const pipeline = this.pipelines.get(graphId);
    if (pipeline) {
      pipeline.status = 'active';
      wsHub.broadcast('graph:status', { graphId, status: 'active' });
      return true;
    }
    return false;
  }

  stop(graphId: string): boolean {
    const pipeline = this.pipelines.get(graphId);
    if (pipeline) {
      pipeline.destroy();
      this.pipelines.delete(graphId);
      wsHub.broadcast('graph:status', { graphId, status: 'stopped' });
      return true;
    }
    return false;
  }

  recompile(graph: GraphDefinition): CompiledPipeline {
    return this.compileAndActivate(graph);
  }

  // Critical event distribution loop: feeds incoming telemetry into all active pipelines
  dispatchTelemetry(telemetry: TelemetryDocument): void {
    if (this.pipelines.size === 0) return;

    for (const pipeline of this.pipelines.values()) {
      if (pipeline.status === 'active') {
        try {
          pipeline.push(telemetry);
        } catch (err) {
          console.error(`[PipelineManager] Error dispatching to pipeline ${pipeline.graphId}:`, err);
        }
      }
    }
  }

  getPipeline(graphId: string): CompiledPipeline | undefined {
    return this.pipelines.get(graphId);
  }

  getAllPipelines(): {
    graphId: string;
    graphName: string;
    status: string;
    stats: any;
  }[] {
    return Array.from(this.pipelines.values()).map(p => ({
      graphId: p.graphId,
      graphName: p.graphName,
      status: p.status,
      stats: p.stats,
    }));
  }

  shutdown(): void {
    for (const pipeline of this.pipelines.values()) {
      pipeline.destroy();
    }
    this.pipelines.clear();
    console.log('[PipelineManager] All pipelines cleanly stopped.');
  }
}

export const pipelineManager = new PipelineManager();
