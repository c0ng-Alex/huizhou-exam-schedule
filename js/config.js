/* ============================================================
   配置说明：
   1. 未填写 SUPABASE_URL / SUPABASE_ANON_KEY 时，系统自动进入「本地演示模式」，
      数据只存在本机浏览器，适合先试用界面。
   2. 填写后即为正式多人协作版本，所有账号、日程存储在 Supabase 云端。
      Supabase 控制台 → Project Settings → API 里可找到这两个值。
   3. INVITE_CODE 是注册邀请码，防止外单位人员随意注册。
   ============================================================ */
window.APP_CONFIG = {
  SUPABASE_URL: 'https://rkvxchoummkjcfwsiaet.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrdnhjaG91bW1ramNmd3NpYWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNDAzNzQsImV4cCI6MjEwODkxNjM3NH0.X-pkScVrolCvFAYvgxdIcSurQuBPR6XVjDM0afh1Fjw',
  INVITE_CODE: 'HZKS2026',
  ORG_NAME: '惠州市考试中心'
};
