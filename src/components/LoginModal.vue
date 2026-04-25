<template>
  <div v-if="visible" class="modal-overlay">
    <div class="modal login-modal" @click.stop>
      <div class="modal-header">
        <h3>{{ isForgotMode ? '重置密码' : (isRegisterMode ? '注册' : '登录') }}</h3>
        <button class="modal-close" @click="$emit('close')">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div v-if="!isForgotMode" class="mode-switch">
          <button
            :class="['mode-btn', { active: !isRegisterMode }]"
            @click="switchToLogin"
          >
            登录
          </button>
          <button
            :class="['mode-btn', { active: isRegisterMode }]"
            @click="switchToRegister"
          >
            注册
          </button>
        </div>

        <div v-if="isRegisterMode" class="form-group">
          <label>用户名</label>
          <div class="input-with-status">
            <input
              v-model="username"
              type="text"
              placeholder="1-20个字符，支持字母、数字、下划线"
              :disabled="authStore.loading"
              @blur="validateUsername"
              @input="clearUsernameError"
            />
            <span v-if="usernameStatus === 'checking'" class="status-icon checking">
              <svg class="spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-dasharray="31.4 31.4" stroke-linecap="round"/>
              </svg>
            </span>
            <span v-else-if="usernameStatus === 'available'" class="status-icon available">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                <path d="M8 12l2.5 2.5L16 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            <span v-else-if="usernameStatus === 'taken'" class="status-icon taken">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </span>
          </div>
          <p v-if="usernameError" class="field-error">{{ usernameError }}</p>
        </div>

        <div class="form-group">
          <label>{{ isRegisterMode ? '邮箱地址' : (isForgotMode ? '邮箱地址' : '用户名或邮箱') }}</label>
          <div class="input-wrapper">
            <input
              v-model="email"
              :type="(isRegisterMode || isForgotMode) ? 'email' : 'text'"
              :placeholder="isRegisterMode ? '请输入邮箱' : (isForgotMode ? '请输入注册邮箱' : '请输入用户名或邮箱')"
              :disabled="authStore.loading"
              @blur="validateEmail"
              @input="clearEmailError"
              @keyup.enter="handlePrimaryAction"
            />
            <span v-if="isRegisterMode && emailStatus === 'checking'" class="status-icon checking">
              <svg class="spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-dasharray="31.4 31.4" stroke-linecap="round"/>
              </svg>
            </span>
            <span v-else-if="isRegisterMode && emailStatus === 'available'" class="status-icon available">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                <path d="M8 12l2.5 2.5L16 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            <span v-else-if="isRegisterMode && emailStatus === 'taken'" class="status-icon taken">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </span>
          </div>
          <p v-if="emailError" class="field-error">{{ emailError }}</p>
        </div>

        <div v-if="!isForgotMode" class="form-group">
          <label>密码</label>
          <div class="input-wrapper">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              :placeholder="isRegisterMode ? '4-20个字符' : '请输入密码'"
              :disabled="authStore.loading"
              autocomplete="new-password"
              @keyup.enter="handlePrimaryAction"
            />
            <button
              class="toggle-password-btn"
              type="button"
              @click="showPassword = !showPassword"
              :title="showPassword ? '隐藏密码' : '显示密码'"
            >
              <svg v-if="!showPassword" viewBox="0 0 24 24" fill="none">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
              </svg>
            </button>
          </div>
          <p v-if="passwordError" class="field-error">{{ passwordError }}</p>
        </div>

        <div v-if="isRegisterMode && showOtpInput" class="form-group">
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
          <p class="otp-hint">请输入6位验证码</p>
        </div>

        <div v-if="isForgotMode && forgotOtpSent && !forgotSkipVerify" class="form-group">
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
          <p class="otp-hint">请输入6位验证码</p>
        </div>

        <div v-if="isForgotMode && (forgotOtpSent || forgotSkipVerify)" class="form-group">
          <label>新密码</label>
          <div class="input-wrapper">
            <input
              v-model="newPassword"
              :type="showPassword ? 'text' : 'password'"
              placeholder="请输入新密码（至少4位）"
              :disabled="authStore.loading"
            />
            <button class="toggle-password-btn" type="button" @click="showPassword = !showPassword">
              <svg v-if="!showPassword" viewBox="0 0 24 24" fill="none">
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

        <div v-if="isForgotMode && (forgotOtpSent || forgotSkipVerify)" class="form-group">
          <label>确认新密码</label>
          <div class="input-wrapper">
            <input
              v-model="confirmPassword"
              :type="showPassword ? 'text' : 'password'"
              placeholder="请再次输入新密码"
              :disabled="authStore.loading"
            />
            <button class="toggle-password-btn" type="button" @click="showPassword = !showPassword">
              <svg v-if="!showPassword" viewBox="0 0 24 24" fill="none">
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
          @click="handlePrimaryAction"
        >
          <span v-if="authStore.loading" class="loading-spinner"></span>
          {{ authStore.loading ? '处理中...' : submitButtonText }}
        </button>
      </div>
      <div v-if="!isRegisterMode && !isForgotMode" class="forgot-link">
        <a href="#" @click.prevent="switchToForgot">忘记密码？</a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const authStore = useAuthStore()

const isRegisterMode = ref(false)
const isForgotMode = ref(false)

const username = ref('')
const email = ref('')
const password = ref('')
const otpDigits = ref<string[]>(['', '', '', '', '', ''])
const otpInputRefs = ref<HTMLInputElement[]>([])
const showPassword = ref(false)
const countdown = ref(0)
const errorMessage = ref('')
const successMessage = ref('')
const otpSent = ref(false)
const forgotOtpSent = ref(false)
const forgotSkipVerify = ref(false)
const newPassword = ref('')
const confirmPassword = ref('')

const usernameStatus = ref<'idle' | 'checking' | 'available' | 'taken'>('idle')
const emailStatus = ref<'idle' | 'checking' | 'available' | 'taken'>('idle')
const usernameError = ref('')
const emailError = ref('')
const passwordError = ref('')

let countdownTimer: ReturnType<typeof setInterval> | null = null
let usernameCheckTimer: ReturnType<typeof setTimeout> | null = null
let emailCheckTimer: ReturnType<typeof setTimeout> | null = null

const isEmailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value))
const isUsernameValid = computed(() => /^[a-zA-Z0-9_]{1,20}$/.test(username.value))
const isPasswordValid = computed(() => password.value.length >= 4 && password.value.length <= 20)
const isNewPasswordValid = computed(() => newPassword.value.length >= 4 && newPassword.value.length <= 20)
const isOtpComplete = computed(() => otpDigits.value.every(digit => digit !== ''))
const otp = computed(() => otpDigits.value.join(''))
const showOtpInput = computed(() => isRegisterMode.value && otpSent.value)

const canSubmit = computed(() => {
  if (isRegisterMode.value) {
    if (!otpSent.value) {
      return isUsernameValid.value && usernameStatus.value === 'available' && isEmailValid.value && emailStatus.value === 'available' && isPasswordValid.value
    }
    return isOtpComplete.value
  }
  if (isForgotMode.value) {
    if (forgotSkipVerify.value) {
      return isNewPasswordValid.value && newPassword.value === confirmPassword.value
    }
    if (!forgotOtpSent.value) {
      return isEmailValid.value
    }
    return isOtpComplete.value && isNewPasswordValid.value && newPassword.value === confirmPassword.value
  }
  return email.value.length > 0 && password.value.length >= 4
})

const submitButtonText = computed(() => {
  if (isRegisterMode.value) {
    return otpSent.value ? '完成注册' : '提交'
  }
  if (isForgotMode.value) {
    return (forgotOtpSent.value || forgotSkipVerify.value) ? '重置密码' : '发送验证码'
  }
  return '登录'
})

function switchToLogin() {
  isRegisterMode.value = false
  isForgotMode.value = false
  resetValidation()
}

function switchToRegister() {
  isRegisterMode.value = true
  isForgotMode.value = false
  resetValidation()
}
function switchToForgot() {
  isRegisterMode.value = false
  isForgotMode.value = true
  resetValidation()
}
function resetValidation() {
  usernameStatus.value = 'idle'
  emailStatus.value = 'idle'
  usernameError.value = ''
  emailError.value = ''
  passwordError.value = ''
  errorMessage.value = ''
  successMessage.value = ''
}
async function validateUsername() {
  if (!username.value) {
    usernameError.value = '请输入用户名'
    usernameStatus.value = 'idle'
    return
  }
  if (!isUsernameValid.value) {
    usernameError.value = '用户名需要1-20个字符，支持字母、数字、下划线'
    usernameStatus.value = 'idle'
    return
  }
  usernameStatus.value = 'checking'
  usernameError.value = ''
  try {
    const result = await authStore.checkUsername(username.value)
    usernameStatus.value = result.available ? 'available' : 'taken'
    if (!result.available) usernameError.value = result.message || '用户名已被使用'
  } catch {
    usernameStatus.value = 'idle'
    usernameError.value = '检查用户名失败'
  }
}
function clearUsernameError() {
  if (usernameStatus.value !== 'checking') {
    usernameStatus.value = 'idle'
    usernameError.value = ''
  }
  if (usernameCheckTimer) clearTimeout(usernameCheckTimer)
  usernameCheckTimer = setTimeout(() => {
    if (isUsernameValid.value) validateUsername()
  }, 500)
}
async function validateEmail() {
  if (!email.value) {
    emailError.value = isRegisterMode.value ? '请输入邮箱' : '请输入用户名或邮箱'
    emailStatus.value = 'idle'
    return
  }
  if (isRegisterMode.value && !isEmailValid.value) {
    emailError.value = '邮箱格式不正确'
    emailStatus.value = 'idle'
    return
  }
  if (isRegisterMode.value) {
    emailStatus.value = 'checking'
    emailError.value = ''
    try {
      const result = await authStore.checkEmail(email.value)
      emailStatus.value = result.available ? 'available' : 'taken'
      if (!result.available) emailError.value = result.message || '邮箱已被注册'
    } catch {
      emailStatus.value = 'idle'
      emailError.value = '检查邮箱失败'
    }
  }
}
function clearEmailError() {
  if (emailStatus.value !== 'checking') {
    emailStatus.value = 'idle'
    emailError.value = ''
  }
  if (emailCheckTimer) clearTimeout(emailCheckTimer)
  emailCheckTimer = setTimeout(() => {
    if (isRegisterMode.value && isEmailValid.value) validateEmail()
  }, 500)
}
function startCountdown() {
  countdown.value = 60
  countdownTimer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0 && countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }, 1000)
}
function handleOtpInput(index: number) {
  const value = otpDigits.value[index]
  if (value && !/^\d$/.test(value)) {
    otpDigits.value[index] = ''
    return
  }
  if (value && index < 5) otpInputRefs.value[index + 1]?.focus()
}
function handleOtpKeydown(event: KeyboardEvent, index: number) {
  if (event.key === 'Backspace' && !otpDigits.value[index] && index > 0) {
    otpInputRefs.value[index - 1]?.focus()
  } else if (event.key === 'ArrowLeft' && index > 0) {
    otpInputRefs.value[index - 1]?.focus()
  } else if (event.key === 'ArrowRight' && index < 5) {
    otpInputRefs.value[index + 1]?.focus()
  } else if (event.key === 'Enter' && isOtpComplete.value) {
    handlePrimaryAction()
  }
}
function handleOtpPaste(event: ClipboardEvent) {
  event.preventDefault()
  const pasteData = event.clipboardData?.getData('text') || ''
  const digits = pasteData.replace(/\D/g, '').slice(0, 6).split('')
  if (digits.length > 0) {
    digits.forEach((digit, index) => {
      if (index < 6) otpDigits.value[index] = digit
    })
    otpInputRefs.value[Math.min(digits.length, 5)]?.focus()
  }
}
async function handlePrimaryAction() {
  if (!canSubmit.value || authStore.loading) return
  errorMessage.value = ''
  successMessage.value = ''
  if (isRegisterMode.value) {
    if (!showOtpInput.value) {
      const result = await authStore.sendRegisterOtp(username.value, email.value, password.value)
      if (result.success) {
        if (result.directSuccess) {
          successMessage.value = result.message
          setTimeout(() => emit('close'), 1000)
        } else {
          otpSent.value = true
          successMessage.value = result.message
          startCountdown()
          await nextTick()
          otpInputRefs.value[0]?.focus()
        }
      } else {
        errorMessage.value = result.message
      }
    } else {
      const result = await authStore.verifyRegister(username.value, email.value, password.value, otp.value)
      if (result.success) {
        successMessage.value = result.message
        setTimeout(() => emit('close'), 1000)
      } else {
        errorMessage.value = result.message
      }
    }
  } else if (isForgotMode.value) {
    if (forgotSkipVerify.value) {
      if (newPassword.value !== confirmPassword.value) {
        errorMessage.value = '两次输入的密码不一致'
        return
      }
      const result = await authStore.resetPassword(email.value, '', newPassword.value)
      if (result.success) {
        successMessage.value = result.message
        setTimeout(() => emit('close'), 1000)
      } else {
        errorMessage.value = result.message
      }
    } else if (!forgotOtpSent.value) {
      const result = await authStore.forgotPassword(email.value)
      if (result.success) {
        if (result.skipVerify) {
          forgotSkipVerify.value = true
        } else {
          forgotOtpSent.value = true
          successMessage.value = result.message
          startCountdown()
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
      const result = await authStore.resetPassword(email.value, otp.value, newPassword.value)
      if (result.success) {
        successMessage.value = result.message
        setTimeout(() => emit('close'), 1000)
      } else {
        errorMessage.value = result.message
      }
    }
  } else {
    const result = await authStore.login(email.value, password.value)
    if (result.success) {
      successMessage.value = result.message
      setTimeout(() => emit('close'), 1000)
    } else {
      errorMessage.value = result.message
    }
  }
}
function resetState() {
  username.value = ''
  email.value = ''
  password.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  otpDigits.value = ['', '', '', '', '', '']
  errorMessage.value = ''
  successMessage.value = ''
  isRegisterMode.value = false
  isForgotMode.value = false
  otpSent.value = false
  forgotOtpSent.value = false
  forgotSkipVerify.value = false
  showPassword.value = false
  resetValidation()
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  countdown.value = 0
  if (usernameCheckTimer) {
    clearTimeout(usernameCheckTimer)
    usernameCheckTimer = null
  }
  if (emailCheckTimer) {
    clearTimeout(emailCheckTimer)
    emailCheckTimer = null
  }
}
watch(() => props.visible, (val) => {
  if (val) resetState()
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
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.modal {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 420px;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
  animation: slideIn 0.3s ease;
}
@keyframes slideIn { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #E5E7EB;
}
.modal-header h3 { font-size: 16px; font-weight: 600; color: #111827; margin: 0; }
.modal-close {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: none; cursor: pointer;
  color: #6B7280; border-radius: 6px;
}
.modal-close:hover { background: #F3F4F6; color: #111827; }
.modal-close svg { width: 18px; height: 18px; }
.modal-body { padding: 24px 20px; }
.mode-switch { display: flex; gap: 8px; margin-bottom: 20px; background: #F3F4F6; padding: 4px; border-radius: 8px; justify-content: center; }
.mode-btn { flex: 1; padding: 8px 16px; border: none; background: transparent; border-radius: 6px; font-size: 14px; font-weight: 500; color: #6B7280; cursor: pointer; }
.mode-btn.active { background: #4F46E5; color: white; box-shadow: 0 2px 6px rgba(79, 70, 229, 0.3); }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 8px; }
.input-wrapper { display: flex; align-items: center; position: relative; }
.input-wrapper input { width: 100%; padding: 10px 12px; padding-right: 40px; border: 1px solid #D1D5DB; border-radius: 8px; font-size: 14px; outline: none; background: white; box-sizing: border-box; }
.input-wrapper input:hover:not(:disabled) { border-color: #9CA3AF; }
.input-wrapper input:focus { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
.input-wrapper input:disabled { background: #F9FAFB; cursor: not-allowed; }
.input-with-status { display: flex; align-items: center; position: relative; }
.input-with-status input { width: 100%; padding: 10px 12px; padding-right: 40px; border: 1px solid #D1D5DB; border-radius: 8px; font-size: 14px; outline: none; background: white; box-sizing: border-box; }
.toggle-password-btn { position: absolute; right: 8px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; cursor: pointer; color: #9CA3AF; }
.toggle-password-btn svg { width: 16px; height: 16px; }
.status-icon { position: absolute; right: 12px; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; }
.status-icon.checking { color: #9CA3AF; }
.status-icon.available { color: #10B981; }
.status-icon.taken { color: #EF4444; }
.status-icon svg { width: 20px; height: 20px; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.field-error { margin: 6px 0 0 0; font-size: 12px; color: #EF4444; }
.otp-inputs { display: flex; gap: 6px; justify-content: center; }
.otp-input { width: 32px; height: 36px; text-align: center; font-size: 14px; font-weight: 500; border: 1px solid #D1D5DB; border-radius: 4px; outline: none; background: white; }
.otp-input:focus { border-color: #4F46E5; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1); }
.otp-hint { margin: 8px 0 0 0; font-size: 12px; color: #9CA3AF; text-align: center; }
.forgot-link { text-align: center; margin-top: 0; padding-bottom: 16px; }
.forgot-link a { font-size: 13px; color: #4F46E5; text-decoration: none; }
.forgot-link a:hover { text-decoration: underline; }
.message { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 14px; border-radius: 8px; font-size: 13px; margin-top: 16px; }
.message svg { width: 16px; height: 16px; flex-shrink: 0; }
.message.error { background: #FEF2F2; border: 1px solid #FEE2E2; color: #DC2626; }
.message.success{ background: #F0FDF4; border: 1px solid #BBF7D0; color: #16A34A; }
.modal-footer { display: flex; gap: 12px; padding: 16px 20px; border-top: 1px solid #E5E7EB; justify-content: center; }
.modal-btn { padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; min-width: 80px; }
.modal-btn.cancel{ background: #F3F4F6; color: #6B7280; }
.modal-btn.cancel:hover{ background: #E5E7EB; }
.modal-btn.confirm{ background: #4F46E5; color: white; }
.modal-btn.confirm:hover:not(:disabled){ background: #4338CA; }
.modal-btn.confirm:disabled{ background: #A5B4FC; cursor: not-allowed; }
.loading-spinner{ width: 14px; height: 14px; border: 2px solid rgba(255, 255, 255, 0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
@media (max-width: 480px) {
  .modal{ width: 95%; max-height: 90vh; }
  .otp-input{ width: 30px; height: 34px; }
}
</style>
