// Скрипт для удаления всех пользователей
// ВНИМАНИЕ: Это удалит ВСЕ данные пользователей!
const { createClient } = require('@supabase/supabase-js')
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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

async function deleteAllUsers() {
  console.log('⚠️  ВНИМАНИЕ: Это удалит ВСЕ данные пользователей!\n')

  // Получаем всех пользователей
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, role')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ Ошибка при получении пользователей:', error)
    return
  }

  console.log(`👥 Найдено пользователей: ${profiles.length}\n`)

  if (profiles.length === 0) {
    console.log('✅ База уже пуста!')
    return
  }

  console.log('📋 Список пользователей для удаления:')
  console.log('─'.repeat(80))
  profiles.forEach(p => {
    console.log(`   ${p.email} (${p.role})`)
  })
  console.log('─'.repeat(80))

  console.log('\n🗑️  Удаляем пользователей...\n')

  let deleted = 0
  let errors = 0

  for (const profile of profiles) {
    try {
      console.log(`   Удаляем ${profile.email}...`)

      // Удаляем из auth.users (это автоматически удалит из profiles через CASCADE)
      const { error: authError } = await supabase.auth.admin.deleteUser(profile.id)

      if (authError) {
        console.error(`   ❌ Ошибка при удалении ${profile.email}:`, authError.message)
        errors++
      } else {
        console.log(`   ✅ Удален ${profile.email}`)
        deleted++
      }
    } catch (e) {
      console.error(`   ❌ Ошибка:`, e.message)
      errors++
    }
  }

  console.log('\n' + '─'.repeat(80))
  console.log(`\n✅ Удалено: ${deleted}`)
  console.log(`❌ Ошибок: ${errors}`)

  // Проверяем результат
  console.log('\n🔍 Проверяем результат...\n')
  
  const { data: remaining } = await supabase
    .from('profiles')
    .select('id, email')

  if (remaining && remaining.length > 0) {
    console.log(`⚠️  Осталось пользователей: ${remaining.length}`)
    remaining.forEach(p => console.log(`   - ${p.email}`))
  } else {
    console.log('✅ База полностью очищена!')
  }

  console.log('\n📊 Проверяем связанные таблицы...\n')

  // Проверяем другие таблицы
  const tables = [
    'client_questionnaires',
    'payments',
    'training_programs',
    'client_metrics',
    'notifications',
    'messages'
  ]

  for (const table of tables) {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
    
    console.log(`   ${table}: ${count || 0} записей`)
  }

  console.log('\n✅ Готово! Теперь можно начать с чистой базы.')
}

deleteAllUsers().catch(console.error)
