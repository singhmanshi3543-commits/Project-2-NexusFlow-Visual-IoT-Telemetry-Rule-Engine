import { Router, Request, Response } from 'express';
import { getDatabase, GraphDefinitionDocument } from '../database/mongo.js';
import { validateGraph } from '../compiler/graphValidator.js';
import { pipelineManager } from '../compiler/pipelineManager.js';
import { NODE_DEFINITIONS } from '../compiler/nodeRegistry.js';

const router = Router();

// GET /api/graphs/nodes/schema - Node registry catalog for visual canvas
router.get('/nodes/schema', (_req: Request, res: Response) => {
  res.json({
    nodes: Object.values(NODE_DEFINITIONS),
  });
});

// GET /api/graphs/pipelines/active - Active pipeline runtime telemetry
router.get('/pipelines/active', (_req: Request, res: Response) => {
  const active = pipelineManager.getAllPipelines();
  res.json(active);
});

// GET /api/graphs - List all saved graphs
router.get('/', async (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const graphs = await db.collection<GraphDefinitionDocument>('graphDefinitions').find().toArray();
    res.json(graphs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/graphs/:id - Retrieve specific graph definition
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const graph = await db.collection<GraphDefinitionDocument>('graphDefinitions').findOne({ id: req.params.id });
    if (!graph) {
      return res.status(404).json({ error: 'Graph not found' });
    }
    res.json(graph);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/graphs - Create a new graph
router.post('/', async (req: Request, res: Response) => {
  try {
    const { id, name, description, nodes, edges, isActive } = req.body;
    const graphId = id || `graph-${Date.now()}`;

    const validation = validateGraph({ id: graphId, nodes, edges });

    const doc: GraphDefinitionDocument = {
      id: graphId,
      name: name || 'Untitled Visual Pipeline',
      description: description || '',
      version: 1,
      nodes: nodes || [],
      edges: edges || [],
      isActive: isActive !== false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const db = getDatabase();
    await db.collection<GraphDefinitionDocument>('graphDefinitions').updateOne(
      { id: graphId },
      { $set: doc },
      { upsert: true }
    );

    // If active and valid, compile immediately
    if (doc.isActive && validation.isValid) {
      try {
        pipelineManager.compileAndActivate(doc);
      } catch (compileErr) {
        console.warn(`[Graph API] Auto-activation deferred:`, compileErr);
      }
    }

    res.status(201).json({
      success: true,
      graph: doc,
      validation,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/graphs/:id - Update existing graph
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const graphId = req.params.id;
    const { name, description, nodes, edges, isActive, version } = req.body;

    const validation = validateGraph({ id: graphId, nodes, edges });

    const db = getDatabase();
    const updateFields: any = {
      updatedAt: new Date(),
    };
    if (name !== undefined) updateFields.name = name;
    if (description !== undefined) updateFields.description = description;
    if (nodes !== undefined) updateFields.nodes = nodes;
    if (edges !== undefined) updateFields.edges = edges;
    if (isActive !== undefined) updateFields.isActive = isActive;
    if (version !== undefined) updateFields.version = version + 1;

    const result = await db.collection<GraphDefinitionDocument>('graphDefinitions').findOneAndUpdate(
      { id: graphId },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ error: 'Graph not found' });
    }

    // Recompile if active
    if (result.isActive && validation.isValid) {
      try {
        pipelineManager.recompile(result);
      } catch (compileErr: any) {
        console.warn(`[Graph API] Recompilation warning:`, compileErr.message);
      }
    } else if (!result.isActive) {
      pipelineManager.stop(graphId);
    }

    res.json({
      success: true,
      graph: result,
      validation,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/graphs/:id - Delete graph and shutdown pipeline
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const graphId = req.params.id;
    pipelineManager.stop(graphId);

    const db = getDatabase();
    const result = await db.collection('graphDefinitions').deleteOne({ id: graphId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Graph not found' });
    }

    res.json({ success: true, message: `Graph ${graphId} deleted successfully` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/graphs/:id/compile - Validate and dry-run compile
router.post('/:id/compile', async (req: Request, res: Response) => {
  try {
    const graphId = req.params.id;
    let graph = req.body.nodes ? req.body : null;

    if (!graph) {
      const db = getDatabase();
      graph = await db.collection<GraphDefinitionDocument>('graphDefinitions').findOne({ id: graphId });
    }

    if (!graph) {
      return res.status(404).json({ error: 'Graph not found' });
    }

    const validation = validateGraph(graph);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Graph validation failed',
        errors: validation.errors,
        warnings: validation.warnings,
      });
    }

    res.json({
      success: true,
      message: 'Graph compiled and validated successfully with no errors',
      validation,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/graphs/:id/activate - Compile and register active pipeline
router.post('/:id/activate', async (req: Request, res: Response) => {
  try {
    const graphId = req.params.id;
    const db = getDatabase();
    const graph = await db.collection<GraphDefinitionDocument>('graphDefinitions').findOne({ id: graphId });

    if (!graph) {
      return res.status(404).json({ error: 'Graph not found' });
    }

    const validation = validateGraph(graph);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Cannot activate invalid graph',
        errors: validation.errors,
      });
    }

    const compiled = pipelineManager.compileAndActivate(graph);
    await db.collection('graphDefinitions').updateOne({ id: graphId }, { $set: { isActive: true } });

    res.json({
      success: true,
      message: `Pipeline "${compiled.graphName}" activated successfully`,
      graphId,
      status: compiled.status,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/graphs/:id/pause
router.post('/:id/pause', (req: Request, res: Response) => {
  const ok = pipelineManager.pause(req.params.id);
  res.json({ success: ok, status: ok ? 'paused' : 'not_found' });
});

// POST /api/graphs/:id/resume
router.post('/:id/resume', (req: Request, res: Response) => {
  const ok = pipelineManager.resume(req.params.id);
  res.json({ success: ok, status: ok ? 'active' : 'not_found' });
});

// POST /api/graphs/:id/stop
router.post('/:id/stop', (req: Request, res: Response) => {
  const ok = pipelineManager.stop(req.params.id);
  res.json({ success: ok, status: ok ? 'stopped' : 'not_found' });
});

export default router;
