<template>
  <div class="page">
    <header class="header">
      <div class="header-inner">
        <div class="brand">
          <button class="back-btn" @click="$router.push('/')">
            <svg viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div class="logo-dot"></div>
          <h1 class="title">智能分析</h1>
        </div>
        <div class="header-right">
          <div class="usage-pill" :class="{ warn: usage.credits <= 0 }">
            <span class="usage-dot"></span>
            <span>剩余 {{ usage.credits }} 积分</span>
            <template v-if="usageLoaded && usage.userType === 'guest'">
              <span class="usage-divider"></span>
              <span class="usage-upgrade" @click="showLoginModal = true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M12 15V3m0 0l-4 4m4-4l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                登录享 50 积分
              </span>
            </template>
          </div>
        </div>
      </div>
    </header>

    <div class="container">
      <div class="tabs-bar">
        <button class="tab" :class="{ active: activeTab === 'single' }" @click="activeTab = 'single'">
          <svg viewBox="0 0 24 24" fill="none"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          基金分析
        </button>
        <button class="tab" :class="{ active: activeTab === 'compare' }" @click="activeTab = 'compare'">
          <svg viewBox="0 0 24 24" fill="none"><path d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
多基金对比
        </button>
        <button class="tab" :class="{ active: activeTab === 'stock' }" @click="activeTab = 'stock'">
          <svg viewBox="0 0 24 24" fill="none"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          股票分析
        </button>
      </div>

      <!-- ====== Single Fund ====== -->
      <template v-if="activeTab === 'single'">
        <div class="card">
          <div class="card-header">
            <span>查询基金</span>
          </div>
          <div class="search-box">
            <svg class="s-icon" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            <input v-model="singleKeyword" placeholder="输入基金代码或名称搜索..." @input="handleSingleSearch" @keydown.enter="handleSingleLookup" @focus="singleInputFocused = true" @blur="singleInputFocused = false" class="s-input" />
            <button v-if="singleKeyword && !singleLookupLoading" class="s-lookup-btn" @click="handleSingleLookup" title="精确查询">
              <svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button v-if="singleKeyword" @click="singleKeyword=''; singleResults=[]; singleErrorMsg=''" class="s-clear">
              <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div v-if="singleInputFocused && !singleKeyword.trim() && fundHistory.length > 0" class="dropdown history-dropdown">
            <div class="dd-head">
              <span>最近查询</span>
              <button class="dd-clear" @mousedown.prevent="clearFundHistory">清除</button>
            </div>
            <div v-for="item in fundHistory" :key="item.code" class="dd-item" @mousedown.prevent="pickSingleHistory(item)">
              <div class="dd-info">
                <span class="dd-name">{{ item.name }}</span>
                <span class="dd-code">{{ item.code }}</span>
                <span class="dd-type" v-if="item.type">{{ item.type }}</span>
              </div>
              <span class="dd-action">选择</span>
            </div>
          </div>
          <div v-if="singleSearching || singleLookupLoading" class="search-hint"><div class="spinner-xs"></div> 搜索中...</div>
          <div v-else-if="singleResults.length > 0" class="dropdown">
            <div v-for="r in singleResults" :key="r.code" class="dd-item" @click="selectSingleFund(r)">
              <div class="dd-info">
                <span class="dd-name">{{ r.name }}</span>
                <span class="dd-code">{{ r.code }}</span>
                <span class="dd-type">{{ r.type }}</span>
              </div>
              <span class="dd-action" :class="{ picked: singleFund?.code === r.code }">{{ singleFund?.code === r.code ? '已选' : '选择' }}</span>
            </div>
          </div>
          <div v-else-if="singleKeyword && singleSearched && !singleSearching" class="no-result">
            <span>未找到匹配基金，</span>
            <button class="no-result-btn" @click="handleSingleLookup">精确查询「{{ singleKeyword }}」</button>
          </div>
        </div>

        <div v-if="singleFund" class="card fund-info-card">
          <div class="confirm-banner">
            <div class="confirm-info">
              <div class="confirm-main">
                <span class="confirm-name">{{ singleFund.name }}</span>
                <span class="confirm-code">{{ singleFund.code }}</span>
                <span class="confirm-type">{{ singleFund.type }}</span>
              </div>
              <div class="confirm-sub">
                <template v-if="singleChartData">最新净值 {{ singleLatestNav }} | 近1年 {{ singleYearReturn }}</template>
                <template v-else>加载走势数据中...</template>
              </div>
            </div>
          </div>

          <div v-if="singleChartLoading" class="chart-loading">
            <div class="spinner-xs"></div> 加载走势数据...
          </div>
          <div v-else-if="singleChartData" class="single-chart-wrap" ref="singleChartRef"></div>

          <div v-if="singleChartData" class="period-row">
            <span class="period-label">分析周期</span>
            <button v-for="p in periods" :key="p.value" class="period-btn" :class="{ active: singlePeriod === p.value }" @click="singlePeriod = p.value">{{ p.label }}</button>
          </div>
          <div v-if="singleChartData" class="action-row center">
            <button class="ai-btn" :disabled="analyzing || usage.credits < 2" @click="confirmSingleAnalysis">
              <svg v-if="!analyzing" viewBox="0 0 24 24" fill="none" class="btn-svg"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <div v-else class="spinner-xs white"></div>
              {{ analyzing ? 'AI 分析中...' : 'AI 智能分析' }}
            </button>
          </div>
          <div v-if="usage.userType === 'guest' && usage.credits < 2" class="upgrade-banner" @click="showLoginModal = true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>积分不足，<b>登录后可享 50 积分</b></span>
            <svg viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
        </div>

        <div v-if="singleErrorMsg" class="err-tip">
          <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          {{ singleErrorMsg }}
        </div>

        <div v-if="analysisResult || analyzing" class="card result-card">
          <div class="result-top">
            <div class="result-label">
              <svg viewBox="0 0 24 24" fill="none" class="card-icon"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              分析报告
            </div>
            <button v-if="analysisResult && !analyzing" class="copy-btn" @click="doCopy(analysisResult)">
              <svg viewBox="0 0 24 24" fill="none"><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              复制
            </button>
          </div>
          <div class="result-body">
            <div v-if="analyzing && !analysisResult" class="loading-state">
              <div class="dots"><span></span><span></span><span></span></div>
              <p>AI 正在分析...</p>
            </div>
            <div v-else class="md" v-html="renderedResult"></div>
            <div v-if="analyzing && analysisResult" class="cursor-wrap"><span class="cursor"></span></div>
          </div>
        </div>
      </template>

      <!-- ====== Compare ====== -->
      <template v-if="activeTab === 'compare'">
        <div class="card">
          <div class="card-header">
            <svg viewBox="0 0 24 24" fill="none" class="card-icon"><circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            <span>添加基金</span>
            <span class="card-hint">搜索或批量输入，最多6只</span>
          </div>

          <div class="input-toggle">
            <button class="toggle-btn" :class="{ active: cmpInputMode === 'search' }" @click="cmpInputMode = 'search'">搜索添加</button>
            <button class="toggle-btn" :class="{ active: cmpInputMode === 'batch' }" @click="cmpInputMode = 'batch'">批量输入</button>
          </div>

          <div v-if="cmpInputMode === 'search'" class="search-box">
            <svg class="s-icon" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            <input v-model="cmpKeyword" placeholder="搜索基金代码或名称..." @input="handleCmpSearch" @focus="cmpInputFocused = true" @blur="cmpInputFocused = false" class="s-input" />
            <button v-if="cmpKeyword" @click="cmpKeyword=''; cmpResults=[]" class="s-clear">
              <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div v-if="cmpInputFocused && !cmpKeyword.trim() && fundHistory.length > 0" class="dropdown history-dropdown">
            <div class="dd-head">
              <span>最近查询</span>
              <button class="dd-clear" @mousedown.prevent="clearFundHistory">清除</button>
            </div>
            <div v-for="item in fundHistory" :key="item.code" class="dd-item" @mousedown.prevent="pickCmpHistory(item)">
              <div class="dd-info">
                <span class="dd-name">{{ item.name }}</span>
                <span class="dd-code">{{ item.code }}</span>
                <span class="dd-type" v-if="item.type">{{ item.type }}</span>
              </div>
              <span class="dd-action">{{ isCmpAdded(item.code) ? '已添加' : '+ 添加' }}</span>
            </div>
          </div>
          <div v-else class="batch-area">
            <textarea v-model="batchInput" class="batch-input" placeholder="输入基金代码，支持空格、逗号或换行分隔&#10;例如：000001 000002 000003&#10;或每行一个代码" rows="3"></textarea>
            <button class="batch-btn" :disabled="!batchInput.trim() || batchLoading" @click="handleBatchAdd">
              <div v-if="batchLoading" class="spinner-xs"></div>
              <svg v-else viewBox="0 0 24 24" fill="none" class="btn-svg"><path d="M12 4v16m8-8H4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              添加
            </button>
          </div>

          <div v-if="batchErrors.length > 0" class="batch-errors">
            <div v-for="(e, i) in batchErrors" :key="i" class="batch-err">{{ e }}</div>
          </div>

          <div v-if="cmpSearching" class="search-hint"><div class="spinner-xs"></div> 搜索中...</div>
          <div v-else-if="cmpResults.length > 0" class="dropdown">
            <div v-for="r in cmpResults" :key="r.code" class="dd-item" @click="addCompareFund(r)">
              <div class="dd-info">
                <span class="dd-name">{{ r.name }}</span>
                <span class="dd-code">{{ r.code }}</span>
                <span class="dd-type">{{ r.type }}</span>
              </div>
              <span class="dd-action" :class="{ picked: isCmpAdded(r.code) }">{{ isCmpAdded(r.code) ? '已添加' : '+ 添加' }}</span>
            </div>
          </div>

          <div v-if="cmpFunds.length > 0" class="tags-area">
            <div class="tags-label">已选 ({{ cmpFunds.length }}/6)</div>
            <div class="tags">
              <div v-for="(f, i) in cmpFunds" :key="f.code" class="tag">
                <span class="tag-name">{{ f.name }}</span>
                <span class="tag-code">{{ f.code }}</span>
                <button class="tag-x" @click="cmpFunds.splice(i, 1)">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="cmpFunds.length >= 2" class="card">
          <div class="card-header">
            <svg viewBox="0 0 24 24" fill="none" class="card-icon"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>对比设置</span>
          </div>
          <div class="period-row" style="padding-bottom: 14px;">
            <button v-for="p in periods" :key="p.value" class="period-btn" :class="{ active: cmpPeriod === p.value }" @click="cmpPeriod = p.value; loadCompareChart()">{{ p.label }}</button>
          </div>
        </div>

        <div v-if="chartData" class="card">
          <div class="card-header">
            <svg viewBox="0 0 24 24" fill="none" class="card-icon"><path d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>对比走势图</span>
          </div>
          <div class="chart-wrap" ref="chartRef"></div>
          <div class="chart-footer">
            <button class="ai-btn" :disabled="comparing || usage.credits < 2" @click="confirmCompareAnalysis">
              <svg v-if="!comparing" viewBox="0 0 24 24" fill="none" class="btn-svg"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <div v-else class="spinner-xs white"></div>
              {{ comparing ? 'AI 分析中...' : 'AI 智能分析' }}
            </button>
          </div>
          <div v-if="usage.userType === 'guest' && usage.credits < 2" class="upgrade-banner" @click="showLoginModal = true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>积分不足，<b>登录后可享 50 积分</b></span>
            <svg viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
        </div>

        <div v-if="cmpErrorMsg" class="err-tip">
          <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          {{ cmpErrorMsg }}
        </div>

        <div v-if="cmpResult || comparing" class="card result-card">
          <div class="result-top">
            <div class="result-label">
              <svg viewBox="0 0 24 24" fill="none" class="card-icon"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              对比分析报告
            </div>
            <button v-if="cmpResult && !comparing" class="copy-btn" @click="doCopy(cmpResult)">
              <svg viewBox="0 0 24 24" fill="none"><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              复制
            </button>
          </div>
          <div class="result-body">
            <div v-if="comparing && !cmpResult" class="loading-state">
              <div class="dots"><span></span><span></span><span></span></div>
              <p>AI 正在分析...</p>
            </div>
            <div v-else class="md" v-html="renderedCmpResult"></div>
            <div v-if="comparing && cmpResult" class="cursor-wrap"><span class="cursor"></span></div>
          </div>
        </div>
      </template>

      <!-- ====== Stock Analysis ====== -->
      <template v-if="activeTab === 'stock'">
        <div class="card">
          <div class="card-header">
            <svg viewBox="0 0 24 24" fill="none" class="card-icon"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>股票分析</span>
            <span class="card-hint stock-hint">多智能体协同分析</span>
          </div>
          <div class="search-box">
            <svg class="s-icon" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            <input v-model="stockKeyword" placeholder="输入6位股票代码，如 600519..." @keydown.enter="handleStockLookup" @focus="stockInputFocused = true" @blur="stockInputFocused = false" class="s-input stock-input" maxlength="6" />
            <button v-if="stockKeyword" @click="stockKeyword=''; stockLookupResult=null; stockErrorMsg=''; stockLookupLoading=false" class="s-clear">
              <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div v-if="stockLookupLoading" class="search-hint"><div class="spinner-xs"></div> 查询中...</div>
          <div v-if="stockHistoryVisible.length > 0" class="dropdown history-dropdown">
            <div class="dd-head">
              <span>最近查询</span>
              <button class="dd-clear" @mousedown.prevent="clearStockHistory">清除</button>
            </div>
            <div v-for="item in stockHistoryVisible" :key="item.code" class="dd-item" @mousedown.prevent="pickStockHistory(item)">
              <div class="dd-info">
                <span class="dd-name">{{ item.name }}</span>
                <span class="dd-code">{{ item.code }}</span>
              </div>
              <span class="dd-action">查询</span>
            </div>
          </div>
          <div v-if="stockLookupResult && stockLookupResult.found" class="stock-info-panel">
            <div class="sip-row">
              <div class="sip-left">
                <span class="sip-name">{{ stockLookupResult.name }}</span>
                <span class="sip-code">{{ stockLookupResult.code }}</span>
                <span class="sip-industry" v-if="stockLookupResult.industry && isNaN(Number(stockLookupResult.industry))">{{ stockLookupResult.industry }}</span>
              </div>
              <div class="sip-right">
                <span class="sip-price">{{ stockLookupResult.price?.toFixed(2) }}</span>
                <span class="sip-change" :class="{ up: (stockLookupResult.change || 0) >= 0, down: (stockLookupResult.change || 0) < 0 }">
                  {{ (stockLookupResult.change || 0) >= 0 ? '+' : '' }}{{ (stockLookupResult.change || 0).toFixed(2) }}%
                </span>
              </div>
            </div>
            <div class="sip-details">
              <div class="sip-item" v-if="stockLookupResult.marketCap">
                <span class="sip-item-label">总市值</span>
                <span class="sip-item-value">{{ stockLookupResult.marketCap >= 10000 ? (stockLookupResult.marketCap / 10000).toFixed(2) + '万亿' : stockLookupResult.marketCap.toFixed(1) + '亿' }}</span>
              </div>
              <div class="sip-item" v-if="stockLookupResult.pe">
                <span class="sip-item-label">PE(动)</span>
                <span class="sip-item-value">{{ stockLookupResult.pe.toFixed(2) }}</span>
              </div>
              <div class="sip-item" v-if="stockLookupResult.pb">
                <span class="sip-item-label">PB</span>
                <span class="sip-item-value">{{ stockLookupResult.pb.toFixed(2) }}</span>
              </div>
              <div class="sip-item" v-if="stockLookupResult.totalShares">
                <span class="sip-item-label">总股本</span>
                <span class="sip-item-value">{{ stockLookupResult.totalShares >= 10000 ? (stockLookupResult.totalShares / 10000).toFixed(2) + '亿' : stockLookupResult.totalShares.toFixed(0) + '万' }}</span>
              </div>
              <button class="sip-help-trigger" :class="{ active: showPEPBHint }" @click="showPEPBHint = !showPEPBHint" title="PE/PB 估值参考" aria-label="PE/PB 估值参考说明">
                <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v5M12 7.5h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              </button>
            </div>
            <div v-if="showPEPBHint" class="sip-help-backdrop" @click="showPEPBHint = false"></div>
            <div v-if="showPEPBHint" class="sip-help-popover">
              <div class="sphp-head">
                <span>估值指标参考</span>
                <button class="sphp-close" @click="showPEPBHint = false">&#x2715;</button>
              </div>
              <div class="sphp-section">
                <div class="sphp-title">PE 市盈率（股价 ÷ 每股收益）</div>
                <div class="sphp-row"><span class="sphp-range">&lt; 15</span><span class="sphp-desc">低估 / 增速慢（银行、地产）</span></div>
                <div class="sphp-row"><span class="sphp-range">15 – 25</span><span class="sphp-desc">合理区间</span></div>
                <div class="sphp-row"><span class="sphp-range">25 – 40</span><span class="sphp-desc">高成长（科技、医药）</span></div>
                <div class="sphp-row"><span class="sphp-range">&gt; 50</span><span class="sphp-desc">泡沫风险，谨慎</span></div>
              </div>
              <div class="sphp-section">
                <div class="sphp-title">PB 市净率（股价 ÷ 每股净资产）</div>
                <div class="sphp-row"><span class="sphp-range">&lt; 1</span><span class="sphp-desc">破净，可能低估</span></div>
                <div class="sphp-row"><span class="sphp-range">1 – 2</span><span class="sphp-desc">合理（重资产）</span></div>
                <div class="sphp-row"><span class="sphp-range">2 – 5</span><span class="sphp-desc">轻资产 / 品牌溢价</span></div>
                <div class="sphp-row"><span class="sphp-range">&gt; 8</span><span class="sphp-desc">估值偏高</span></div>
              </div>
              <div class="sphp-tip">需结合行业、增速、ROE 综合判断；PEG &lt; 1 偏低估。仅供参考，不构成投资建议。</div>
            </div>
          </div>
          <div class="action-row center" style="padding-top: 8px;">
            <button class="ai-btn" :disabled="stockAnalyzing || usage.credits < 10 || !stockKeyword.trim()" @click="confirmStockAnalysis">
              <svg v-if="!stockAnalyzing" viewBox="0 0 24 24" fill="none" class="btn-svg"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <div v-else class="spinner-xs white"></div>
              {{ stockAnalyzing ? '多智能体分析中...' : '启动多智能体分析' }}
            </button>
          </div>
          <div v-if="usage.userType === 'guest' && usage.credits < 10" class="upgrade-banner" @click="showLoginModal = true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>积分不足，<b>登录后可享 50 积分</b></span>
            <svg viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
        </div>

        <div v-if="stockErrorMsg" class="err-tip">
          <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          {{ stockErrorMsg }}
        </div>

        <!-- Agent Pipeline Visualization -->
        <div v-if="stockAnalyzing || Object.keys(stockAgentReports).length > 0" class="card">
          <div class="card-header">
            <svg viewBox="0 0 24 24" fill="none" class="card-icon"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>{{ stockLookupResult?.name || stockKeyword }}<template v-if="stockLookupResult?.code">（{{ stockLookupResult.code }}）</template> 智能体分析流程</span>
            <span v-if="stockFinalDecision" class="decision-badge" :class="stockFinalDecision.toLowerCase()">{{ stockFinalDecision }}</span>
          </div>

          <div class="pipeline-flow">
            <!-- Phase 1: Analysts -->
            <div class="pf-phase pf-phase-analyst" :class="{ active: ['market_analyst','social_media_analyst','news_analyst','fundamentals_analyst'].some(n => stockAgentStatus[n]==='running') }">
              <div class="pf-phase-head">
                <span class="pf-phase-icon pf-icon-analyst">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625C9.75 8.004 10.254 7.5 10.875 7.5h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" fill="currentColor"/></svg>
                </span>
                <div class="pf-phase-title">
                  <span class="pf-phase-name">分析师团队</span>
                  <span class="pf-phase-desc">数据采集 & 分析</span>
                </div>
                <span class="pf-phase-step">01</span>
              </div>
              <div class="pf-nodes">
                <div v-for="name in ['market_analyst', 'social_media_analyst', 'news_analyst', 'fundamentals_analyst']" :key="name" class="pf-node" :class="stockAgentStatus[name]" @click="toggleAgentReport(name)">
                  <div class="pf-node-inner">
                    <div class="pf-node-avatar"></div>
                    <span class="pf-node-label">{{ stockAgentLabels[name] }}</span>
                    <div class="pf-status-dot"></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="pf-connector" :class="{ done: ['market_analyst','social_media_analyst','news_analyst','fundamentals_analyst'].every(n => stockAgentStatus[n]==='done') }"><div class="pf-connector-line"></div><svg class="pf-connector-arrow" viewBox="0 0 24 24" fill="none"><path d="M12 5v14m0 0l6-6m-6 6l-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>

            <!-- Phase 2: Research Debate -->
            <div class="pf-phase pf-phase-debate" :class="{ active: ['bull_researcher','bear_researcher','research_manager'].some(n => stockAgentStatus[n]==='running') }">
              <div class="pf-phase-head">
                <span class="pf-phase-icon pf-icon-debate">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
                <div class="pf-phase-title">
                  <span class="pf-phase-name">研究辩论</span>
                  <span class="pf-phase-desc">多空辩论 &bull; <span v-if="stockDebateRound > 0">第{{ stockDebateRound }}轮</span><span v-else>待开始</span></span>
                </div>
                <span class="pf-phase-step">02</span>
              </div>
              <div class="pf-nodes">
                <div v-for="name in ['bull_researcher', 'bear_researcher', 'research_manager']" :key="name" class="pf-node" :class="[stockAgentStatus[name], name === 'bull_researcher' ? 'pf-bull' : name === 'bear_researcher' ? 'pf-bear' : '']" @click="toggleAgentReport(name)">
                  <div class="pf-node-inner">
                    <div class="pf-node-avatar"></div>
                    <span class="pf-node-label">{{ stockAgentLabels[name] }}</span>
                    <div class="pf-status-dot"></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="pf-connector" :class="{ done: ['bull_researcher','bear_researcher','research_manager'].every(n => stockAgentStatus[n]==='done') }"><div class="pf-connector-line"></div><svg class="pf-connector-arrow" viewBox="0 0 24 24" fill="none"><path d="M12 5v14m0 0l6-6m-6 6l-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>

            <!-- Phase 3: Trader -->
            <div class="pf-phase pf-phase-trade" :class="{ active: stockAgentStatus.trader==='running' }">
              <div class="pf-phase-head">
                <span class="pf-phase-icon pf-icon-trade">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
                <div class="pf-phase-title">
                  <span class="pf-phase-name">交易计划</span>
                  <span class="pf-phase-desc">制定执行方案</span>
                </div>
                <span class="pf-phase-step">03</span>
              </div>
              <div class="pf-nodes">
                <div class="pf-node" :class="stockAgentStatus.trader" @click="toggleAgentReport('trader')">
                  <div class="pf-node-inner">
                    <div class="pf-node-avatar"></div>
                    <span class="pf-node-label">交易员</span>
                    <div class="pf-status-dot"></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="pf-connector" :class="{ done: stockAgentStatus.trader==='done' }"><div class="pf-connector-line"></div><svg class="pf-connector-arrow" viewBox="0 0 24 24" fill="none"><path d="M12 5v14m0 0l6-6m-6 6l-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>

            <!-- Phase 4: Risk Debate -->
            <div class="pf-phase pf-phase-risk" :class="{ active: ['aggressive_debator','conservative_debator','neutral_debator','risk_manager'].some(n => stockAgentStatus[n]==='running') }">
              <div class="pf-phase-head">
                <span class="pf-phase-icon pf-icon-risk">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
                <div class="pf-phase-title">
                  <span class="pf-phase-name">风险评估</span>
                  <span class="pf-phase-desc">三方辩论 &bull; <span v-if="stockRiskRound > 0">第{{ stockRiskRound }}轮</span><span v-else>待开始</span></span>
                </div>
                <span class="pf-phase-step">04</span>
              </div>
              <div class="pf-nodes">
                <div v-for="name in ['aggressive_debator', 'conservative_debator', 'neutral_debator', 'risk_manager']" :key="name" class="pf-node" :class="[stockAgentStatus[name], name === 'risk_manager' ? 'pf-final' : '']" @click="toggleAgentReport(name)">
                  <div class="pf-node-inner">
                    <div class="pf-node-avatar"></div>
                    <span class="pf-node-label">{{ stockAgentLabels[name] }}</span>
                    <div class="pf-status-dot"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Running agent content -->
          <div v-if="stockRunningAgent && stockRunningContent" class="running-content">
            <div class="running-header">
              <div class="running-spinner"></div>
              {{ stockAgentLabels[stockRunningAgent] || stockRunningAgent }} 正在分析
            </div>
            <div class="running-text">{{ stockRunningContent.slice(-500) }}<span class="cursor"></span></div>
          </div>

          <!-- Expanded agent report -->
          <div v-if="stockExpandedAgent && stockAgentReports[stockExpandedAgent]" class="agent-report-expanded">
            <div class="running-header">{{ stockAgentLabels[stockExpandedAgent] || stockExpandedAgent }} 的报告
              <button class="pf-close-btn" @click="stockExpandedAgent = ''">&#x2715;</button>
            </div>
            <div class="md" v-html="renderMd(stockAgentReports[stockExpandedAgent])"></div>
          </div>
        </div>

        <!-- Final Decision Card -->
        <div v-if="stockFinalDecision && stockAgentReports.risk_manager" class="card decision-card" :class="stockFinalDecision.toLowerCase()">
          <div class="decision-top">
            <div class="decision-icon-wrap">
              <span class="decision-icon-text">{{ stockFinalDecision === 'BUY' ? '&#x25B2;' : stockFinalDecision === 'SELL' ? '&#x25BC;' : '&#x25CF;' }}</span>
            </div>
            <div class="decision-info">
              <div class="decision-title">最终决策: {{ stockLookupResult?.name || stockKeyword }}（{{ stockLookupResult?.code || stockKeyword }}）建议{{ stockFinalDecision === 'BUY' ? '买入' : stockFinalDecision === 'SELL' ? '卖出' : '持有' }}</div>
              <div class="decision-sub">由风险经理综合多智能体分析得出</div>
            </div>
          </div>
          <div class="decision-body">
            <div class="md" v-html="renderMd(stockAgentReports.risk_manager)"></div>
          </div>
          <div class="decision-actions">
            <button class="copy-btn" @click="doCopy(stockAgentReports.risk_manager)">
              <svg viewBox="0 0 24 24" fill="none"><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              复制完整报告
            </button>
          </div>
        </div>

        <!-- Report Link -->
        <div v-if="stockReportUrl" class="card report-link-card">
          <div class="report-link-content">
            <div class="report-link-info">
              <svg viewBox="0 0 24 24" fill="none" class="report-link-icon"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <div>
                <div class="report-link-title">分析报告已生成</div>
                <div class="report-link-sub">独立的HTML报告，可在浏览器中直接打开查看（7天后自动删除）</div>
              </div>
            </div>
            <a :href="stockReportUrl" target="_blank" class="report-link-btn">
              打开报告
              <svg viewBox="0 0 24 24" fill="none"><path d="M14 5l7 7m0 0l-7 7m7-7H3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </a>
          </div>
        </div>
      </template>

      <!-- Confirm Dialog -->
      <Teleport to="body">
        <div v-if="confirmDialog.show" class="modal-mask" @click.self="confirmDialog.show = false">
          <div class="modal-box">
            <div class="modal-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <h3 class="modal-title">确认 AI 分析</h3>
            <div class="modal-body">
              <p>{{ confirmDialog.message }}</p>
              <div class="modal-funds">
                <span v-for="f in confirmDialog.funds" :key="f.code" class="modal-tag">{{ f.name }}（{{ f.code }}）</span>
              </div>
              <div class="modal-period">
                <svg viewBox="0 0 24 24" fill="none"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                {{ confirmDialog.periodLabel }}
              </div>
              <div class="modal-warn">将消耗 {{ confirmDialog.cost }} 积分（剩余 {{ usage.credits - confirmDialog.cost }} 积分）</div>
              <div v-if="usage.userType === 'guest'" class="modal-upgrade" @click="confirmDialog.show = false; showLoginModal = true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                登录后可享 <b>50 积分</b>
              </div>
            </div>
            <div class="modal-actions">
              <button class="modal-btn cancel" @click="confirmDialog.show = false">取消</button>
              <button class="modal-btn ok" @click="confirmDialog.onConfirm()">确认分析</button>
            </div>
          </div>
        </div>
      </Teleport>
    </div>

    <LoginModal :visible="showLoginModal" @close="onLoginModalClose" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch, reactive } from 'vue'
import * as echarts from 'echarts'
import { searchFunds } from '@/api/fund'
import { getAnalysisUsage, streamAnalysis, getNavHistory, lookupFunds, lookupStock, streamStockAnalysis } from '@/api/analysis'
import type { StockLookupResult, StockSSEEvent } from '@/api/analysis'
import LoginModal from '@/components/LoginModal.vue'
import type { SearchResult } from '@/types'
import type { FundNavHistory } from '@/api/analysis'

interface Usage { allowed: boolean; credits: number; userType: 'guest' | 'registered' }

const usage = ref<Usage>({ allowed: true, credits: 0, userType: 'guest' })
const usageLoaded = ref(false)
const showLoginModal = ref(false)
const activeTab = ref<'single' | 'compare' | 'stock'>('single')
const periods = [
  { value: '1m', label: '近1月' },
  { value: '3m', label: '近3月' },
  { value: '6m', label: '近6月' },
  { value: '1y', label: '近1年' }
]
const periodLabels: Record<string, string> = { '1m': '近1个月', '3m': '近3个月', '6m': '近6个月', '1y': '近1年' }

// --- Single ---
const singleKeyword = ref('')
const singleResults = ref<SearchResult[]>([])
const singleSearching = ref(false)
const singleSearched = ref(false)
const singleLookupLoading = ref(false)
const singleFund = ref<SearchResult | null>(null)
const singlePeriod = ref('1m')
const analyzing = ref(false)
const analysisResult = ref('')
const singleErrorMsg = ref('')
const singleChartLoading = ref(false)
const singleChartData = ref<FundNavHistory | null>(null)
const singleChartRef = ref<HTMLElement | null>(null)
let singleChartInstance: echarts.ECharts | null = null
const singleLatestNav = ref('')
const singleYearReturn = ref('')

// --- Compare ---
const cmpInputMode = ref<'search' | 'batch'>('search')
const cmpKeyword = ref('')
const cmpResults = ref<SearchResult[]>([])
const cmpSearching = ref(false)
const cmpFunds = ref<SearchResult[]>([])
const cmpPeriod = ref('1m')
const comparing = ref(false)
const cmpResult = ref('')
const cmpErrorMsg = ref('')
const chartLoading = ref(false)
const chartData = ref<Record<string, FundNavHistory> | null>(null)
const chartRef = ref<HTMLElement | null>(null)
let chartInstance: echarts.ECharts | null = null

const batchInput = ref('')
const batchLoading = ref(false)
const batchErrors = ref<string[]>([])

// --- Stock Analysis ---
const stockKeyword = ref('')
const stockLookupLoading = ref(false)
const stockLookupResult = ref<StockLookupResult | null>(null)
const stockAnalyzing = ref(false)
const stockErrorMsg = ref('')
const stockAgentStatus = ref<Record<string, 'pending' | 'running' | 'done' | 'error'>>({})
const stockAgentReports = ref<Record<string, string>>({})
const stockAgentLabels: Record<string, string> = {
  market_analyst: '市场分析师',
  social_media_analyst: '社媒分析师',
  news_analyst: '新闻分析师',
  fundamentals_analyst: '基本面分析',
  bull_researcher: '看多研究员',
  bear_researcher: '看空研究员',
  research_manager: '研究主管',
  trader: '交易员',
  aggressive_debator: '激进分析师',
  conservative_debator: '保守分析师',
  neutral_debator: '中性分析师',
  risk_manager: '风险经理',
}
const stockRunningAgent = ref('')
const stockRunningContent = ref('')
const stockExpandedAgent = ref('')
const stockFinalDecision = ref('')
const stockDebateRound = ref(0)
const stockRiskRound = ref(0)
const stockReportUrl = ref('')
const stockReportId = ref<number | null>(null)
const showPEPBHint = ref(false)

// --- Stock search history (最近10个) ---
const STOCK_HISTORY_KEY = 'stock_search_history'
const stockHistory = ref<Array<{ code: string; name: string }>>([])
const stockInputFocused = ref(false)

const stockHistoryVisible = computed(() => {
  if (!stockInputFocused.value || stockLookupLoading.value) return []
  const kw = stockKeyword.value.trim()
  if (!kw) return stockHistory.value
  return stockHistory.value.filter(it => it.code.startsWith(kw) || it.name.includes(kw))
})

function loadStockHistory() {
  try {
    const raw = localStorage.getItem(STOCK_HISTORY_KEY)
    if (raw) stockHistory.value = JSON.parse(raw)
  } catch { stockHistory.value = [] }
}
function addStockHistory(code: string, name: string) {
  if (!code) return
  const list = stockHistory.value.filter(it => it.code !== code)
  list.unshift({ code, name: name || code })
  stockHistory.value = list.slice(0, 10)
  try { localStorage.setItem(STOCK_HISTORY_KEY, JSON.stringify(stockHistory.value)) } catch { /* */ }
}
function clearStockHistory() {
  stockHistory.value = []
  try { localStorage.removeItem(STOCK_HISTORY_KEY) } catch { /* */ }
}
function pickStockHistory(item: { code: string; name: string }) {
  stockKeyword.value = item.code
  stockInputFocused.value = false
  handleStockLookup()
}

// --- Fund search history (最近10个, 单基金与对比共享) ---
const FUND_HISTORY_KEY = 'fund_search_history'
const fundHistory = ref<Array<{ code: string; name: string; type: string }>>([])
const singleInputFocused = ref(false)
const cmpInputFocused = ref(false)

function loadFundHistory() {
  try {
    const raw = localStorage.getItem(FUND_HISTORY_KEY)
    if (raw) fundHistory.value = JSON.parse(raw)
  } catch { fundHistory.value = [] }
}
function addFundHistory(code: string, name: string, type?: string) {
  if (!code) return
  const list = fundHistory.value.filter(it => it.code !== code)
  list.unshift({ code, name: name || code, type: type || '' })
  fundHistory.value = list.slice(0, 10)
  try { localStorage.setItem(FUND_HISTORY_KEY, JSON.stringify(fundHistory.value)) } catch { /* */ }
}
function clearFundHistory() {
  fundHistory.value = []
  try { localStorage.removeItem(FUND_HISTORY_KEY) } catch { /* */ }
}
function pickSingleHistory(item: { code: string; name: string; type: string }) {
  singleInputFocused.value = false
  selectSingleFund({ code: item.code, name: item.name, type: item.type || '', pinyin: '' })
}
function pickCmpHistory(item: { code: string; name: string; type: string }) {
  cmpInputFocused.value = false
  addCompareFund({ code: item.code, name: item.name, type: item.type || '', pinyin: '' })
}

const COLORS = ['#2563EB', '#DC2626', '#7C3AED', '#059669', '#D97706', '#0891B2']

const CACHE_KEY = 'smart_analysis_cache'

interface AnalysisCache {
  activeTab: 'single' | 'compare' | 'stock'
  single: {
    fund: SearchResult | null
    period: string
    analysisResult: string
    chartData: FundNavHistory | null
    latestNav: string
    yearReturn: string
  }
  compare: {
    funds: SearchResult[]
    period: string
    cmpResult: string
    chartData: Record<string, FundNavHistory> | null
  }
  stock: {
    keyword: string
    agentStatus: Record<string, 'pending' | 'running' | 'done' | 'error'>
    agentReports: Record<string, string>
    finalDecision: string
    reportUrl: string
    reportId: number | null
  }
}

function saveCache() {
  const cache: AnalysisCache = {
    activeTab: activeTab.value,
    single: {
      fund: singleFund.value,
      period: singlePeriod.value,
      analysisResult: analysisResult.value,
      chartData: singleChartData.value,
      latestNav: singleLatestNav.value,
      yearReturn: singleYearReturn.value,
    },
    compare: {
      funds: cmpFunds.value,
      period: cmpPeriod.value,
      cmpResult: cmpResult.value,
      chartData: chartData.value,
    },
    stock: {
      keyword: stockKeyword.value,
      agentStatus: stockAgentStatus.value,
      agentReports: stockAgentReports.value,
      finalDecision: stockFinalDecision.value,
      reportUrl: stockReportUrl.value,
      reportId: stockReportId.value,
    },
  }
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)) } catch { /* */ }
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AnalysisCache
  } catch { return null }
}

// --- Confirm Dialog ---
const confirmDialog = reactive({
  show: false,
  message: '',
  funds: [] as SearchResult[],
  periodLabel: '',
  cost: 2,
  onConfirm: () => {}
})

let singleTimer: number | null = null
let cmpTimer: number | null = null

async function onLoginModalClose() {
  showLoginModal.value = false
  try { usage.value = await getAnalysisUsage() } catch { /* */ }
}

onMounted(async () => {
  try { usage.value = await getAnalysisUsage() } catch { /* */ }
  usageLoaded.value = true

  loadStockHistory()
  loadFundHistory()
  const cache = loadCache()
  if (cache) {
    activeTab.value = cache.activeTab
    singleFund.value = cache.single.fund
    singlePeriod.value = cache.single.period
    analysisResult.value = cache.single.analysisResult
    singleChartData.value = cache.single.chartData
    singleLatestNav.value = cache.single.latestNav
    singleYearReturn.value = cache.single.yearReturn
    cmpFunds.value = cache.compare.funds
    cmpPeriod.value = cache.compare.period
    cmpResult.value = cache.compare.cmpResult
    chartData.value = cache.compare.chartData

    if (cache.stock) {
      stockKeyword.value = cache.stock.keyword
      stockAgentStatus.value = cache.stock.agentStatus
      stockAgentReports.value = cache.stock.agentReports
      stockFinalDecision.value = cache.stock.finalDecision
      stockReportUrl.value = cache.stock.reportUrl || ''
      stockReportId.value = cache.stock.reportId || null

      // 股价为实时行情，绝不使用缓存中的旧价：挂载时若有缓存的代码则自动重新查询最新价
      const cachedStockCode = (cache.stock.keyword || '').trim()
      if (/^\d{6}$/.test(cachedStockCode)) {
        lookupStock(cachedStockCode).then(result => {
          if (result.found) stockLookupResult.value = result
        }).catch(() => { /* 静默失败，用户手动查询时会再次提示 */ })
      }
    }

    if (cache.single.fund && cache.single.chartData) {
      await nextTick()
      renderSingleChart()
    }
    if (cache.compare.funds.length >= 2 && cache.compare.chartData) {
      await nextTick()
      renderChart()
    }
  }
})

watch(
  [activeTab, singleFund, singlePeriod, analysisResult, singleChartData, singleLatestNav, singleYearReturn,
   cmpFunds, cmpPeriod, cmpResult, chartData,
   stockKeyword, stockAgentStatus, stockAgentReports, stockFinalDecision, stockReportUrl, stockReportId],
  () => { saveCache() },
  { deep: true }
)

onUnmounted(() => {
  chartInstance?.dispose()
  singleChartInstance?.dispose()
})

// ---- search debounce ----
function debounceSearch(keyword: string, setter: (v: SearchResult[]) => void, loading: (v: boolean) => void, timerRef: 'singleTimer' | 'cmpTimer') {
  if (!keyword.trim()) { setter([]); return }
  if (timerRef === 'singleTimer' && singleTimer) clearTimeout(singleTimer)
  if (timerRef === 'cmpTimer' && cmpTimer) clearTimeout(cmpTimer)
  const timer = window.setTimeout(async () => {
    loading(true)
    try {
      const results = await searchFunds(keyword)
      setter(results)
      if (timerRef === 'singleTimer') {
        singleSearched.value = true
        if (results.length === 0) {
          loading(false)
          await handleSingleLookup()
          return
        }
      }
    } catch { setter([]) } finally { loading(false) }
  }, 300)
  if (timerRef === 'singleTimer') singleTimer = timer
  else cmpTimer = timer
}

function handleSingleSearch() { singleErrorMsg.value = ''; singleSearched.value = false; debounceSearch(singleKeyword.value, v => singleResults.value = v, v => singleSearching.value = v, 'singleTimer') }
function handleCmpSearch() { debounceSearch(cmpKeyword.value, v => cmpResults.value = v, v => cmpSearching.value = v, 'cmpTimer') }

function selectSingleFund(r: SearchResult) {
  singleFund.value = r; singleResults.value = []; singleKeyword.value = ''
  addFundHistory(r.code, r.name, r.type)
  loadSingleChart(r.code)
}

async function handleSingleLookup() {
  const code = singleKeyword.value.trim()
  if (!code) return
  singleLookupLoading.value = true
  singleErrorMsg.value = ''
  try {
    const results = await lookupFunds([code])
    if (results.length > 0 && results[0].found) {
      const r = results[0]
      singleFund.value = { code: r.code, name: r.name, type: r.type, pinyin: '' }
      singleResults.value = []
      singleKeyword.value = ''
      addFundHistory(r.code, r.name, r.type)
      loadSingleChart(r.code)
    } else {
      singleErrorMsg.value = `未找到基金 ${code}`
    }
  } catch {
    singleErrorMsg.value = '查询失败，请检查网络'
  }
  singleLookupLoading.value = false
}

async function loadSingleChart(code: string) {
  singleChartInstance?.dispose()
  singleChartInstance = null
  singleChartLoading.value = true
  singleChartData.value = null
  try {
    const data = await getNavHistory([code], '1y')
    if (data[code]) {
      singleChartData.value = data[code]
      const d = data[code].data
      if (d.length > 0) {
        const last = d[d.length - 1]
        singleLatestNav.value = last.nav.toFixed(4)
        const first = d[0]
        const ret = first.nav > 0 ? ((last.nav - first.nav) / first.nav * 100) : 0
        singleYearReturn.value = (ret >= 0 ? '+' : '') + ret.toFixed(2) + '%'
      }
      await nextTick()
      renderSingleChart()
    }
  } catch { /* */ }
  singleChartLoading.value = false
}

function getFilteredSingleData() {
  if (!singleChartData.value) return []
  const all = singleChartData.value.data
  if (singlePeriod.value === '1y') return all
  const now = new Date()
  let cutoff: Date
  if (singlePeriod.value === '1m') {
    cutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
  } else if (singlePeriod.value === '6m') {
    cutoff = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
  } else {
    cutoff = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
  }
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return all.filter(d => d.date >= cutoffStr)
}

function renderSingleChart() {
  if (!singleChartRef.value || !singleChartData.value) return
  if (!singleChartInstance) singleChartInstance = echarts.init(singleChartRef.value)

  const data = getFilteredSingleData()
  if (data.length === 0) return
  const dates = data.map(d => d.date)
  const navs = data.map(d => d.nav)
  const growths = data.map(d => d.growth)
  const baseNav = data[0].nav || 1
  const cumReturns = navs.map(nav => +((nav / baseNav - 1) * 100).toFixed(2))
  const isMobile = window.innerWidth < 640
  const maxLabels = isMobile ? 4 : 8
  const sampleInterval = Math.max(1, Math.floor(dates.length / maxLabels))

  singleChartInstance.setOption({
    animation: false,
    grid: { left: 52, right: 16, top: 28, bottom: isMobile ? 40 : 28 },
    title: {
      text: `累计 ${(() => { const v = cumReturns[cumReturns.length - 1] ?? 0; return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` })()}`,
      right: 60, top: 4,
      textStyle: {
        fontSize: 10, fontWeight: 600,
        color: (cumReturns[cumReturns.length - 1] ?? 0) >= 0 ? '#DC2626' : '#16A34A'
      }
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderColor: '#E5E7EB', borderWidth: 1,
      textStyle: { color: '#374151', fontSize: 12 },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return ''
        const di = params[0]?.dataIndex ?? 0
        const date = dates[di] || ''
        const nav = navs[di]
        const cr = cumReturns[di]
        const g = growths[di]
        return `<div style="font-size:11px;color:#9CA3AF;margin-bottom:6px">${date}</div>
          <div style="font-size:12px;line-height:2">净值 <b>${nav.toFixed(4)}</b></div>
          <div style="font-size:12px;line-height:2">累计涨幅 <b style="color:${cr >= 0 ? '#DC2626' : '#16A34A'}">${cr >= 0 ? '+' : ''}${cr.toFixed(2)}%</b></div>
          <div style="font-size:12px;line-height:2">日涨跌 <b style="color:${g >= 0 ? '#DC2626' : '#16A34A'}">${g >= 0 ? '+' : ''}${g.toFixed(2)}%</b></div>`
      }
    },
    xAxis: {
      type: 'category', data: dates,
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: {
        color: '#9CA3AF', fontSize: isMobile ? 9 : 10,
        interval: sampleInterval - 1,
        rotate: isMobile ? 45 : (dates.length > 60 ? 30 : 0),
        formatter: (v: string) => isMobile ? v.slice(5) : v
      },
      splitLine: { show: false }
    },
    yAxis: [
      {
        type: 'value', position: 'left',
        axisLine: { show: false }, axisTick: { show: false },
        splitLine: { lineStyle: { color: '#F3F4F6', type: 'dashed' } },
        axisLabel: { color: '#9CA3AF', fontSize: 10, formatter: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` }
      },
      {
        type: 'value', position: 'right',
        axisLine: { show: false }, axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { color: '#9CA3AF', fontSize: 10, formatter: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` }
      }
    ],
    series: [
      {
        name: '累计涨幅', type: 'line', smooth: true, yAxisIndex: 0,
        lineStyle: { width: 1.2, color: '#2563EB' },
        itemStyle: { color: '#2563EB' },
        showSymbol: false,
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#2563EB20' },
          { offset: 1, color: '#2563EB03' }
        ]) },
        data: cumReturns
      },
      {
        name: '日涨跌', type: 'bar', yAxisIndex: 1, barWidth: data.length > 120 ? 1 : 2,
        itemStyle: { color: (params: any) => params.value >= 0 ? '#DC2626' : '#16A34A' },
        data: growths
      }
    ]
  }, true)
}

function isCmpAdded(code: string) { return cmpFunds.value.some(f => f.code === code) }
function addCompareFund(r: SearchResult) {
  if (!isCmpAdded(r.code) && cmpFunds.value.length < 6) {
    cmpFunds.value.push(r)
    addFundHistory(r.code, r.name, r.type)
  }
}

// ---- batch add ----
async function handleBatchAdd() {
  const raw = batchInput.value.trim()
  if (!raw) return
  batchLoading.value = true
  batchErrors.value = []

  const tokens = raw.split(/[\s,，、\t\n]+/).filter(t => t.trim().length > 0)
  const uniqueTokens = [...new Set(tokens.map(t => t.trim()))]

  try {
    const results = await lookupFunds(uniqueTokens)
    for (const r of results) {
      if (cmpFunds.value.length >= 6) {
        batchErrors.value.push('最多只能添加6只基金')
        break
      }
      if (!r.found) {
        batchErrors.value.push(`${r.code} 未找到`)
        continue
      }
      if (isCmpAdded(r.code)) {
        batchErrors.value.push(`${r.code} 已存在`)
        continue
      }
      cmpFunds.value.push({ code: r.code, name: r.name, type: r.type, pinyin: '' })
    }
    if (batchErrors.value.length === 0) {
      batchInput.value = ''
    }
  } catch {
    batchErrors.value.push('查询失败，请检查网络')
  }
  batchLoading.value = false
}

// ---- markdown ----
function renderMd(md: string): string {
  let h = md
  h = h.replace(/^(\|.+\|)\n(\|[\s:|-]+\|)\n((?:\|.+\|\n?)*)/gm, (_match, headerRow: string, _sep: string, bodyRows: string) => {
    const parseCells = (row: string) => row.split('|').filter(c => c.trim() !== '').map(c => c.trim())
    const headers = parseCells(headerRow)
    const rows = bodyRows.trim().split('\n').filter(r => r.trim()).map(r => parseCells(r))
    let table = '<table><thead><tr>' + headers.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>'
    for (const row of rows) {
      table += '<tr>' + row.map(c => `<td>${c}</td>`).join('') + '</tr>'
    }
    table += '</tbody></table>'
    return table
  })
  h = h.replace(/^#### (.+)$/gm, '<h4>$1</h4>')
  h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  h = h.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  h = h.replace(/^# (.+)$/gm, '<h1>$1</h1>')
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  h = h.replace(/^\* (.+)$/gm, '<li>$1</li>')
  h = h.replace(/^- (.+)$/gm, '<li>$1</li>')
  h = h.replace(/(^|[^\*])\*(?!\s)(.+?)\*(?!\s)/g, '$1<em>$2</em>')
  h = h.replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
  h = h.replace(/(<li>.*<\/li>\n?)+/gs, m => `<ul>${m}</ul>`)
  h = h.replace(/\n{2,}/g, '</p><p>')
  h = h.replace(/\n/g, '<br>')
  h = '<p>' + h + '</p>'
  h = h.replace(/<p><\/p>/g, '')
  h = h.replace(/<p>(<h[123]>)/g, '$1')
  h = h.replace(/(<\/h[123]>)<\/p>/g, '$1')
  h = h.replace(/<p>(<ul>)/g, '$1')
  h = h.replace(/(<\/ul>)<\/p>/g, '$1')
  h = h.replace(/<p>(<table>)/g, '$1')
  h = h.replace(/(<\/table>)<\/p>/g, '$1')
  return h
}

const renderedResult = computed(() => analysisResult.value ? renderMd(analysisResult.value) : '')
const renderedCmpResult = computed(() => cmpResult.value ? renderMd(cmpResult.value) : '')

// ---- confirm & analyze ----
function confirmSingleAnalysis() {
  if (!singleFund.value || analyzing.value) return
  confirmDialog.show = true
  confirmDialog.message = '将对以下基金进行 AI 智能分析'
  confirmDialog.funds = [singleFund.value]
  confirmDialog.periodLabel = periodLabels[singlePeriod.value]
  confirmDialog.cost = 2
  confirmDialog.onConfirm = () => {
    confirmDialog.show = false
    doSingleAnalysis()
  }
}

async function doSingleAnalysis() {
  if (!singleFund.value || analyzing.value) return
  analyzing.value = true; analysisResult.value = ''; singleErrorMsg.value = ''
  try {
    await streamAnalysis([singleFund.value.code], singlePeriod.value,
      c => { analysisResult.value += c },
      (c) => { usage.value.credits = c },
      e => { singleErrorMsg.value = e; analyzing.value = false },
      () => { analyzing.value = false }
    )
  } catch (e: any) { singleErrorMsg.value = e?.message || '分析失败'; analyzing.value = false }
}

function confirmCompareAnalysis() {
  if (cmpFunds.value.length < 2 || comparing.value) return
  confirmDialog.show = true
  confirmDialog.message = `将对以下 ${cmpFunds.value.length} 只基金进行对比分析`
  confirmDialog.funds = [...cmpFunds.value]
  confirmDialog.periodLabel = periodLabels[cmpPeriod.value]
  confirmDialog.cost = 2
  confirmDialog.onConfirm = () => {
    confirmDialog.show = false
    doCompareAnalysis()
  }
}

async function doCompareAnalysis() {
  if (cmpFunds.value.length < 2 || comparing.value) return
  comparing.value = true; cmpResult.value = ''; cmpErrorMsg.value = ''
  try {
    await streamAnalysis(cmpFunds.value.map(f => f.code), cmpPeriod.value,
      c => { cmpResult.value += c },
      (c) => { usage.value.credits = c },
      e => { cmpErrorMsg.value = e; comparing.value = false },
      () => { comparing.value = false }
    )
  } catch (e: any) { cmpErrorMsg.value = e?.message || '分析失败'; comparing.value = false }
}

// ---- compare chart ----
async function loadCompareChart() {
  if (cmpFunds.value.length < 2) return
  chartLoading.value = true; cmpErrorMsg.value = ''
  try {
    const codes = cmpFunds.value.map(f => f.code)
    chartData.value = await getNavHistory(codes, cmpPeriod.value)
    await nextTick()
    renderChart()
  } catch { cmpErrorMsg.value = '加载走势数据失败' }
  finally { chartLoading.value = false }
}

function renderChart() {
  if (!chartRef.value || !chartData.value) return
  if (!chartInstance) chartInstance = echarts.init(chartRef.value)

  const allDates = new Set<string>()
  const seriesList: echarts.SeriesOption[] = []
  let idx = 0

  for (const [code, fund] of Object.entries(chartData.value)) {
    const info = cmpFunds.value.find(f => f.code === code)
    const name = info?.name || fund.name
    fund.data.forEach(d => allDates.add(d.date))
    const baseNav = fund.data.length > 0 ? fund.data[0].nav : 1
    seriesList.push({
      name,
      type: 'line',
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 1, color: COLORS[idx % COLORS.length] },
      itemStyle: { color: COLORS[idx % COLORS.length] },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: COLORS[idx % COLORS.length] + '18' },
        { offset: 1, color: COLORS[idx % COLORS.length] + '03' }
      ]) },
      data: fund.data.map(d => baseNav > 0 ? +((d.nav / baseNav - 1) * 100).toFixed(2) : 0)
    })
    idx++
  }

  const sortedDates = [...allDates].sort()
  const isMobile = window.innerWidth < 640
  const maxLabels = isMobile ? 4 : 8
  const sampleInterval = Math.max(1, Math.floor(sortedDates.length / maxLabels))

  chartInstance.setOption({
    animation: false,
    grid: { left: 52, right: 16, top: 36, bottom: isMobile ? 40 : 28 },
    legend: {
      top: 4, left: 'center', textStyle: { fontSize: 11, color: '#6B7280' },
      itemWidth: 14, itemHeight: 8, itemGap: 16
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderColor: '#E5E7EB',
      borderWidth: 1,
      textStyle: { color: '#374151', fontSize: 12 },
      formatter: (params: any) => {
        if (!Array.isArray(params)) return ''
        const di = params[0]?.dataIndex
        const date = sortedDates[di] || ''
        let html = `<div style="font-size:11px;color:#9CA3AF;margin-bottom:6px">${date}</div>`
        for (const p of params) {
          const sign = p.value >= 0 ? '+' : ''
          html += `<div style="display:flex;justify-content:space-between;gap:16px;font-size:12px;line-height:2">
            <span><span style="color:${p.color}">●</span> ${p.seriesName}</span>
            <span style="font-weight:600;color:${p.value >= 0 ? '#DC2626' : '#16A34A'}">${sign}${p.value.toFixed(2)}%</span></div>`
        }
        return html
      }
    },
    xAxis: {
      type: 'category', data: sortedDates,
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: {
        color: '#9CA3AF', fontSize: isMobile ? 9 : 10,
        interval: sampleInterval - 1,
        rotate: isMobile ? 45 : (sortedDates.length > 60 ? 30 : 0),
        formatter: (v: string) => isMobile ? v.slice(5) : v
      },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false }, axisTick: { show: false },
      splitLine: { lineStyle: { color: '#F3F4F6', type: 'dashed' } },
      axisLabel: { color: '#9CA3AF', fontSize: 10, formatter: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` }
    },
    series: seriesList
  }, true)
}

watch(singlePeriod, () => {
  if (singleChartData.value && singleChartRef.value) {
    renderSingleChart()
  }
})
watch(singleChartRef, (el) => {
  if (el && singleChartData.value) renderSingleChart()
  else if (!el) { singleChartInstance?.dispose(); singleChartInstance = null }
})
watch(chartRef, (el) => {
  if (el && chartData.value) renderChart()
  else if (!el) { chartInstance?.dispose(); chartInstance = null }
})

const resizeHandler = () => { singleChartInstance?.resize(); chartInstance?.resize() }
window.addEventListener('resize', resizeHandler)
onUnmounted(() => window.removeEventListener('resize', resizeHandler))

// ---- stock analysis ----
async function handleStockLookup() {
  const code = stockKeyword.value.trim()
  if (!/^\d{6}$/.test(code)) {
    stockErrorMsg.value = '请输入6位股票代码（6位数字）'
    return
  }
  stockLookupLoading.value = true
  stockErrorMsg.value = ''
  stockLookupResult.value = null
  try {
    const result = await lookupStock(code)
    stockLookupResult.value = result
    if (!result.found) {
      stockErrorMsg.value = `未找到股票 ${code}，请确认代码是否正确`
    } else {
      addStockHistory(result.code ?? code, result.name ?? '')
    }
  } catch {
    stockErrorMsg.value = '查询失败，请检查网络'
  }
  stockLookupLoading.value = false
}

function toggleAgentReport(name: string) {
  if (stockExpandedAgent.value === name) {
    stockExpandedAgent.value = ''
  } else if (stockAgentReports.value[name]) {
    stockExpandedAgent.value = name
  }
}

async function confirmStockAnalysis() {
  const code = stockKeyword.value.trim()
  if (!/^\d{6}$/.test(code)) {
    stockErrorMsg.value = '请输入6位股票代码'
    return
  }
  // 触发分析前必须重新查询最新行情（不信任缓存或页面停留期间的旧价）
  stockLookupLoading.value = true
  try {
    const result = await lookupStock(code)
    stockLookupResult.value = result
    if (!result.found) {
      stockErrorMsg.value = `未找到股票 ${code}，请确认代码是否正确`
      stockLookupLoading.value = false
      return
    } else {
      addStockHistory(result.code ?? code, result.name ?? '')
    }
  } catch {
    stockErrorMsg.value = '查询失败，请检查网络后重试'
    stockLookupLoading.value = false
    return
  }
  stockLookupLoading.value = false
  confirmDialog.show = true
  confirmDialog.message = '将启动多智能体对该股票进行全面分析'
  confirmDialog.funds = [{ code, name: stockLookupResult.value.name || code, type: '股票', pinyin: '' }]
  confirmDialog.periodLabel = '多智能体全流程'
  confirmDialog.cost = 10
  confirmDialog.onConfirm = () => {
    confirmDialog.show = false
    doStockAnalysis(code)
  }
}

async function doStockAnalysis(code: string) {
  stockAnalyzing.value = true
  stockErrorMsg.value = ''
  stockAgentStatus.value = {}
  stockAgentReports.value = {}
  stockRunningAgent.value = ''
  stockRunningContent.value = ''
  stockExpandedAgent.value = ''
  stockFinalDecision.value = ''
  stockDebateRound.value = 0
  stockRiskRound.value = 0
  stockReportUrl.value = ''
  stockReportId.value = null

  try {
    await streamStockAnalysis(code, {
      onEvent: (event: StockSSEEvent) => {
        if (event.type === 'agent_start' && event.agent) {
          stockAgentStatus.value[event.agent] = 'running'
          stockRunningAgent.value = event.agent
          stockRunningContent.value = event.content || ''
        } else if (event.type === 'agent_progress' && event.agent) {
          stockRunningContent.value += (event.content || '')
        } else if (event.type === 'agent_complete' && event.agent) {
          stockAgentStatus.value[event.agent] = 'done'
          if (event.report) {
            stockAgentReports.value[event.agent] = event.report
          }
          if (stockRunningAgent.value === event.agent) {
            stockRunningAgent.value = ''
            stockRunningContent.value = ''
          }
        } else if (event.type === 'tool_call') {
          // Tool calls can be shown if needed
        } else if (event.type === 'tool_result') {
          // Tool results can be shown if needed
        } else if (event.type === 'debate_start') {
          if (event.debateType === 'research') {
            stockDebateRound.value = event.round || 0
          } else if (event.debateType === 'risk') {
            stockRiskRound.value = event.round || 0
          }
        } else if (event.type === 'debate_round') {
          // Round complete
        } else if (event.type === 'decision' && event.decision) {
          stockFinalDecision.value = event.decision
        } else if (event.type === 'done') {
          if (event.reportUrl) {
            stockReportUrl.value = event.reportUrl
          }
          if (event.reportId) {
            stockReportId.value = event.reportId
          }
        }
      },
      onUsage: (credits) => {
        usage.value.credits = credits
      },
      onError: (error) => {
        stockErrorMsg.value = error
        stockAnalyzing.value = false
      },
      onDone: () => {
        stockAnalyzing.value = false
        // Mark any still-running agents as done
        for (const key of Object.keys(stockAgentStatus.value)) {
          if (stockAgentStatus.value[key] === 'running') {
            stockAgentStatus.value[key] = 'done'
          }
        }
      }
    })
  } catch (e: any) {
    stockErrorMsg.value = e?.message || '分析失败'
    stockAnalyzing.value = false
  }
}

// ---- copy ----
async function doCopy(text: string) {
  try { await navigator.clipboard.writeText(text) } catch {
    const ta = document.createElement('textarea'); ta.value = text
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
  }
}
</script>

<style scoped>
.page { min-height: 100vh; background: linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 40%); }
.header {
  background: rgba(255,255,255,0.92); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(0,0,0,0.06); padding: 12px 0; position: sticky; top: 0; z-index: 100;
}
.header-inner { max-width: 1200px; margin: 0 auto; padding: 0 20px; display: flex; justify-content: space-between; align-items: center; }
.brand { display: flex; align-items: center; gap: 10px; }
.back-btn {
  width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
  background: #F1F5F9; border: none; border-radius: 8px; cursor: pointer; color: #475569; transition: all 0.15s;
}
.back-btn:hover { background: #E2E8F0; color: #334155; }
.back-btn svg { width: 16px; height: 16px; }
.logo-dot {   width: 8px; height: 8px; background: linear-gradient(135deg, #BE123C, #F43F5E); border-radius: 50%; }
.title { font-size: 17px; font-weight: 700; color: #0F172A; margin: 0; letter-spacing: -0.02em; }
.usage-pill {
  display: flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 500;
  background: #EFF6FF; color: #2563EB; border: 1px solid #93C5FD;
}
.usage-pill.warn { background: #FEF2F2; color: #DC2626; border-color: #FECACA; }
.usage-dot { width: 6px; height: 6px; border-radius: 50%; background: #3B82F6; }
.usage-pill.warn .usage-dot { background: #EF4444; }
.usage-divider { width: 1px; height: 12px; background: #93C5FD; flex-shrink: 0; }
.usage-pill.warn .usage-divider { background: #FECACA; }
.usage-upgrade {
  display: flex; align-items: center; gap: 3px;
  cursor: pointer; color: #2563EB; font-weight: 600; white-space: nowrap;
  transition: opacity 0.15s;
}
.usage-upgrade:hover { opacity: 0.75; }
.usage-upgrade svg { width: 12px; height: 12px; flex-shrink: 0; }

.container { max-width: 1200px; margin: 0 auto; padding: 20px 20px 40px; }

.tabs-bar { display: flex; gap: 4px; margin-bottom: 16px; background: #F1F5F9; padding: 4px; border-radius: 10px; }
.tab {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 0; border: none; border-radius: 7px; background: transparent;
  color: #64748B; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s;
}
.tab svg { width: 15px; height: 15px; }
.tab:hover { color: #334155; }
.tab.active { background: white; color: #BE123C; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }

.card {
  background: white; border-radius: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.08);
  margin-bottom: 20px; overflow: hidden;
}
.card-header {
  display: flex; align-items: center; gap: 6px; padding: 14px 18px 0; font-size: 13px; font-weight: 600; color: #334155;
}
.card-icon { width: 16px; height: 16px; color: #E11D48; flex-shrink: 0; }
.card-hint { font-size: 11px; font-weight: 400; color: #94A3B8; margin-left: auto; }
.stock-hint { color: #E11D48; font-weight: 600; }

.search-box { position: relative; margin: 10px 18px 14px; display: flex; align-items: center; }
.s-icon { position: absolute; left: 12px; width: 16px; height: 16px; color: #94A3B8; pointer-events: none; }
.s-input {
  width: 100%; padding: 9px 36px 9px 34px; border: 1px solid #E2E8F0; border-radius: 10px;
  outline: none; font-size: 13px; color: #1E293B; background: #FAFAFA; transition: all 0.2s;
}
.s-input:focus { border-color: #FB7185; background: white; box-shadow: 0 0 0 3px rgba(225,29,72,0.1); }
.s-input::placeholder { color: #94A3B8; }
.stock-input { font-weight: 700; letter-spacing: 0.5px; }
.s-clear {
  position: absolute; right: 8px; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
  background: none; border: none; cursor: pointer; color: #94A3B8; border-radius: 5px;
}
.s-clear:hover { color: #64748B; }
.s-clear svg { width: 12px; height: 12px; }
.s-lookup-btn {
  position: absolute; right: 34px; width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; cursor: pointer; color: #E11D48; border-radius: 5px; transition: all 0.15s;
}
.s-lookup-btn:hover { color: #BE123C; }
.s-lookup-btn svg { width: 14px; height: 14px; }

.input-toggle {
  display: flex; gap: 4px; margin: 10px 18px 0; padding: 3px; background: #F1F5F9; border-radius: 7px;
}
.toggle-btn {
  flex: 1; padding: 5px 0; border: none; border-radius: 5px; background: transparent;
  color: #64748B; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s; text-align: center;
}
.toggle-btn.active { background: white; color: #BE123C; box-shadow: 0 1px 2px rgba(0,0,0,0.06); }

.batch-area { display: flex; gap: 8px; margin: 10px 18px 14px; align-items: flex-start; }
.batch-input {
  flex: 1; padding: 8px 12px; border: 1px solid #93C5FD; border-radius: 10px;
  outline: none; font-size: 13px; color: #1E293B; background: #FAFAFA; resize: vertical;
  font-family: inherit; line-height: 1.6; transition: all 0.2s;
}
.batch-input:focus { border-color: #FB7185; background: white; box-shadow: 0 0 0 3px rgba(225,29,72,0.1); }
.batch-input::placeholder { color: #94A3B8; }
.batch-btn {
  display: flex; align-items: center; justify-content: center; gap: 5px;
  padding: 8px 16px; border: none; border-radius: 10px;
  background: #E11D48; color: white; font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.batch-btn:hover:not(:disabled) { background: #BE123C; }
.batch-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.batch-btn .btn-svg { width: 14px; height: 14px; }

.batch-errors { margin: 6px 18px 0; }
.batch-err { font-size: 11px; color: #EF4444; line-height: 1.6; }

.search-hint { display: flex; align-items: center; gap: 6px; padding: 8px 18px; font-size: 12px; color: #94A3B8; }
.spinner-xs {
  width: 14px; height: 14px; border: 2px solid rgba(225,29,72,0.15); border-top-color: #E11D48;
  border-radius: 50%; animation: spin 0.7s linear infinite;
}
.spinner-xs.white { border-color: rgba(255,255,255,0.3); border-top-color: white; }

.dropdown { margin: 6px 18px 12px; border: 1px solid #E2E8F0; border-radius: 10px; max-height: 200px; overflow-y: auto; }
.dd-item {
  display: flex; justify-content: space-between; align-items: center; padding: 8px 14px;
  cursor: pointer; transition: background 0.12s; border-bottom: 1px solid #F8FAFC;
}
.dd-item:last-child { border-bottom: none; }
.dd-item:hover { background: #FAFAFA; }
.dd-info { display: flex; align-items: center; gap: 8px; }
.dd-name { font-size: 13px; font-weight: 600; color: #1E293B; }
.dd-code { font-size: 10px; color: #64748B; background: #F1F5F9; padding: 1px 6px; border-radius: 4px; }
.dd-type { font-size: 10px; color: #E11D48; font-weight: 500; }
.dd-action { font-size: 12px; color: #E11D48; font-weight: 500; }
.dd-action.picked { color: #94A3B8; }
.history-dropdown .dd-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 14px; background: #F8FAFC; border-bottom: 1px solid #F1F5F9;
  font-size: 11px; color: #94A3B8; font-weight: 600; letter-spacing: 0.02em;
}
.dd-clear { background: none; border: none; cursor: pointer; font-size: 11px; color: #94A3B8; padding: 0; }
.dd-clear:hover { color: #E11D48; }

.no-result {
  display: flex; align-items: center; justify-content: center; gap: 4px;
  padding: 12px 18px; font-size: 13px; color: #94A3B8;
}
.no-result-btn {
  background: none; border: none; color: #E11D48; font-size: 13px;
  font-weight: 600; cursor: pointer; padding: 0; text-decoration: underline;
}
.no-result-btn:hover { color: #BE123C; }

.tags-area { padding: 0 18px 12px; margin-top: 8px; }
.tags-label { font-size: 11px; color: #94A3B8; margin-bottom: 6px; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tag {
  display: flex; align-items: center; gap: 5px; padding: 4px 8px 4px 10px;
  background: #FFF1F2; border: 1px solid #FECDD3; border-radius: 7px; font-size: 12px;
}
.tag-name { font-weight: 600; color: #9F1239; }
.tag-code { color: #E11D48; font-size: 10px; }
.tag-x {
  width: 18px; height: 18px; display: flex; align-items: center; justify-content: center;
  background: rgba(225,29,72,0.1); border: none; border-radius: 50%; cursor: pointer; color: #E11D48; transition: all 0.12s;
}
.tag-x:hover { background: rgba(225,29,72,0.2); }
.tag-x svg { width: 10px; height: 10px; }

.fund-info-card { margin-top: 4px; }
.confirm-banner {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 12px 14px 0; margin: 0 18px; background: #FFF1F2; border: 1px solid #FECDD3; border-radius: 10px;
}
.confirm-info { flex: 1; }
.confirm-main { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.confirm-name { font-size: 14px; font-weight: 700; color: #9F1239; }
.confirm-code { font-size: 11px; color: #E11D48; background: white; padding: 1px 7px; border-radius: 4px; }
.confirm-type { font-size: 11px; color: #E11D48; font-weight: 500; }
.confirm-sub { font-size: 11px; color: #64748B; margin-top: 4px; }
.confirm-clear {
  width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
  background: rgba(225,29,72,0.1); border: none; border-radius: 50%; cursor: pointer; color: #E11D48; transition: all 0.12s; margin-left: 8px; flex-shrink: 0;
}
.confirm-clear:hover { background: rgba(225,29,72,0.2); }
.confirm-clear svg { width: 12px; height: 12px; }

.chart-loading { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 28px 0; color: #94A3B8; font-size: 13px; }
.single-chart-wrap { height: 260px; padding: 8px 10px 0; }

.period-label { font-size: 12px; color: #94A3B8; white-space: nowrap; display: flex; align-items: center; }

.period-row { display: flex; gap: 6px; padding: 10px 18px 0; align-items: center; }
.period-btn {
  flex: 1; padding: 7px 0; border: 1px solid #E2E8F0; border-radius: 8px;
  background: #FAFAFA; color: #64748B; font-size: 13px; font-weight: 500;
  cursor: pointer; transition: all 0.15s; text-align: center;
}
.period-btn:hover { border-color: #FECDD3; color: #E11D48; }
.period-btn.active { background: #E11D48; border-color: #E11D48; color: white; box-shadow: 0 2px 6px rgba(225,29,72,0.25); }

.action-row { display: flex; gap: 8px; padding: 14px 18px 16px; justify-content: center; }
.action-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  padding: 7px 18px; border: 1.5px solid #E2E8F0; border-radius: 8px;
  background: white; color: #475569; font-size: 13px; font-weight: 600;
  cursor: pointer; transition: all 0.15s;
}
.action-btn:hover:not(:disabled) { border-color: #FECDD3; color: #E11D48; }
.action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-svg { width: 16px; height: 16px; }

.chart-footer { display: flex; justify-content: center; padding: 4px 18px 14px; }
.ai-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  padding: 7px 16px; border: none; border-radius: 18px;
  background: linear-gradient(135deg, #BE123C, #F43F5E); color: white;
  font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(225,29,72,0.2);
  white-space: nowrap;
}
.ai-btn:hover:not(:disabled) { box-shadow: 0 4px 14px rgba(225,29,72,0.3); transform: translateY(-1px); }
.ai-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; box-shadow: none; }
.ai-btn .btn-svg { width: 14px; height: 14px; }
.ai-btn .spinner-xs { width: 12px; height: 12px; border-width: 1.5px; }

.upgrade-banner {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  margin: 8px 18px 0; padding: 8px 14px; border-radius: 10px; cursor: pointer;
  background: linear-gradient(135deg, #EFF6FF, #DBEAFE); border: 1px solid #93C5FD;
  color: #2563EB; font-size: 12px; font-weight: 500; transition: all 0.15s;
}
.upgrade-banner:hover { box-shadow: 0 2px 8px rgba(37,99,235,0.15); }
.upgrade-banner svg { width: 14px; height: 14px; flex-shrink: 0; }
.upgrade-banner b { font-weight: 700; }

.chart-wrap { height: 320px; padding: 8px 10px 10px; }

.err-tip {
  display: flex; align-items: center; gap: 8px; padding: 10px 16px; margin-bottom: 12px;
  background: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px; color: #DC2626; font-size: 13px;
}
.err-tip svg { width: 16px; height: 16px; flex-shrink: 0; }

.result-card { border: 1px solid rgba(225,29,72,0.15); }
.result-card .result-top {
  display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; border-bottom: 1px solid #F1F5F9;
}
.result-label { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: #334155; }
.copy-btn {
  display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #F1F5F9;
  border: none; border-radius: 6px; font-size: 11px; color: #64748B; cursor: pointer; transition: all 0.12s;
}
.copy-btn:hover { background: #E2E8F0; color: #334155; }
.copy-btn svg { width: 13px; height: 13px; }
.result-body { padding: 16px 18px; min-height: 80px; }

.loading-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 32px 0; color: #94A3B8; font-size: 13px; }
.dots { display: flex; gap: 5px; }
.dots span { width: 8px; height: 8px; background: #E11D48; border-radius: 50%; animation: bounce 1.4s ease-in-out infinite both; }
.dots span:nth-child(1) { animation-delay: 0s; }
.dots span:nth-child(2) { animation-delay: 0.16s; }
.dots span:nth-child(3) { animation-delay: 0.32s; }
@keyframes bounce { 0%,80%,100%{transform:scale(0.5);opacity:0.3} 40%{transform:scale(1);opacity:1} }

.md { line-height: 1.8; color: #475569; font-size: 13px; }
.md :deep(h1) { font-size: 16px; font-weight: 700; color: #1E293B; margin: 16px 0 8px; }
.md :deep(h2) { font-size: 15px; font-weight: 700; color: #1E293B; margin: 14px 0 6px; }
.md :deep(h3) { font-size: 14px; font-weight: 600; color: #334155; margin: 10px 0 4px; }
.md :deep(h4) { font-size: 13px; font-weight: 600; color: #475569; margin: 8px 0 3px; }
.md :deep(strong) { color: #0F172A; font-weight: 600; }
.md :deep(ul) { margin: 6px 0; padding-left: 18px; }
.md :deep(li) { margin: 3px 0; }
.md :deep(table) { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; }
.md :deep(th) { background: #FFF1F2; color: #9F1239; font-weight: 600; text-align: left; padding: 8px 10px; border: 1px solid #FECDD3; }
.md :deep(td) { padding: 7px 10px; border: 1px solid #E2E8F0; color: #475569; }
.md :deep(tr:nth-child(even) td) { background: #FAFAFA; }
.md :deep(tr:hover td) { background: #FFF1F2; }

.cursor-wrap { display: inline-block; margin-left: 2px; }
.cursor { display: inline-block; width: 7px; height: 14px; background: #E11D48; border-radius: 1px; animation: blink 1s step-end infinite; vertical-align: text-bottom; }
@keyframes blink { 50%{opacity:0} }
@keyframes spin { 0%{transform:rotate(0)} 100%{transform:rotate(360deg)} }

.modal-mask {
  position: fixed; inset: 0; background: rgba(15,23,42,0.4); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.modal-box {
  background: white; border-radius: 16px; width: 380px; max-width: 90vw; padding: 28px 24px 20px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15); animation: modalIn 0.2s ease;
}
@keyframes modalIn { from { opacity: 0; transform: translateY(12px) scale(0.97); } to { opacity: 1; transform: none; } }
.modal-icon-wrap {
  width: 44px; height: 44px; background: #FFF1F2; border-radius: 12px;
  display: flex; align-items: center; justify-content: center; margin: 0 auto 14px;
}
.modal-icon-wrap svg { width: 24px; height: 24px; color: #E11D48; }
.modal-title { text-align: center; font-size: 16px; font-weight: 700; color: #0F172A; margin: 0 0 14px; }
.modal-body { text-align: center; }
.modal-body > p { font-size: 13px; color: #64748B; margin: 0 0 12px; }
.modal-funds { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin-bottom: 10px; }
.modal-tag {
  font-size: 12px; color: #9F1239; background: #FFF1F2; border: 1px solid #FECDD3;
  padding: 3px 10px; border-radius: 6px; font-weight: 500;
}
.modal-period {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px; color: #475569; background: #F8FAFC; padding: 4px 12px; border-radius: 6px;
}
.modal-period svg { width: 14px; height: 14px; color: #E11D48; }
.modal-warn { font-size: 11px; color: #F59E0B; margin-top: 10px; }
.modal-upgrade {
  display: flex; align-items: center; justify-content: center; gap: 5px;
  margin-top: 10px; padding: 8px 14px; border-radius: 8px; cursor: pointer;
  background: #EFF6FF; border: 1px solid #93C5FD; color: #2563EB;
  font-size: 12px; font-weight: 500; transition: all 0.15s;
}
.modal-upgrade:hover { background: #DBEAFE; }
.modal-upgrade svg { width: 14px; height: 14px; flex-shrink: 0; }
.modal-actions { display: flex; gap: 10px; margin-top: 20px; }
.modal-btn {
  flex: 1; padding: 10px 0; border: none; border-radius: 9px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.15s;
}
.modal-btn.cancel { background: #F1F5F9; color: #475569; }
.modal-btn.cancel:hover { background: #E2E8F0; }
.modal-btn.ok { background: #E11D48; color: white; box-shadow: 0 2px 8px rgba(225,29,72,0.25); }
.modal-btn.ok:hover { background: #BE123C; }

@media (max-width: 640px) {
  .container { padding: 14px 12px 32px; }
  .chart-wrap { height: 260px; }
  .action-row { flex-direction: column; }
  .period-row { gap: 4px; }
  .period-btn { padding: 6px 0; font-size: 12px; }
  .batch-area { flex-direction: column; }
  .batch-btn { width: 100%; justify-content: center; padding: 10px; }
  .ai-btn { max-width: 180px; width: 100%; }
  .pf-nodes { gap: 4px; }
  .pf-node { min-width: 48px; }
  .pf-node-inner { padding: 6px 2px 5px; }
  .pf-node-avatar { width: 8px; height: 8px; }
  .pf-node-label { font-size: 9px; }
  .pf-phase-head { gap: 8px; }
  .pf-phase-icon { width: 30px; height: 30px; border-radius: 8px; }
  .pf-phase-icon svg { width: 15px; height: 15px; }
  .pf-phase-name { font-size: 12px; }
  .pf-phase-step { font-size: 10px; }
  .stock-info-panel { margin: 8px 12px 0; }
  .sip-row { padding: 10px 14px; gap: 4px; flex-wrap: wrap; }
  .sip-left { gap: 6px; flex-wrap: wrap; }
  .sip-name { font-size: 14px; }
  .sip-price { font-size: 20px; }
  .sip-change { font-size: 12px; }
  .sip-details { padding: 0 14px 10px; padding-top: 8px; gap: 0; }
  .running-content { margin: 12px 12px 16px; padding: 14px 16px; }
  .agent-report-expanded { margin: 0 12px 16px; padding: 14px 16px; }
}

/* Stock Analysis */
.stock-info-panel {
  position: relative;
  margin: 10px 18px 0; border-radius: 12px;
  background: linear-gradient(135deg, #FFFBFB 0%, #FFF1F2 55%, #FFE4E6 100%);
  border: 1px solid #FDA4AF;
  box-shadow: 0 2px 12px rgba(225,29,72,0.06);
}
.sip-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 18px;
}
.sip-left { display: flex; align-items: center; gap: 8px; }
.sip-name { font-size: 16px; font-weight: 700; color: #9F1239; }
.sip-code { font-size: 11px; color: #E11D48; background: white; padding: 2px 8px; border-radius: 5px; font-weight: 700; }
.sip-industry { font-size: 11px; color: #9F1239; background: #FFe4E6; padding: 2px 8px; border-radius: 5px; }
.sip-right { display: flex; align-items: baseline; gap: 8px; }
.sip-price { font-size: 24px; font-weight: 800; color: #9F1239; letter-spacing: -0.02em; }
.sip-change { font-size: 14px; font-weight: 700; }
.sip-change.up { color: #DC2626; }
.sip-change.down { color: #2563EB; }
.sip-details {
  display: flex; gap: 2px; padding: 0 18px 14px;
  border-top: 1px solid rgba(251,113,133,0.15);
  margin-top: 0; padding-top: 12px;
}
.sip-item {
  flex: 1; text-align: center; padding: 0 8px;
  border-right: 1px solid rgba(251,113,133,0.15);
}
.sip-item:last-of-type { border-right: none; }
.sip-item-label { display: block; font-size: 10px; color: #94A3B8; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.03em; }
.sip-item-value { display: block; font-size: 14px; font-weight: 700; color: #0F172A; }

/* PE/PB help trigger + popover */
.sip-help-trigger {
  flex: 0 0 auto; align-self: center; margin-left: 2px;
  width: 22px; height: 22px; padding: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(159,18,57,0.08); border: none; border-radius: 50%;
  color: #BE123C; cursor: pointer; transition: all 0.15s;
}
.sip-help-trigger:hover { background: rgba(159,18,57,0.18); }
.sip-help-trigger.active { background: #9F1239; color: #fff; }
.sip-help-trigger svg { width: 14px; height: 14px; display: block; }
.sip-help-backdrop { position: fixed; inset: 0; z-index: 998; background: transparent; }
.sip-help-popover {
  position: absolute; right: 10px; top: calc(100% + 8px); z-index: 999;
  width: 290px; max-width: calc(100vw - 36px);
  background: #fff; border: 1px solid #E2E8F0; border-radius: 12px;
  box-shadow: 0 12px 32px rgba(15,23,42,0.18);
  padding: 14px 14px 12px; font-size: 12px; color: #334155;
  animation: sipPopIn 0.16s ease-out;
}
@keyframes sipPopIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
.sphp-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-weight: 700; color: #0F172A; font-size: 13px; }
.sphp-close { background: none; border: none; color: #94A3B8; cursor: pointer; font-size: 13px; line-height: 1; padding: 2px; }
.sphp-close:hover { color: #475569; }
.sphp-section { margin-bottom: 10px; }
.sphp-section:last-of-type { margin-bottom: 8px; }
.sphp-title { font-weight: 600; color: #9F1239; margin-bottom: 6px; font-size: 12px; }
.sphp-row { display: flex; align-items: baseline; gap: 8px; padding: 2px 0; }
.sphp-range { flex: 0 0 58px; font-weight: 700; color: #2563EB; font-variant-numeric: tabular-nums; }
.sphp-desc { color: #475569; line-height: 1.4; }
.sphp-tip { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #E2E8F0; font-size: 11px; color: #94A3B8; line-height: 1.5; }

/* Pipeline Flow */
.pipeline-flow { padding: 20px 18px 16px; }

.pf-phase {
  background: linear-gradient(135deg, #FAFBFC 0%, #F1F5F9 100%); border: 1px solid #CBD5E1; border-radius: 14px;
  padding: 14px 16px 16px; transition: all 0.3s; position: relative; overflow: hidden;
}
.pf-phase::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: var(--pf-accent, #CBD5E1); opacity: 0.6; transition: opacity 0.3s;
}
.pf-phase.active { border-color: var(--pf-accent, #FECDD3); background: linear-gradient(135deg, #FFFBFB, #FFF5F5); box-shadow: 0 2px 16px color-mix(in srgb, var(--pf-accent, #E11D48) 12%, transparent); }
.pf-phase.active::before { opacity: 1; }

.pf-phase-analyst { --pf-accent: #3B82F6; }
.pf-phase-debate  { --pf-accent: #8B5CF6; }
.pf-phase-trade   { --pf-accent: #10B981; }
.pf-phase-risk    { --pf-accent: #F59E0B; }

.pf-phase-head {
  display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
}
.pf-phase-icon {
  width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--pf-accent, #94A3B8) 15%, transparent);
  color: var(--pf-accent, #64748B);
}
.pf-phase-icon svg { width: 18px; height: 18px; }

.pf-phase-title { flex: 1; }
.pf-phase-name { display: block; font-size: 13px; font-weight: 700; color: #1E293B; }
.pf-phase-desc { display: block; font-size: 10px; color: #94A3B8; margin-top: 2px; }
.pf-phase-step {
  font-size: 11px; font-weight: 800; color: var(--pf-accent, #94A3B8);
  opacity: 0.35; letter-spacing: 0.05em; font-family: 'SF Mono', 'Fira Code', monospace;
}

.pf-nodes { display: flex; gap: 10px; flex-wrap: wrap; }

.pf-node {
  flex: 1; min-width: 62px; cursor: pointer;
}
.pf-node-inner {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;
  padding: 10px 4px 8px; border-radius: 10px;
  border: 1px solid #94A3B8;
  background: linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%);
  transition: all 0.25s; position: relative;
}
.pf-node:hover .pf-node-inner { border-color: color-mix(in srgb, var(--pf-accent, #94A3B8) 45%, #CBD5E1); box-shadow: 0 4px 14px color-mix(in srgb, var(--pf-accent, #94A3B8) 14%, transparent); transform: translateY(-1px); }

.pf-node-avatar {
  width: 10px; height: 10px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700;
  color: var(--pf-accent, #64748B);
  background: color-mix(in srgb, var(--pf-accent, #94A3B8) 15%, #F8FAFC);
  transition: all 0.25s;
}
.pf-node-label { font-size: 10px; font-weight: 500; color: #64748B; text-align: center; line-height: 1.2; }

.pf-status-dot {
  width: 6px; height: 6px; border-radius: 50%; background: #D0D9E4;
  transition: all 0.3s; position: absolute; top: 8px; right: 8px;
}

/* Bull/Bear special colors */
.pf-bull .pf-node-avatar { background: #DBEAFE; color: #1E40AF; }
.pf-bear .pf-node-avatar { background: #FEE2E2; color: #991B1B; }
.pf-final .pf-node-avatar { background: linear-gradient(135deg, #FEF3C7, #FDE68A); color: #92400E; }

/* Status: running */
.pf-node.running .pf-node-inner { border-color: #E11D48; background: linear-gradient(135deg, #FFFBFB, #FFF5F5); box-shadow: 0 2px 16px rgba(225,29,72,0.1); }
.pf-node.running .pf-node-avatar { background: linear-gradient(135deg, #E11D48, #F43F5E); color: white; animation: pfAvatarPulse 1.5s ease-in-out infinite; }
.pf-node.running .pf-status-dot { display: none; }
.pf-node.running .pf-node-label { color: #BE123C; font-weight: 700; }

/* Status: done */
.pf-node.done .pf-node-inner { border-color: #F59E0B; background: linear-gradient(135deg, #FFFBEB, #FEF3C7); box-shadow: 0 2px 12px rgba(245,158,11,0.1); }
.pf-node.done .pf-node-avatar {
  width: 14px; height: 14px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'/%3E%3C/svg%3E") no-repeat center / 9px, linear-gradient(135deg, #22C55E, #16A34A);
  color: transparent;
}
.pf-node.done .pf-status-dot { display: none; }
.pf-node.done .pf-node-label { font-weight: 600; color: #92400E; }

/* Status: error */
.pf-node.error .pf-node-inner { border-color: #EF4444; background: #FEF2F2; }
.pf-node.error .pf-node-avatar { background: #FEE2E2; color: #DC2626; }
.pf-node.error .pf-status-dot { background: #EF4444; }

@keyframes pfPulse {
  0% { box-shadow: 0 0 0 0 rgba(225,29,72,0.5); }
  100% { box-shadow: 0 0 0 6px rgba(225,29,72,0); }
}
@keyframes pfAvatarPulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(225,29,72,0.4); }
  50% { transform: scale(1.4); box-shadow: 0 0 0 4px rgba(225,29,72,0); }
}

/* Connector between phases */
.pf-connector {
  display: flex; flex-direction: column; align-items: center;
  padding: 4px 0; height: 28px;
}
.pf-connector-line {
  width: 2px; height: 14px; background: #CBD5E1; border-radius: 1px;
  transition: all 0.4s; position: relative; overflow: hidden;
}
.pf-connector-arrow {
  width: 18px; height: 18px; color: #94A3B8; margin-top: -4px;
  transition: all 0.4s;
}
.pf-connector.done .pf-connector-line {
  background: linear-gradient(180deg, #34D399, #10B981);
}
.pf-connector.done .pf-connector-arrow {
  color: #10B981;
}
.pf-connector.done .pf-connector-line::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(180deg, transparent, rgba(255,255,255,0.5), transparent);
  animation: connectorFlow 1.5s linear infinite;
}
@keyframes connectorFlow {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100%); }
}

/* Running content */
.running-content {
  margin: 16px 18px 20px; padding: 18px 22px;
  background: linear-gradient(135deg, #FFFBFB 0%, #FFF5F5 55%, #FFF1F2 100%);
  border: 1px solid #FDA4AF; border-radius: 14px;
  position: relative; overflow: hidden;
}
.running-content::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: linear-gradient(180deg, #E11D48, #F43F5E);
}
.running-header {
  font-size: 12px; font-weight: 700; color: #9F1239; margin-bottom: 8px;
  display: flex; align-items: center; gap: 6px;
}
.running-spinner {
  width: 12px; height: 12px; border: 2px solid rgba(225,29,72,0.15);
  border-top-color: #E11D48; border-radius: 50%; animation: spin 0.7s linear infinite;
}
.running-text {
  font-size: 12px; color: #64748B; line-height: 1.7;
  height: 220px; overflow: hidden; white-space: pre-wrap;
}

/* Agent report expanded */
.agent-report-expanded {
  margin: 0 18px 20px; padding: 18px 22px;
  background: linear-gradient(180deg, #FFFFFF 0%, #FFFCFD 100%);
  border: 1px solid #FDA4AF; border-radius: 14px;
  max-height: 400px; overflow-y: auto; position: relative;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
.pf-close-btn {
  float: right; background: #F1F5F9; border: none; border-radius: 6px;
  width: 24px; height: 24px; cursor: pointer; color: #64748B;
  font-size: 12px; display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.pf-close-btn:hover { background: #E2E8F0; color: #334155; }

.decision-badge {
  margin-left: auto; padding: 3px 12px; border-radius: 6px;
  font-size: 11px; font-weight: 800; letter-spacing: 0.05em;
}
.decision-badge.buy { background: #DBEAFE; color: #1E40AF; }
.decision-badge.sell { background: #FEE2E2; color: #991B1B; }
.decision-badge.hold { background: #FEF3C7; color: #92400E; }

.decision-card { border: 2px solid #E11D48; overflow: hidden; background: white; }
.decision-card.buy { border-color: #E11D48; }
.decision-card.sell { border-color: #E11D48; }
.decision-card.hold { border-color: #E11D48; }
.decision-top {
  display: flex; align-items: center; gap: 14px; padding: 18px 20px;
  background: linear-gradient(135deg, rgba(255,241,242,0.6), transparent);
}
.decision-card.buy .decision-top { background: linear-gradient(135deg, #FFF1F2, rgba(254,205,211,0.3)); }
.decision-card.sell .decision-top { background: linear-gradient(135deg, #FFF1F2, rgba(254,205,211,0.3)); }
.decision-card.hold .decision-top { background: linear-gradient(135deg, #FFF1F2, rgba(254,205,211,0.3)); }
.decision-icon-wrap {
  width: 52px; height: 52px; border-radius: 14px; display: flex;
  align-items: center; justify-content: center; flex-shrink: 0;
}
.buy .decision-icon-wrap { background: linear-gradient(135deg, #DBEAFE, #BFDBFE); }
.sell .decision-icon-wrap { background: linear-gradient(135deg, #FEE2E2, #FECACA); }
.hold .decision-icon-wrap { background: linear-gradient(135deg, #FEF3C7, #FDE68A); }
.decision-icon-text { font-size: 24px; }
.buy .decision-icon-text { color: #2563EB; }
.sell .decision-icon-text { color: #DC2626; }
.hold .decision-icon-text { color: #D97706; }
.decision-info { flex: 1; }
.decision-title { font-size: 16px; font-weight: 800; color: #0F172A; letter-spacing: -0.01em; }
.decision-sub { font-size: 12px; color: #64748B; margin-top: 3px; }
.decision-body { padding: 0 20px 18px; }
.decision-actions { padding: 0 20px 16px; display: flex; justify-content: flex-end; }

.report-link-card { border: 1px solid #BFDBFE; background: linear-gradient(135deg, #EFF6FF, #F0F9FF); }
.report-link-content { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; gap: 12px; flex-wrap: wrap; }
.report-link-info { display: flex; align-items: center; gap: 12px; }
.report-link-icon { width: 32px; height: 32px; color: #2563EB; flex-shrink: 0; background: #DBEAFE; border-radius: 8px; padding: 4px; }
.report-link-title { font-size: 14px; font-weight: 700; color: #1E40AF; }
.report-link-sub { font-size: 11px; color: #64748B; margin-top: 2px; }
.report-link-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 18px; border-radius: 10px; text-decoration: none;
  background: linear-gradient(135deg, #2563EB, #3B82F6); color: white;
  font-size: 13px; font-weight: 600; transition: all 0.2s; white-space: nowrap;
  box-shadow: 0 2px 8px rgba(37,99,235,0.2);
}
.report-link-btn:hover { box-shadow: 0 4px 14px rgba(37,99,235,0.3); transform: translateY(-1px); }
.report-link-btn svg { width: 14px; height: 14px; }
</style>
