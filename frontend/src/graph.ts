import type { Node, Edge, XYPosition } from '@xyflow/react';
import type {
  ComparisonOperator,
  AlertSeverity,
  VisualNodeData,
  VisualGraphDefinition,
} from './index';

/**
 * Allowlisted Data Source Node Types
 */
export type DataSourceNodeType =
  | 'dataSource'
  | 'turbineSensor'
  | 'temperatureSensor'
  | 'humiditySensor'
  | 'energySensor'
  | 'airQualitySensor';

/**
 * Allowlisted Math & Transformation Node Types
 */
export type MathNodeType =
  | 'addition'
  | 'subtraction'
  | 'multiplication'
  | 'division'
  | 'movingAverage'
  | 'minimum'
  | 'maximum'
  | 'thresholdComparison';

/**
 * Allowlisted Action Trigger Node Types
 */
export type ActionNodeType =
  | 'smsAlert'
  | 'webhook'
  | 'dashboardAlert'
  | 'logEvent';

/**
 * Union of all supported workflow node types in NexusFlow
 */
export type WorkflowNodeType = DataSourceNodeType | MathNodeType | ActionNodeType | string;

/**
 * Specialized Data Source node configuration data
 */
export interface DataSourceNodeData extends VisualNodeData {
  deviceId: string;
  metric: 'temperature' | 'humidity' | 'energy' | 'aqi' | string;
  label?: string;
}

/**
 * Specialized Math & Operational node configuration data
 */
export interface MathNodeData extends VisualNodeData {
  operand?: number;
  windowSize?: number;
  operator?: ComparisonOperator;
  threshold?: number;
  label?: string;
}

/**
 * Specialized Action Trigger node configuration data
 */
export interface ActionNodeData extends VisualNodeData {
  recipient?: string;
  url?: string;
  severity?: AlertSeverity;
  cooldownSeconds?: number;
  message?: string;
  logLevel?: string;
  label?: string;
}

/**
 * Node Data type reused directly from VisualNodeData, augmented with index signature
 * to satisfy React Flow's Node<Record<string, unknown>> generic constraint.
 */
export type WorkflowNodeData = VisualNodeData & Record<string, unknown>;

/**
 * Visual Workflow Node conforming to React Flow's Node interface
 */
export interface WorkflowNode extends Node<WorkflowNodeData> {
  id: string;
  type: WorkflowNodeType;
  position: XYPosition;
  data: WorkflowNodeData;
  selected?: boolean;
  dragging?: boolean;
}

/**
 * Visual Workflow Edge conforming to React Flow's Edge interface
 */
export interface WorkflowEdge extends Edge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  animated?: boolean;
  className?: string;
  style?: React.CSSProperties;
  label?: string;
}

/**
 * Execution & runtime analytics metadata for a workflow graph
 */
export interface WorkflowExecutionStats {
  executionCount?: number;
  lastExecutedAt?: string | null;
  failureCount?: number;
  avgLatencyMs?: number;
  matchedCount?: number;
}

/**
 * Comprehensive graph metadata: author, tags, audit timestamps, and operational stats
 */
export interface WorkflowGraphMetadata {
  author?: string;
  description?: string;
  tags?: string[];
  category?: string;
  targetDevices?: string[];
  createdAt?: string;
  updatedAt?: string;
  version?: number;
  executionStats?: WorkflowExecutionStats;
  customProperties?: Record<string, any>;
}

/**
 * Primary Workflow Graph Data Model.
 * Fully compatible with VisualGraphDefinition, with strong typing for nodes, edges, and metadata.
 */
export interface WorkflowGraph extends Omit<VisualGraphDefinition, 'nodes' | 'edges'> {
  id: string;
  name: string;
  description: string;
  version: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  metadata?: WorkflowGraphMetadata;
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

/**
 * Serialized representation of a single node in JSON format
 */
export interface SerializedWorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: WorkflowNodeData;
}

/**
 * Serialized representation of a single edge in JSON format
 */
export interface SerializedWorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  animated?: boolean;
  className?: string;
  style?: Record<string, any>;
  label?: string;
}

/**
 * Serialized portable JSON format for workflow graphs
 */
export interface SerializedWorkflowGraph {
  format: 'nexusflow-workflow';
  schemaVersion: string;
  id: string;
  name: string;
  description: string;
  version: number;
  isActive: boolean;
  nodes: SerializedWorkflowNode[];
  edges: SerializedWorkflowEdge[];
  metadata?: WorkflowGraphMetadata;
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
  exportedAt: string;
}

/**
 * Options to customize graph serialization
 */
export interface SerializationOptions {
  pretty?: boolean;
  indent?: number;
  includeMetadata?: boolean;
  stripRuntimeState?: boolean;
  schemaVersion?: string;
}

/**
 * Validation error item with specific code and optional node/edge context
 */
export interface GraphValidationError {
  code: string;
  message: string;
  field?: string;
  nodeId?: string;
  edgeId?: string;
}

/**
 * Validation result from checking a workflow graph
 */
export interface GraphValidationResult {
  isValid: boolean;
  errors: GraphValidationError[];
  warnings: string[];
}

/**
 * Result returned by safe deserialization attempt
 */
export interface DeserializationResult {
  success: boolean;
  graph?: WorkflowGraph;
  errors?: GraphValidationError[];
  warnings?: string[];
}
