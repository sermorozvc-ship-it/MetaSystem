// Скрипт для исправления флага questionnaire_completed
// Запуск: node scripts/fix-questionnaire-flag.js

const { createClient } = require('@supabase/supabase-js')

// Читаем .env.local вручную
const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')

const env = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) {
    const key = match[1].trim()
    const value = match[2].trim()
    env[key] = value
  }
})

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Ошибка: не найдены переменные окружения SUPABASE')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkAndFix() {
  console.log('🔍 Проверяем базу данных...\n')

  // 1. Получаем всех пользователей с анкетами
  const { data: questionnaires, error: qError } = await supabase
    .from('client_questionnaires')
    .select('user_id')

  if (qError) {
    console.error('❌ Ошибка при получении анкет:', qError)
    return
  }

  console.log(`📋 Найдено анкет: ${questionnaires.length}`)

  // 2. Получаем профили этих пользователей
  const userIds = questionnaires.map(q => q.user_id)
  
  const { data: profiles, error: pError } = await supabase
    .from('profiles')
    .select('id, email, questionnaire_completed')
    .in('id', userIds)

  if (pError) {
    console.error('❌ Ошибка при получении профилей:', pError)
    return
  }

  console.log('\n📊 Статус пользователей:')
  console.log('─'.repeat(80))
  
  let needsUpdate = 0
  profiles.forEach(profile => {
    const status = profile.questionnaire_completed ? '✅' : '❌'
    console.log(`${status} ${profile.email} - questionnaire_completed: ${profile.questionnaire_completed}`)
    if (!profile.questionnaire_completed) {
      needsUpdate++
    }
  })

  console.log('─'.repeat(80))
  console.log(`\n⚠️  Нужно обновить: ${needsUpdate} профилей\n`)

  if (needsUpdate === 0) {
    console.log('✅ Все профили уже исправлены!')
    return
  }

  // 3. Обновляем флаг для всех пользователей с анкетами
  console.log('🔧 Исправляем флаги...')
  
  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update({ questionnaire_completed: true })
    .in('id', userIds)
    .eq('questionnaire_completed', false)
    .select()

  if (updateError) {
    console.error('❌ Ошибка при обновлении:', updateError)
    return
  }

  console.log(`✅ Обновлено профилей: ${updated?.length || 0}`)

  // 4. Проверяем результат
  console.log('\n🔍 Проверяем результат...\n')
  
  const { data: finalProfiles } = await supabase
    .from('profiles')
    .select('id, email, questionnaire_completed')
    .in('id', userIds)

  console.log('📊 Финальный статус:')
  console.log('─'.repeat(80))
  
  finalProfiles.forEach(profile => {
    const status = profile.questionnaire_completed ? '✅' : '❌'
    console.log(`${status} ${profile.email} - questionnaire_completed: ${profile.questionnaire_completed}`)
  })
  
  console.log('─'.repeat(80))
  console.log('\n✅ Готово! Теперь перезапустите dev сервер и очистите кеш браузера.')
}

checkAndFix().catch(console.error)
