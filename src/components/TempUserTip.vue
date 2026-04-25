<template>
  <div v-if="showTip" class="temp-user-tip" data-testid="temp-user-tip">
    <div class="tip-icon">💡</div>
    <div class="tip-content">
      <h4 class="tip-title">您当前是访客模式</h4>
      <p class="tip-item">• 收益数据为前端实时计算，仅供参考</p>
      <p class="tip-item">• 登录后可查看完整收益历史和分析</p>
      <p class="tip-item">• 数据仅保存在本地浏览器，清除缓存会丢失</p>
      <div class="tip-actions">
        <button
          @click="$emit('login')"
          class="login-btn"
          type="button"
          data-testid="temp-user-login-btn"
        >
          立即登录
        </button>
        <button
          v-if="showDismiss"
          @click="handleDismiss"
          class="dismiss-btn"
          type="button"
        >
          知道了
        </button>
      </div>
    </div>
    <button
      v-if="showClose"
      @click="handleClose"
      class="close-btn"
      type="button"
      aria-label="关闭提示"
    >
      ✕
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  showClose?: boolean
  showDismiss?: boolean
  dismissible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showClose: true,
  showDismiss: true,
  dismissible: true
})

const emit = defineEmits<{
  close: []
  login: []
}>()

// 判断是否为临时用户
const isTempUser = computed(() => {
  // 通过 fundStore 的 useDatabase 判断
  const fundStore = window.__FUND_STORE__
  return fundStore ? fundStore.useDatabase !== true : true
})

// 是否显示提示（临时用户且未关闭过）
const showTip = computed(() => {
  if (!isTempUser.value) return false

  if (!props.dismissible) return true

  // 检查是否关闭过提示
  const dismissed = localStorage.getItem('temp_user_tip_dismissed')
  return dismissed !== 'true'
})

// 关闭提示（今天不再显示）
function handleDismiss() {
  const today = new Date().toLocaleDateString('sv-SE')
  localStorage.setItem('temp_user_tip_dismissed', today)
}

// 关闭提示（立即）
function handleClose() {
  emit('close')
}
</script>

<style scoped>
.temp-user-tip {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 1px solid #fcd34d;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  gap: 12px;
  position: relative;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.tip-icon {
  font-size: 24px;
  flex-shrink: 0;
  line-height: 1;
}

.tip-content {
  flex: 1;
  min-width: 0;
}

.tip-title {
  margin: 0 0 8px;
  color: #92400e;
  font-size: 16px;
  font-weight: 600;
}

.tip-item {
  margin: 0 0 4px;
  font-size: 14px;
  color: #b45309;
  line-height: 1.5;
}

.tip-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.login-btn {
  padding: 8px 16px;
  background: #f59e0b;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.2s;
}

.login-btn:hover {
  background: #d97706;
}

.dismiss-btn {
  padding: 8px 16px;
  background: transparent;
  color: #b45309;
  border: 1px solid #d97706;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.dismiss-btn:hover {
  background: rgba(217, 119, 6, 0.1);
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  background: transparent;
  border: none;
  color: #92400e;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
  font-size: 16px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.close-btn:hover {
  opacity: 1;
}

/* 响应式 */
@media (max-width: 640px) {
  .temp-user-tip {
    padding: 12px;
    margin-bottom: 16px;
  }

  .tip-title {
    font-size: 14px;
  }

  .tip-item {
    font-size: 13px;
  }

  .login-btn,
  .dismiss-btn {
    padding: 6px 12px;
    font-size: 13px;
  }
}
</style>
