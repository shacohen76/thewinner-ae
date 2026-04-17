@echo off
REM =============================================================================
REM KSP Commission to Sheets v2.8 - DRY-RUN Test
REM =============================================================================
REM Created: 2026-04-08 23:20
REM Purpose: Safe test of v2.8 (Task 7.B aggregation) - no sheet writes
REM =============================================================================

cd /d "C:\Users\shaco\(ILNET~1.COM\KSP_AFF"

call .venv1\Scripts\activate.bat

python ksp_commission_to_sheets_v2_8.py --dry-run

pause