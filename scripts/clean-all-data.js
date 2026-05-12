// Полная очистка всех данных
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

async function cleanAll() {
  console.log('🧹 Полная очистка базы данных...\n')

  // Сначала удаляем все записи из journal_entries
  console.log('1️⃣ Удаляем journal_entries...')
  const { error: journalError } = await supabase
    .from('journal_entries')
    .delete()
    .neq('id', 0) // Удаляем все

  if (journalError) {
    console.log(`   ❌ Ошибка: ${journalError.message}`)
  } else {
    console.log(`   ✅ Очищена`)
  }

  // Удаляем admin_messages
  console.log('2️⃣ Удаляем admin_messages...')
  const { error: adminMsgError } = await supabase
    .from('admin_messages')
    .delete()
    .neq('id', 0)

  if (adminMsgError) {
    console.log(`   ❌ Ошибка: ${adminMsgError.message}`)
  } else {
    console.log(`   ✅ Очищена`)
  }

  // Теперь пытаемся удалить пользователей
  console.log('\n3️⃣ Удаляем пользователей...')
  
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email')

  if (!profiles || profiles.length === 0) {
    console.log('   ✅ Пользователей нет')
  } else {
    for (const profile of profiles) {
      console.log(`   Удаляем ${profile.email}...`)

      // Сначала удаляем из profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profile.id)

      if (profileError) {
        console.log(`   ❌ Ошибка profiles: ${profileError.message}`)
      } else {
        console.log(`   ✅ Удален из profiles`)
      }

      // Потом из auth
      try {
        await supabase.auth.admin.deleteUser(profile.id)
        console.log(`   ✅ Удален из auth`)
      } catch (e) {
        console.log(`   ⚠️  Auth: ${e.message}`)
      }
    }
  }

  // Финальная проверка
  console.log('\n🔍 Финальная проверка...\n')
  
  const { data: remaining } = await supabase
    .from('profiles')
    .select('id, email')

  if (remaining && remaining.length > 0) {
    console.log(`⚠️  Осталось пользователей: ${remaining.length}`)
    remaining.forEach(p => console.log(`   - ${p.email} (${p.id})`))
  } else {
    console.log('✅ Все пользователи удалены!')
  }

  console.log('\n✅ База данных очищена! Можно начинать с нуля.')
}

cleanAll().catch(console.error)
