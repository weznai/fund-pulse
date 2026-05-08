-- Migration: Add data_source column to fund_info table
-- Date: 2026-05-07
-- Description: 标记互认基金(968xxx等)使用天天基金移动端API获取确认净值
--   data_source = 'standard'      : 标准基金，走东方财富历史净值接口
--   data_source = 'estimate_only'  : 互认基金等，走fundmobapi获取确认净值

ALTER TABLE fund_info ADD COLUMN data_source VARCHAR(20) DEFAULT 'standard';

UPDATE fund_info SET data_source = 'estimate_only' WHERE code IN ('968049', '968162');
