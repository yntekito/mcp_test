#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import AWS from "aws-sdk";

// AWS CloudWatch client
const cloudwatch = new AWS.CloudWatch({ region: 'us-east-1' });

class AWSMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "aws-cloudwatch-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "get_cloudwatch_metrics",
            description: "CloudWatchからメトリクスを取得します",
            inputSchema: {
              type: "object",
              properties: {
                namespace: {
                  type: "string",
                  description: "CloudWatchネームスペース (例: AWS/EC2, AWS/RDS)",
                },
                metricName: {
                  type: "string",
                  description: "メトリクス名 (例: CPUUtilization, NetworkIn)",
                },
                dimensions: {
                  type: "array",
                  description: "ディメンション",
                  items: {
                    type: "object",
                    properties: {
                      Name: { type: "string" },
                      Value: { type: "string" }
                    }
                  }
                },
                startTime: {
                  type: "string",
                  description: "開始時刻 (ISO 8601形式)",
                },
                endTime: {
                  type: "string",
                  description: "終了時刻 (ISO 8601形式)",
                },
                period: {
                  type: "number",
                  description: "期間（秒）",
                  default: 300
                },
                statistic: {
                  type: "string",
                  description: "統計値 (Average, Sum, Maximum, Minimum, SampleCount)",
                  default: "Average"
                }
              },
              required: ["namespace", "metricName"]
            },
          },
          {
            name: "list_cloudwatch_metrics",
            description: "利用可能なCloudWatchメトリクスを一覧表示します",
            inputSchema: {
              type: "object",
              properties: {
                namespace: {
                  type: "string",
                  description: "CloudWatchネームスペース (例: AWS/EC2, AWS/RDS)",
                },
                metricName: {
                  type: "string",
                  description: "メトリクス名でフィルタリング",
                }
              }
            },
          },
          {
            name: "get_ec2_cpu_metrics",
            description: "EC2インスタンスのCPU使用率を取得します",
            inputSchema: {
              type: "object",
              properties: {
                instanceId: {
                  type: "string",
                  description: "EC2インスタンスID",
                },
                hours: {
                  type: "number",
                  description: "過去何時間のデータを取得するか",
                  default: 1
                }
              },
              required: ["instanceId"]
            },
          }
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "get_cloudwatch_metrics":
            return await this.getCloudWatchMetrics(args);
          case "list_cloudwatch_metrics":
            return await this.listCloudWatchMetrics(args);
          case "get_ec2_cpu_metrics":
            return await this.getEC2CPUMetrics(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing tool ${name}: ${error.message}`
        );
      }
    });
  }

  async getCloudWatchMetrics(args) {
    const {
      namespace,
      metricName,
      dimensions = [],
      startTime,
      endTime,
      period = 300,
      statistic = 'Average'
    } = args;

    const params = {
      Namespace: namespace,
      MetricName: metricName,
      Dimensions: dimensions,
      StartTime: startTime ? new Date(startTime) : new Date(Date.now() - 3600000), // 1時間前
      EndTime: endTime ? new Date(endTime) : new Date(),
      Period: period,
      Statistics: [statistic]
    };

    try {
      const data = await cloudwatch.getMetricStatistics(params).promise();
      
      const result = {
        namespace,
        metricName,
        statistic,
        datapoints: data.Datapoints.map(point => ({
          timestamp: point.Timestamp,
          value: point[statistic],
          unit: point.Unit
        })).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      };

      return {
        content: [
          {
            type: "text",
            text: `CloudWatch メトリクス: ${namespace}/${metricName}\n\n` +
                  `統計値: ${statistic}\n` +
                  `データポイント数: ${result.datapoints.length}\n\n` +
                  `最新の値:\n` +
                  result.datapoints.slice(-5).map(dp => 
                    `${dp.timestamp}: ${dp.value} ${dp.unit}`
                  ).join('\n') +
                  `\n\n詳細データ:\n${JSON.stringify(result, null, 2)}`
          }
        ]
      };
    } catch (error) {
      throw new Error(`CloudWatch API エラー: ${error.message}`);
    }
  }

  async listCloudWatchMetrics(args) {
    const { namespace, metricName } = args;

    const params = {
      ...(namespace && { Namespace: namespace }),
      ...(metricName && { MetricName: metricName })
    };

    try {
      const data = await cloudwatch.listMetrics(params).promise();
      
      const metrics = data.Metrics.map(metric => ({
        namespace: metric.Namespace,
        metricName: metric.MetricName,
        dimensions: metric.Dimensions
      }));

      return {
        content: [
          {
            type: "text",
            text: `利用可能なCloudWatchメトリクス (${metrics.length}個)\n\n` +
                  metrics.slice(0, 10).map(m => 
                    `• ${m.namespace}/${m.metricName}` +
                    (m.dimensions.length > 0 ? 
                      ` (${m.dimensions.map(d => `${d.Name}=${d.Value}`).join(', ')})` : 
                      '')
                  ).join('\n') +
                  (metrics.length > 10 ? `\n\n... および他${metrics.length - 10}個` : '') +
                  `\n\n詳細データ:\n${JSON.stringify(metrics, null, 2)}`
          }
        ]
      };
    } catch (error) {
      throw new Error(`CloudWatch API エラー: ${error.message}`);
    }
  }

  async getEC2CPUMetrics(args) {
    const { instanceId, hours = 1 } = args;

    const params = {
      Namespace: 'AWS/EC2',
      MetricName: 'CPUUtilization',
      Dimensions: [
        {
          Name: 'InstanceId',
          Value: instanceId
        }
      ],
      StartTime: new Date(Date.now() - hours * 3600000),
      EndTime: new Date(),
      Period: 300,
      Statistics: ['Average', 'Maximum']
    };

    try {
      const data = await cloudwatch.getMetricStatistics(params).promise();
      
      const datapoints = data.Datapoints.map(point => ({
        timestamp: point.Timestamp,
        average: point.Average,
        maximum: point.Maximum,
        unit: point.Unit
      })).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      const avgCPU = datapoints.length > 0 ? 
        datapoints.reduce((sum, dp) => sum + dp.average, 0) / datapoints.length : 0;

      return {
        content: [
          {
            type: "text",
            text: `EC2インスタンス ${instanceId} のCPU使用率\n\n` +
                  `期間: 過去${hours}時間\n` +
                  `平均CPU使用率: ${avgCPU.toFixed(2)}%\n` +
                  `データポイント数: ${datapoints.length}\n\n` +
                  `最新の5つのデータポイント:\n` +
                  datapoints.slice(-5).map(dp => 
                    `${dp.timestamp}: 平均${dp.average.toFixed(2)}% 最大${dp.maximum.toFixed(2)}%`
                  ).join('\n') +
                  `\n\n詳細データ:\n${JSON.stringify(datapoints, null, 2)}`
          }
        ]
      };
    } catch (error) {
      throw new Error(`EC2 CPU メトリクス取得エラー: ${error.message}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("AWS CloudWatch MCP Server running on stdio");
  }
}

// Run the server
const server = new AWSMCPServer();
server.run().catch(console.error);