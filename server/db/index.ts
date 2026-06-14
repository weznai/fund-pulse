export { default } from './connection.js'
export { getLocalDate, initDatabase, closeDatabase, getCurrentUserId as getUserId } from './connection.js'
export { UserIdType, userContext, generateSessionId, getCurrentUserId, getUserIdFromClientId, setCurrentUserId, setRegisteredUser, setGuestUser } from './connection.js'
export type { UserId } from './connection.js'

export { getFundCache, saveFundCache, getCacheStats, clearAllCache, saveGlobalEstimateCache, getGlobalEstimateCache, getGlobalEstimateCodes, saveGlobalEstimateCacheBatch, getGlobalCacheStats, getLatestGlobalEstimateCache, hasFinalGrowth, getFinalGrowthData, updateFinalGrowth, updateSettlementStatus, resetFundTodayStatus, saveStockTimeTrend, getStockTimeTrend, getLatestStockTimeTrend, isNavDateAlreadySettled } from './cache.js'
export type { FundCacheData, TimeTrendData, TimeTrendCacheData, StockTimeTrendData, StockTimeTrendCacheData } from './cache.js'

export { getUserPreferences, saveUserPreferences } from './preferences.js'
export type { UserPreferences } from './preferences.js'

export { getHoldings, saveHolding, deleteHolding, saveHoldingsBatch, updateHoldingCurrentProfit, settleHoldingProfit, reSettleHoldingForToday, isHoldingSettledToday, getHoldingRawAmount, getHoldingProfitHistory, getHoldingProfitStats, getAllProfitHistory, getHeldFundTotalAmount, hasFundDataForDate, initDailySettlement, getUnsettledHoldings, executeBatchSettlement, executeBatchSettlementFromDb, getUserFunds, getHeldFunds, getFavoriteFunds, addUserFund, deleteUserFund, setHolding, removeHolding, updateUserFund, addUserFundsBatch, isFundInUserList, isFundHeld, getAllUserFundCodes, checkAndImportDefaultFunds, getTransactions, getHoldingCostInfo, migrateExistingHoldings } from './userFund.js'
export type { Holding, HoldingProfitHistory, UserFund, SaveHoldingResult, Transaction } from './userFund.js'

export { saveOtp, verifyOtp, cleanExpiredOtps } from './auth.js'
export type { EmailOtp } from './auth.js'

export { isUsernameExists, isEmailExists, getUserByUsername, getUserByEmail, getUserByUsernameOrEmail, createUser, verifyUserEmail, updateUserLastActive, updateUserPassword, isUserLabelExists, updateUserLabel, setUserDisabled, getUserById, fixUsersDataIntegrity, getAllUsers, switchUser, getUserByOpenId, createWechatUser, bindWechatOpenId } from './user.js'
export type { RegisterUser } from './user.js'

export { ensureVisitLogsTable, logVisit, getVisitStats, getDailyVisitStats, migrateStatsToDatabase, cleanExpiredVisitLogs, deleteVisitLogsByIps, deleteVisitLogsByUserIds, getVisitLogs, getIpStats } from './visitLog.js'
export type { ReqSource as DbReqSource, VisitLog, VisitStats, VisitLogFromDb, VisitLogListResult, IpStat } from './visitLog.js'

export { getSystemParam, setSystemParam, deleteSystemParam, getAllSystemParams, setSystemParams } from './systemParam.js'
export type { SystemParam } from './systemParam.js'

export { getFundInfo, getFundInfoList, saveFundInfo, updateFundInfoField, updateFundInfoRecommend, getRecommendFundCodes, deleteFundInfo, batchSaveFundInfo, getAllFundInfoCodes } from './fundInfo.js'
export type { FundInfo, FundInfoListResult } from './fundInfo.js'

export { getDailyProfit, getDailyProfitByDateRange, getLatestDailyProfit, upsertDailyProfitTimeshare, updateDailyProfitFinal, getDailyProfitSummaries } from './userDailyProfit.js'
export type { TimeProfitPoint, UserDailyProfit, DailyProfitSummary } from './userDailyProfit.js'

export { ensureTasksTable, createTask, getTask, getActiveTask, updateTask, incrementTaskExecuteCount, getTaskList, getTaskById } from './task.js'
export type { Task, TaskType, TaskStatus } from './task.js'

export { ensureSuggestionsTable, createSuggestion, updateSuggestionSummary, updateSuggestionStatus, getSuggestionById, getSuggestionList, getAdminSuggestionList } from './suggestion.js'
export type { Suggestion, SuggestionListResult } from './suggestion.js'

export { getSystemInfo, updateSystemTradingDays, getTradingDay } from './system.js'
export type { SystemInfo } from './system.js'

export { getLatestNavDate, getNavHistoryRange, getNavCount, saveNavHistoryBatch } from './navHistory.js'
export type { NavHistoryRecord } from './navHistory.js'

export { ensureAnalysisUsageTable, getAnalysisUsage, incrementAnalysisUsage } from './analysisUsage.js'
export type { AnalysisUsageRecord } from './analysisUsage.js'

export { ensureOperationLogTable, addOperationLog, getOperationLogList } from './operationLog.js'
export type { OperationLog, OperationLogListResult, OperationLogQuery } from './operationLog.js'

export {
  ensureModelConfigTable,
  getProviders, getProviderById, getProviderByName, addProvider, updateProvider, deleteProvider,
  getModelsByProvider, getAllModels, addModel, updateModel, deleteModel,
  getSceneMappings, setSceneMapping,
  getLLMConfigForScene, getFallbackLLMConfig
} from './modelConfig.js'
export type { ModelProvider, ModelItem, ModelSceneMapping, LLMRuntimeConfig } from './modelConfig.js'

// Repository 模式 - 数据访问层
export { 
  BaseRepository,
  UserRepository, 
  UserFundRepository, 
  FundInfoRepository,
  userRepository, 
  userFundRepository, 
  fundInfoRepository 
} from './repositories.js'
