/**
 * 估值数据源适配层 - 统一接口定义
 *
 * 所有估值数据源（新浪分时 V1/V2、新波单点、天天基金等）实现同一套契约，
 * 上层 registry 通过统一接口分发，新增数据源只需实现此接口并注册。
 *
 * 复用 sina.ts 已有的 FundEstimateTimeseries / FundEstimatePointData 类型，
 * 避免类型重复定义。
 */

import type { FundEstimateTimeseries, FundEstimatePointData } from '../sina.js'

/** 适配器类别 */
export type AdapterCategory = 'timeseries' | 'point'

/** 健康检查结果 */
export interface HealthCheckResult {
  ok: boolean
  /** 接口响应延迟（毫秒） */
  latency?: number
  /** 附加信息（错误描述等） */
  message?: string
  /** 检查时间戳 */
  checkedAt: number
}

/** 适配器元数据（用于 UI 展示） */
export interface AdapterMeta {
  /** 唯一 ID，如 'sina_v1' / 'tiantian' */
  id: string
  /** 显示名（中文） */
  name: string
  /** 类别：分时曲线 or 单点 */
  category: AdapterCategory
  /** 描述（数据来源、口径、适用场景等） */
  description: string
  /** 是否为系统内置（内置适配器不可删除，只能启用/禁用） */
  builtin: boolean
}

/** 估值数据源适配器接口 */
export interface EstimateAdapter extends AdapterMeta {
  /** 是否启用 */
  enabled: boolean

  /**
   * 获取分时估值曲线（仅 category='timeseries' 的适配器需要实现）
   * 单点类适配器返回 null 即可
   */
  fetchTimeseries?(code: string): Promise<FundEstimateTimeseries | null>

  /**
   * 获取单点估值（所有适配器都应实现）
   * 分时类适配器可从曲线末点提取，或单独请求单点接口
   */
  fetchPoint(code: string): Promise<FundEstimatePointData | null>

  /**
   * 健康检查：用固定测试代码探测接口可用性
   */
  healthCheck(): Promise<HealthCheckResult>
}

/**
 * 适配器实例的运行时状态（registry 对外暴露的形态）
 *
 * 在 AdapterMeta 基础上附加当前启用状态和最近一次健康检查结果，
 * 供后台 UI 渲染数据源状态卡片。
 */
export interface AdapterStatus extends AdapterMeta {
  enabled: boolean
  health?: HealthCheckResult
}

/**
 * 解析上下文：registry 决定为某只基金使用哪个适配器时的依据
 *
 * 解析优先级：
 *   1. 显式指定的 override（如健康检查、对比工具）
 *   2. 基金级配置 fund_info.estimate_source
 *   3. 全局默认 system_params.ESTIMATE_DEFAULT_SOURCE
 *   4. 降级链 system_params.ESTIMATE_FALLBACK_CHAIN 按序探测
 */
export interface ResolveContext {
  /** 基金代码 */
  code: string
  /** 显式指定适配器 ID（最高优先级） */
  override?: string
}
