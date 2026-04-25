<template>
  <div v-if="visible" class="modal-overlay" @click.stop>
    <div class="modal password-modal" @click.stop>
      <div class="modal-header">
        <h3>{{ mode === 'change' ? '修改密码' : '重置密码' }}</h3>
        <button class="modal-close" @click="$emit('close')">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <p class="hint-text">
          {{ mode === 'change' ? '请输入原密码和新密码' : (skipVerify ? '请直接设置新密码' : '将通过邮件验证码重置密码') }}
        </p>

        <div v-if="mode === 'change'" class="form-group">
          <label>原密码</label>
          <div class="input-wrapper">
            <input
              v-model="oldPassword"
              :type="showOldPassword ? 'text' : 'password'"
              placeholder="请输入原密码"
              :disabled="authStore.loading"
              autocomplete="off"
            />
            <button class="toggle-password-btn" type="button" @click="showOldPassword = !showOldPassword">
              <svg v-if="!showOldPassword" viewBox="0 0 24 24" fill="none">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/>
                <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
              </svg>
            </button>
          </div>
        </div>

        <div v-if="mode === 'reset' && !otpSent && !skipVerify" class="form-group">
          <label>邮箱地址</label>
          <input
            v-model="resetEmail"
            type="email"
            placeholder="请输入注册邮箱"
            :disabled="authStore.loading"
            readonly
            class="readonly-input"
          />
        </div>

        <div v-if="mode === 'reset' && otpSent && !skipVerify" class="form-group">
          <label>验证码</label>
          <div class="otp-inputs">
            <input
              v-for="(_, index) in otpDigits"
              :key="index"
              :ref="el => otpInputRefs[index] = el as HTMLInputElement"
              v-model="otpDigits[index]"
              type="text"
              inputmode="numeric"
              maxlength="1"
              class="otp-input"
              :disabled="authStore.loading"
              @input="handleOtpInput(index)"
              @keydown="handleOtpKeydown($event, index)"
              @paste="handleOtpPaste"
            />
          </div>
          <p v-if="otpSent && !skipVerify" class="otp-hint">验证码已发送到 {{ resetEmail }}</p>
        </div>

        <div v-if="mode === 'change' || (mode === 'reset' && (otpSent || skipVerify))" class="form-group">
          <label>新密码</label>
          <div class="input-wrapper">
            <input
              v-model="newPassword"
              :type="showNewPassword ? 'text' : 'password'"
              placeholder="请输入新密码（至少4位）"
              :disabled="authStore.loading"
              autocomplete="new-password"
            />
            <button class="toggle-password-btn" type="button" @click="showNewPassword = !showNewPassword">
              <svg v-if="!showNewPassword" viewBox="0 0 24 24" fill="none">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/>
                <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
              </svg>
            </button>
          </div>
        </div>

        <div v-if="mode === 'reset' && (otpSent || skipVerify)" class="form-group">
          <label>确认新密码</label>
          <div class="input-wrapper">
            <input
              v-model="confirmPassword"
              :type="showConfirmPassword ? 'text' : 'password'"
              placeholder="请再次输入新密码"
              :disabled="authStore.loading"
            />
            <button class="toggle-password-btn" type="button" @click="showConfirmPassword = !showConfirmPassword">
              <svg v-if="!showConfirmPassword" viewBox="0 0 24 24" fill="none">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/>
                <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
              </svg>
            </button>
          </div>
        </div>

        <div v-if="errorMessage" class="message error">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span>{{ errorMessage }}</span>
        </div>
        <div v-if="successMessage" class="message success">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>{{ successMessage }}</span>
        </div>
      </div>
      <div class="modal-footer">
        <button class="modal-btn cancel" @click="$emit('close')">取消</button>
        <button
          class="modal-btn confirm"
          :disabled="!canSubmit || authStore.loading"
          @click="handleSubmit"
        >
          <span v-if="authStore.loading" class="loading-spinner"></span>
          {{ authStore.loading ? '处理中...' : submitButtonText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  mode: 'change' | 'reset'
  identifier: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success'): void
}>()

const authStore = useAuthStore()

const visible = ref(true)
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const resetEmail = ref(props.identifier)
const otpSent = ref(false)
const skipVerify = ref(false)
const otpDigits = ref<string[]>(['', '', '', '', '', ''])
const otpInputRefs = ref<HTMLInputElement[]>([])
const showOldPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const otp = computed(() => otpDigits.value.join(''))

const isOtpComplete = computed(() => {
  return otpDigits.value.every(digit => digit !== '')
})

const canSubmit = computed(() => {
  if (props.mode === 'change') {
    return oldPassword.value.length >= 4 && newPassword.value.length >= 4
  } else {
    if (skipVerify.value) {
      return newPassword.value.length >= 4 && confirmPassword.value.length >= 4
    }
    if (!otpSent.value) {
      return resetEmail.value.length > 0 && resetEmail.value.includes('@')
    } else {
      return isOtpComplete.value && newPassword.value.length >= 4 && confirmPassword.value.length >= 4
    }
  }
})

const submitButtonText = computed(() => {
  if (props.mode === 'change') {
    return '确认修改'
  } else {
    if (skipVerify.value) {
      return '重置密码'
    }
    if (!otpSent.value) {
      return '发送验证码'
    } else {
      return '重置密码'
    }
  }
})

function handleOtpInput(index: number) {
  const value = otpDigits.value[index]
  if (value && !/^\d$/.test(value)) {
    otpDigits.value[index] = ''
    return
  }
  if (value && index < 5) {
    otpInputRefs.value[index + 1]?.focus()
  }
}

function handleOtpKeydown(event: KeyboardEvent, index: number) {
  if (event.key === 'Backspace' && !otpDigits.value[index] && index > 0) {
    otpInputRefs.value[index - 1]?.focus()
  } else if (event.key === 'ArrowLeft' && index > 0) {
    otpInputRefs.value[index - 1]?.focus()
  } else if (event.key === 'ArrowRight' && index < 5) {
    otpInputRefs.value[index + 1]?.focus()
  }
}

function handleOtpPaste(event: ClipboardEvent) {
  event.preventDefault()
  const pasteData = event.clipboardData?.getData('text') || ''
  const digits = pasteData.replace(/\D/g, '').slice(0, 6).split('')
  if (digits.length > 0) {
    digits.forEach((digit, index) => {
      if (index < 6) {
        otpDigits.value[index] = digit
      }
    })
    const lastIndex = Math.min(digits.length, 5)
    otpInputRefs.value[lastIndex]?.focus()
  }
}

async function handleSubmit() {
  if (!canSubmit.value || authStore.loading) return

  errorMessage.value = ''
  successMessage.value = ''

  if (props.mode === 'change') {
    const result = await authStore.changePassword(props.identifier, oldPassword.value, newPassword.value)
    if (result.success) {
      successMessage.value = result.message
      setTimeout(() => {
        emit('success')
        emit('close')
      }, 1000)
    } else {
      errorMessage.value = result.message
    }
  } else {
    if (skipVerify.value) {
      if (newPassword.value !== confirmPassword.value) {
        errorMessage.value = '两次输入的密码不一致'
        return
      }
      const result = await authStore.resetPassword(resetEmail.value, '', newPassword.value)
      if (result.success) {
        successMessage.value = result.message
        setTimeout(() => {
          emit('success')
          emit('close')
        }, 1000)
      } else {
        errorMessage.value = result.message
      }
    } else if (!otpSent.value) {
      const result = await authStore.forgotPassword(resetEmail.value)
      if (result.success) {
        if (result.skipVerify) {
          skipVerify.value = true
        } else {
          otpSent.value = true
          successMessage.value = result.message
          await nextTick()
          otpInputRefs.value[0]?.focus()
        }
      } else {
        errorMessage.value = result.message
      }
    } else {
      if (newPassword.value !== confirmPassword.value) {
        errorMessage.value = '两次输入的密码不一致'
        return
      }
      const result = await authStore.resetPassword(resetEmail.value, otp.value, newPassword.value)
      if (result.success) {
        successMessage.value = result.message
        setTimeout(() => {
          emit('success')
          emit('close')
        }, 1000)
      } else {
        errorMessage.value = result.message
      }
    }
  }
}

watch(visible, (val) => {
  if (!val) {
    emit('close')
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #E5E7EB;
}

.modal-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.modal-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #6B7280;
  border-radius: 6px;
  transition: all 0.2s;
}

.modal-close:hover {
  background: #F3F4F6;
  color: #111827;
}

.modal-close svg {
  width: 18px;
  height: 18px;
}

.modal-body {
  padding: 24px 20px;
}

.hint-text {
  font-size: 13px;
  color: #6B7280;
  margin: 0 0 16px 0;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 8px;
}

.form-group input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #D1D5DB;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.2s ease;
  outline: none;
  background: white;
  box-sizing: border-box;
}

.form-group input:focus {
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.readonly-input {
  background: #F9FAFB !important;
  color: #6B7280 !important;
  cursor: not-allowed;
}

.input-wrapper {
  display: flex;
  align-items: center;
  position: relative;
}

.input-wrapper input {
  padding-right: 40px;
}

.toggle-password-btn {
  position: absolute;
  right: 8px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #9CA3AF;
  border-radius: 4px;
}

.toggle-password-btn svg {
  width: 16px;
  height: 16px;
}

.otp-inputs {
  display: flex;
  gap: 6px;
  justify-content: center;
}

.otp-input {
  width: 32px;
  height: 36px;
  text-align: center;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid #D1D5DB;
  border-radius: 4px;
  outline: none;
  transition: all 0.2s ease;
  background: white;
}

.otp-input:focus {
  border-color: #4F46E5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.otp-hint {
  margin: 8px 0 0 0;
  font-size: 12px;
  color: #9CA3AF;
  text-align: center;
}

.message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 8px;
  font-size: 13px;
  margin-top: 16px;
}

.message svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.message.error {
  background: #FEF2F2;
  border: 1px solid #FEE2E2;
  color: #DC2626;
}

.message.success {
  background: #F0FDF4;
  border: 1px solid #BBF7D0;
  color: #16A34A;
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #E5E7EB;
  justify-content: flex-end;
}

.modal-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 80px;
}

.modal-btn.cancel {
  background: #F3F4F6;
  color: #6B7280;
}

.modal-btn.cancel:hover {
  background: #E5E7EB;
}

.modal-btn.confirm {
  background: #4F46E5;
  color: white;
}

.modal-btn.confirm:hover:not(:disabled) {
  background: #4338CA;
}

.modal-btn.confirm:disabled {
  background: #A5B4FC;
  cursor: not-allowed;
}

.loading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
