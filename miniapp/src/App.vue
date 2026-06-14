<script>
export default {
  onLaunch() {
    console.log('App Launch')
  },
  onShow() {
    console.log('App Show')
  },
  onHide() {
    console.log('App Hide')
  }
}
</script>

<style>
page {
  background-color: #f5f6fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  font-size: 28rpx;
  color: #111827;
  -webkit-font-smoothing: antialiased;
}

::-webkit-scrollbar {
  display: none;
}

view, text, input, textarea {
  box-sizing: border-box;
}

input, textarea {
  font-family: inherit;
}
</style>
