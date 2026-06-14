<template>
  <view class="page">
    <view class="header">
      <view class="header-bg"></view>
      <view class="header-content">
        <text class="header-title">智能分析</text>
        <view v-if="usageInfo" class="usage-badge">
          <text class="usage-text">剩余 {{ usageInfo.credits }} 次</text>
        </view>
      </view>
    </view>

    <scroll-view class="body-scroll" scroll-y enhanced :show-scrollbar="false">
      <view class="input-section">
        <view class="section-label-row">
          <text class="section-label">选择基金</text>
          <view class="quick-fill" @tap="fillHeldFunds">
            <text class="quick-fill-text">填入持仓基金</text>
          </view>
        </view>
        <textarea
          class="code-input"
          v-model="codes"
          placeholder="输入基金代码，多个用逗号分隔&#10;例如：000001,000002,000003"
          :maxlength="500"
        />
        <view class="period-picker">
          <text class="picker-label">分析周期</text>
          <view class="picker-options">
            <view
              v-for="p in periods"
              :key="p.value"
              :class="['picker-item', { active: period === p.value }]"
              @tap="period = p.value"
            >
              <text class="picker-text">{{ p.label }}</text>
            </view>
          </view>
        </view>
        <view class="btn-primary" @tap="startAnalysis">
          <text class="btn-text">开始分析</text>
        </view>
      </view>

      <view v-if="analyzing" class="analysis-section">
        <view class="analysis-header">
          <text class="analysis-title">分析结果</text>
          <view class="spinner"></view>
        </view>
        <view class="analysis-content">
          <rich-text :nodes="renderedContent"></rich-text>
        </view>
      </view>

      <view v-else-if="content" class="analysis-section">
        <view class="analysis-header">
          <text class="analysis-title">分析结果</text>
          <view class="copy-btn" @tap="copyResult">
            <text class="copy-text">复制</text>
          </view>
        </view>
        <view class="analysis-content">
          <rich-text :nodes="renderedContent"></rich-text>
        </view>
      </view>

      <view class="bottom-safe"></view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getAnalysisUsage } from '@/api/auth'
import { BASE_URL, getClientId, getSessionToken } from '@/utils/request'
import { useFundStore } from '@/stores/fund'

const store = useFundStore()
const codes = ref('')
const period = ref('1')
const content = ref('')
const analyzing = ref(false)
const usageInfo = ref<{ allowed: boolean; credits: number; userType: string } | null>(null)

const periods = [
  { label: '近1月', value: '1' },
  { label: '近3月', value: '3' },
  { label: '近6月', value: '6' },
  { label: '近1年', value: '12' },
]

const renderedContent = computed(() => {
  return content.value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#111827">$1</strong>')
    .replace(/### (.*)/g, '<span style="font-size:16px;font-weight:700;color:#4f46e5;display:block;margin:12px 0 6px">$1</span>')
    .replace(/## (.*)/g, '<span style="font-size:18px;font-weight:700;color:#111827;display:block;margin:16px 0 8px">$1</span>')
})

function fillHeldFunds() {
  const heldCodes = store.sortedFavorites
    .filter(f => store.isHeld(f.code))
    .map(f => f.code)
  if (heldCodes.length === 0) {
    uni.showToast({ title: '暂无持仓基金', icon: 'none' })
    return
  }
  codes.value = heldCodes.join(',')
}

async function loadUsage() {
  try {
    usageInfo.value = await getAnalysisUsage()
  } catch {
    // ignore
  }
}

async function startAnalysis() {
  const codeList = codes.value.match(/\d{6}/g) || []
  if (codeList.length === 0) {
    uni.showToast({ title: '请输入基金代码', icon: 'none' })
    return
  }

  if (codeList.length > 10) {
    uni.showToast({ title: '最多分析10只基金', icon: 'none' })
    return
  }

  try {
    const usage = await getAnalysisUsage()
    usageInfo.value = usage
    if (!usage.allowed) {
      uni.showToast({ title: '分析次数已用完', icon: 'none' })
      return
    }
  } catch {
    // continue
  }

  content.value = ''
  analyzing.value = true

  try {
    const res: any = await new Promise((resolve, reject) => {
      uni.request({
        url: `${BASE_URL}/api/analysis/stream`,
        method: 'POST',
        data: { codes: codeList, period: period.value },
        header: {
          'Content-Type': 'application/json',
          'X-Client-Id': getClientId(),
          'Authorization': getSessionToken() ? `Bearer ${getSessionToken()}` : ''
        },
        responseType: 'text',
        success: (r: any) => resolve(r),
        fail: (err: any) => reject(err)
      })
    })

    if (res.statusCode !== 200) {
      let errMsg = '分析请求失败'
      try {
        const errData = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
        errMsg = errData.error || errMsg
      } catch { /* ignore */ }
      content.value = errMsg
      analyzing.value = false
      return
    }

    const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
    const lines = text.split('\n')
    for (const line of lines) {
      if (!line.trim().startsWith('data:')) continue
      const jsonStr = line.trim().slice(5).trim()
      if (jsonStr === '[DONE]') break
      try {
        const parsed = JSON.parse(jsonStr)
        if (parsed.error) {
          content.value += '\n\n错误: ' + parsed.error
          break
        }
        if (parsed.type === 'content') {
          content.value += parsed.content
        }
      } catch {
        // skip
      }
    }
  } catch (err: any) {
    content.value = '分析失败: ' + (err.errMsg || '网络错误')
  } finally {
    analyzing.value = false
    loadUsage()
  }
}

function copyResult() {
  uni.setClipboardData({
    data: content.value,
    success: () => {
      uni.showToast({ title: '已复制', icon: 'success' })
    }
  })
}

onMounted(() => {
  loadUsage()
})
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f6fa;
  display: flex;
  flex-direction: column;
}

.header {
  position: relative;
  padding: 0 32rpx 36rpx;
}

.header-bg {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  border-radius: 0 0 32rpx 32rpx;
}

.header-content {
  position: relative;
  padding-top: calc(var(--status-bar-height, 0px) + 36rpx);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #fff;
}

.usage-badge {
  background: rgba(255, 255, 255, 0.2);
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
}

.usage-text {
  font-size: 22rpx;
  color: #fff;
  font-weight: 500;
}

.body-scroll {
  flex: 1;
  padding: 0 24rpx;
  margin-top: -16rpx;
}

.input-section {
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.section-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.section-label {
  font-size: 28rpx;
  font-weight: 600;
  color: #111827;
}

.quick-fill {
  padding: 8rpx 20rpx;
  background: #eff6ff;
  border-radius: 16rpx;
}

.quick-fill-text {
  font-size: 22rpx;
  color: #3b82f6;
  font-weight: 500;
}

.code-input {
  width: 100%;
  height: 180rpx;
  padding: 20rpx;
  background: #f8fafc;
  border: 1rpx solid #e5e7eb;
  border-radius: 12rpx;
  font-size: 28rpx;
  margin-bottom: 24rpx;
}

.period-picker {
  margin-bottom: 24rpx;
}

.picker-label {
  font-size: 26rpx;
  color: #374151;
  font-weight: 500;
  display: block;
  margin-bottom: 16rpx;
}

.picker-options {
  display: flex;
  gap: 12rpx;
}

.picker-item {
  padding: 12rpx 28rpx;
  background: #f1f5f9;
  border-radius: 20rpx;
}

.picker-item.active {
  background: #4f46e5;
}

.picker-text {
  font-size: 26rpx;
  color: #64748b;
  font-weight: 500;
}

.picker-item.active .picker-text {
  color: #fff;
}

.btn-primary {
  background: linear-gradient(135deg, #4f46e5, #6366f1);
  border-radius: 14rpx;
  padding: 26rpx 0;
  text-align: center;
  box-shadow: 0 4rpx 16rpx rgba(79, 70, 229, 0.3);
}

.btn-text {
  color: #fff;
  font-size: 30rpx;
  font-weight: 600;
}

.analysis-section {
  background: #fff;
  border-radius: 20rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  margin-bottom: 20rpx;
}

.analysis-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 28rpx;
  border-bottom: 1rpx solid #f1f5f9;
}

.analysis-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #111827;
}

.copy-btn {
  padding: 8rpx 20rpx;
  background: #f1f5f9;
  border-radius: 12rpx;
}

.copy-text {
  font-size: 24rpx;
  color: #64748b;
}

.spinner {
  width: 32rpx;
  height: 32rpx;
  border: 3rpx solid #e5e7eb;
  border-top-color: #4f46e5;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.analysis-content {
  padding: 24rpx 28rpx;
  font-size: 28rpx;
  line-height: 1.8;
  color: #374151;
}

.bottom-safe {
  height: 180rpx;
}
</style>
