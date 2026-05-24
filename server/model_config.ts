import { logger } from './logger.js'
import { getProviders, addProvider, getModelsByProvider, addModel, getSceneMappings, setSceneMapping } from './db/modelConfig.js'

export interface ProviderConfig {
  name: string
  api_base: string
  models: Array<{
    model_id: string
    model_name: string
  }>
}

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    name: 'DeepSeek',
    api_base: 'https://api.deepseek.com',
    models: [
      { model_id: 'deepseek-chat', model_name: 'DeepSeek Chat' },
      { model_id: 'deepseek-reasoner', model_name: 'DeepSeek Reasoner' }
    ]
  },
  {
    name: 'OpenAI',
    api_base: 'https://api.openai.com',
    models: [
      { model_id: 'gpt-4o-mini', model_name: 'GPT-4o Mini' },
      { model_id: 'gpt-4o', model_name: 'GPT-4o' }
    ]
  },
  {
    name: 'Qwen',
    api_base: 'https://dashscope.aliyuncs.com/compatible-mode',
    models: [
      { model_id: 'qwen-plus', model_name: 'Qwen Plus' },
      { model_id: 'qwen-turbo', model_name: 'Qwen Turbo' },
      { model_id: 'qwen-max', model_name: 'Qwen Max' }
    ]
  },
  {
    name: 'ZhipuAI',
    api_base: 'https://open.bigmodel.cn/api/paas',
    models: [
      { model_id: 'glm-4-flash', model_name: 'GLM-4 Flash' },
      { model_id: 'glm-4-plus', model_name: 'GLM-4 Plus' },
      { model_id: 'glm-4', model_name: 'GLM-4' }
    ]
  }
]

export const DEFAULT_SCENE_MAPPINGS = [
  { scene: 'fund_analysis', scene_name: '基金智能分析' },
  { scene: 'suggestion_summary', scene_name: '建议问题摘要' }
]

export function seedDefaultData(): void {
  const providers = getProviders()
  if (providers.length > 0) return

  logger.log('🔧 初始化大模型默认配置...')

  for (const pc of DEFAULT_PROVIDERS) {
    const apiKey = pc.name === 'DeepSeek' ? (process.env.LLM_API_KEY || '') : ''
    const provider = addProvider({ name: pc.name, api_base: pc.api_base, api_key: apiKey })
    for (const m of pc.models) {
      addModel({ provider_id: provider.id, model_id: m.model_id, model_name: m.model_name })
    }
  }

  const envModel = process.env.LLM_MODEL || 'deepseek-chat'
  const allProviders = getProviders()
  const deepseek = allProviders.find(p => p.name === 'DeepSeek')
  if (deepseek) {
    for (const sm of DEFAULT_SCENE_MAPPINGS) {
      setSceneMapping({
        scene: sm.scene,
        scene_name: sm.scene_name,
        model_id: envModel,
        provider_id: deepseek.id
      })
    }
  }

  logger.log('✅ 大模型默认配置初始化完成')
}
