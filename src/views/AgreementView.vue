<template>
  <div class="page">
    <header class="page-header">
      <div class="header-inner">
        <button class="back-btn" @click="$router.push('/')">
          <svg viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <h1 class="page-title">{{ activeTab === 'terms' ? '用户协议' : '隐私政策' }}</h1>
      </div>
    </header>

    <div class="container">
      <div class="tab-bar">
        <button :class="['tab-btn', { active: activeTab === 'terms' }]" @click="activeTab = 'terms'">用户协议</button>
        <button :class="['tab-btn', { active: activeTab === 'privacy' }]" @click="activeTab = 'privacy'">隐私政策</button>
      </div>

      <div v-if="activeTab === 'terms'" class="card">
        <div class="card-header">
          <svg viewBox="0 0 24 24" fill="none" class="card-icon">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="1.5"/>
            <path d="M14 2v6h6M9 13h6M9 17h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span>Fund Pulse 用户服务协议</span>
        </div>
        <div class="card-body">
          <p class="update-date">更新日期：2025 年 6 月 14 日</p>

          <section class="section">
            <h3 class="section-title">一、总则</h3>
            <p class="section-text">欢迎使用 Fund Pulse（以下简称"本平台"）。本平台是一个用于基金数据学习、追踪与交流的工具。请您在使用本平台前仔细阅读本协议，您注册、登录或使用本平台即表示同意接受本协议的全部条款。如您不同意任何条款，请停止使用。</p>
          </section>

          <section class="section">
            <h3 class="section-title">二、账号注册与管理</h3>
            <p class="section-text">1. 用户须使用真实有效的邮箱地址注册账号，并妥善保管账号及密码信息。</p>
            <p class="section-text">2. 用户应对其账号下的所有活动负责，因账号保管不当造成的损失由用户自行承担。</p>
            <p class="section-text">3. 禁止注册多个账号进行恶意操作，一经发现，本平台有权限制或注销相关账号。</p>
          </section>

          <section class="section">
            <h3 class="section-title">三、用户行为规范</h3>
            <p class="section-text">用户在使用本平台时，应遵守相关法律法规，不得利用本平台从事以下行为：</p>
            <p class="section-text">• 发布违法、侵权或不良信息；</p>
            <p class="section-text">• 破坏、干扰本平台的正常运行或安全；</p>
            <p class="section-text">• 未经授权爬取、批量获取本平台数据；</p>
            <p class="section-text">• 其他损害本平台或第三方合法权益的行为。</p>
          </section>

          <section class="section">
            <h3 class="section-title">四、服务内容与免责</h3>
            <p class="section-text">1. 本平台展示的基金数据、分析内容及 AI 智能分析均基于公开信息整理，仅供学习参考，不构成任何形式的投资建议、推荐或承诺。</p>
            <p class="section-text">2. 基金投资有风险，过往业绩不代表未来表现。用户应根据自身情况独立做出投资决策，自行承担投资风险。</p>
            <p class="section-text">3. 本平台不对数据的完整性、准确性和及时性做出保证，如数据存在延迟或错误，请以基金公司官方披露为准。</p>
            <p class="section-text">4. AI 分析结果由大语言模型生成，可能存在不准确或误导性内容，不应作为投资决策依据。</p>
          </section>

          <section class="section">
            <h3 class="section-title">五、知识产权</h3>
            <p class="section-text">本平台的界面设计、程序代码、图标及其他内容（除注明来源的公开数据外）的知识产权归本平台所有，未经授权不得复制、转载或用于其他商业用途。</p>
          </section>

          <section class="section">
            <h3 class="section-title">六、协议变更</h3>
            <p class="section-text">本平台有权根据法律法规及运营需要修改本协议，修改后的协议将在本页面公布。用户继续使用即视为同意修改后的协议。</p>
          </section>
        </div>
      </div>

      <div v-if="activeTab === 'privacy'" class="card">
        <div class="card-header">
          <svg viewBox="0 0 24 24" fill="none" class="card-icon">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Fund Pulse 隐私政策</span>
        </div>
        <div class="card-body">
          <p class="update-date">更新日期：2025 年 6 月 14 日</p>

          <section class="section">
            <h3 class="section-title">一、信息收集</h3>
            <p class="section-text">本平台在您注册和使用过程中会收集以下信息：</p>
            <p class="section-text">• <strong>账号信息</strong>：用户名、邮箱地址（用于注册验证和密码找回）；</p>
            <p class="section-text">• <strong>使用数据</strong>：您输入的基金代码、持仓数据及操作记录；</p>
            <p class="section-text">• <strong>设备信息</strong>：客户端标识（用于访问统计与安全防护）。</p>
            <p class="section-text">本平台不会收集或存储敏感个人财务信息（如银行卡号、支付密码等）。</p>
          </section>

          <section class="section">
            <h3 class="section-title">二、信息使用</h3>
            <p class="section-text">收集的信息仅用于以下目的：</p>
            <p class="section-text">• 提供基金追踪、收益分析等核心功能服务；</p>
            <p class="section-text">• 账号安全验证与密码找回；</p>
            <p class="section-text">• 平台运行状况统计与优化。</p>
            <p class="section-text">您的个人数据不会被出售或用于其他商业用途。</p>
          </section>

          <section class="section">
            <h3 class="section-title">三、信息存储与保护</h3>
            <p class="section-text">1. 您的数据存储在平台服务器中，采用相应的安全技术措施进行保护。</p>
            <p class="section-text">2. 密码经过加密处理存储，平台不会以明文形式保存您的密码。</p>
            <p class="section-text">3. 尽管我们采取合理的安全措施，但无法保证信息绝对安全。如发生安全事件，我们将及时通知您。</p>
          </section>

          <section class="section">
            <h3 class="section-title">四、Cookie 与本地存储</h3>
            <p class="section-text">本平台使用 localStorage 存储登录状态和用户偏好设置，不使用第三方跟踪 Cookie。您可以随时通过浏览器设置清除这些数据。</p>
          </section>

          <section class="section">
            <h3 class="section-title">五、用户权利</h3>
            <p class="section-text">您有权访问、更正或删除您的个人信息。如需行使上述权利，请通过平台内的反馈功能联系我们。</p>
          </section>

          <section class="section">
            <h3 class="section-title">六、政策变更</h3>
            <p class="section-text">本平台可能不定期更新本隐私政策，更新后将在本页面公布。继续使用即视为同意更新后的政策。</p>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const activeTab = ref<'terms' | 'privacy'>(route.query.tab === 'privacy' ? 'privacy' : 'terms')
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

.tab-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  background: white;
  padding: 4px;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04);
}

.tab-btn {
  flex: 1;
  padding: 10px 16px;
  border: none;
  background: transparent;
  border-radius: 7px;
  font-size: 14px;
  font-weight: 500;
  color: #64748B;
  cursor: pointer;
  transition: all 0.15s;
}
.tab-btn.active {
  background: #4F46E5;
  color: white;
  box-shadow: 0 2px 6px rgba(79, 70, 229, 0.3);
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

.card-body {
  padding: 20px 24px 8px;
}

.update-date {
  font-size: 12px;
  color: #94A3B8;
  margin: 0 0 16px 0;
}

.section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: #1E293B;
  margin: 0 0 8px 0;
}

.section-text {
  font-size: 13px;
  color: #64748B;
  line-height: 1.9;
  margin: 0 0 6px 0;
}
.section-text strong {
  color: #475569;
  font-weight: 600;
}
</style>
