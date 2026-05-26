<template>
  <div class="page">
    <header class="page-header">
      <div class="header-inner">
        <button class="back-btn" @click="$router.push('/')">
          <svg viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <h1 class="page-title">说明</h1>
      </div>
    </header>

    <div class="container">
      <div class="card">
        <div class="card-header">
          <svg viewBox="0 0 24 24" fill="none" class="card-icon">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="currentColor" stroke-width="1.5"/>
            <path d="M12 8v5M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span>免责说明</span>
        </div>

        <div class="item">
          <div class="item-dot" style="background:#3B82F6"></div>
          <div class="item-content">
            <div class="item-title">学习交流</div>
            <div class="item-text">本平台是一个用于基金数据学习和交流的工具，所有展示的数据、分析和 AI 智能分析内容均基于公开信息整理，仅供学习参考，不构成任何形式的投资建议、推荐或承诺。</div>
          </div>
        </div>

        <div class="item">
          <div class="item-dot" style="background:#F59E0B"></div>
          <div class="item-content">
            <div class="item-title">投资风险</div>
            <div class="item-text">基金投资有风险，过往业绩不代表未来表现。市场波动可能导致投资本金损失，投资者应充分了解基金产品的风险特征，根据自身的风险承受能力独立做出投资决策。</div>
          </div>
        </div>

        <div class="item">
          <div class="item-dot" style="background:#10B981"></div>
          <div class="item-content">
            <div class="item-title">数据来源</div>
            <div class="item-text">本平台基金数据来源于公开市场信息接口，我们尽力确保数据的准确性和及时性，但不对数据的完整性和准确性做出任何保证。如数据存在延迟或错误，请以基金公司官方披露为准。</div>
          </div>
        </div>

        <div class="item">
          <div class="item-dot" style="background:#8B5CF6"></div>
          <div class="item-content">
            <div class="item-title">AI 分析</div>
            <div class="item-text">AI 智能分析功能基于大语言模型生成，分析结果仅供参考和学习使用。AI 可能产生不准确、不完整或误导性的内容，不应将其作为投资决策的依据。用户需自行判断和承担使用风险。</div>
          </div>
        </div>

        <div class="item last">
          <div class="item-dot" style="background:#EC4899"></div>
          <div class="item-content">
            <div class="item-title">隐私安全</div>
            <div class="item-text">我们重视用户隐私保护，不会收集或存储敏感个人财务信息。用户在使用本平台时输入的基金代码和持仓数据仅用于本地计算和展示，不会被用于其他商业用途。</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%);
}

.page-header {
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(0,0,0,0.06);
  padding: 12px 0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-inner {
  max-width: 860px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.back-btn {
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  background: #F1F5F9; border: none; border-radius: 8px;
  cursor: pointer; color: #475569; transition: all 0.15s;
}
.back-btn:hover { background: #E2E8F0; color: #334155; }
.back-btn svg { width: 16px; height: 16px; }

.page-title {
  font-size: 17px; font-weight: 700; color: #0F172A;
  margin: 0; letter-spacing: -0.02em;
}

.container {
  max-width: 860px;
  margin: 0 auto;
  padding: 20px 20px 40px;
}

.card {
  background: white;
  border-radius: 16px;
  padding: 0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04);
  overflow: hidden;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 20px;
  background: linear-gradient(135deg, #EFF6FF 0%, #F0F9FF 100%);
  border-bottom: 1px solid #E0EFFE;
  font-size: 14px;
  font-weight: 600;
  color: #1E40AF;
}

.card-icon {
  width: 18px; height: 18px; flex-shrink: 0; color: #3B82F6;
}

.item {
  display: flex;
  gap: 14px;
  padding: 16px 20px;
  border-bottom: 1px solid #F3F4F6;
  transition: background 0.15s;
}
.item:hover { background: #FAFBFC; }
.item.last { border-bottom: none; }

.item-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 6px;
}

.item-content { flex: 1; }

.item-title {
  font-size: 13px;
  font-weight: 600;
  color: #1E293B;
  margin-bottom: 4px;
}

.item-text {
  font-size: 12.5px;
  color: #64748B;
  line-height: 1.8;
}
</style>
