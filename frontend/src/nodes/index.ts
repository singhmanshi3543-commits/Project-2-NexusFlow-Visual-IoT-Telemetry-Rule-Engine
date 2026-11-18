import { DataSourceNode } from './DataSourceNode';
import { MathNode } from './MathNode';
import { ActionNode } from './ActionNode';

export const customNodeTypes = {
  dataSource: DataSourceNode,
  turbineSensor: DataSourceNode,
  temperatureSensor: DataSourceNode,
  humiditySensor: DataSourceNode,
  energySensor: DataSourceNode,
  airQualitySensor: DataSourceNode,
  addition: MathNode,
  subtraction: MathNode,
  multiplication: MathNode,
  division: MathNode,
  movingAverage: MathNode,
  minimum: MathNode,
  maximum: MathNode,
  thresholdComparison: MathNode,
  smsAlert: ActionNode,
  webhook: ActionNode,
  dashboardAlert: ActionNode,
  logEvent: ActionNode,
};

export { DataSourceNode, MathNode, ActionNode };
