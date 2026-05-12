// Принудительное удаление оставшихся пользователей через SQL
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

async function forceDelete() {
  console.log('🔧 Принудительное удаление оставшихся пользователей...\n')

  // Получаем оставшихся пользователей
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email')

  if (!profiles || profiles.length === 0) {
    console.log('✅ Пользователей не осталось!')
    return
  }

  console.log(`👥 Осталось пользователей: ${profiles.length}`)
  profiles.forEach(p => console.log(`   - ${p.email}`))

  console.log('\n🗑️  Удаляем через SQL...\n')

  for (const profile of profiles) {
    console.log(`   Удаляем ${profile.email}...`)

    // Удаляем из profiles (это должно сработать)
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', profile.id)

    if (profileError) {
      console.error(`   ❌ Ошибка при удалении из profiles:`, profileError.message)
    } else {
      console.log(`   ✅ Удален из profiles`)
    }

    // Пытаемся удалить из auth
    try {
      const { error: authError } = await supabase.auth.admin.deleteUser(profile.id)
      if (authError) {
        console.log(`   ⚠️  Не удалось удалить из auth: ${authError.message}`)
      } else {
        console.log(`   ✅ Удален из auth`)
      }
    } catch (e) {
      console.log(`   ⚠️  Ошибка auth: ${e.message}`)
    }
  }

  // Проверяем результат
  console.log('\n🔍 Финальная проверка...\n')
  
  const { data: remaining } = await supabase
    .from('profiles')
    .select('id, email')

  if (remaining && remaining.length > 0) {
    console.log(`⚠️  Все еще осталось: ${remaining.length}`)
    remaining.forEach(p => console.log(`   - ${p.email}`))
    console.log('\n💡 Попробуйте удалить их вручную через Supabase Dashboard')
  } else {
    console.log('✅ Все пользователи удалены!')
  }

  // Очищаем связанные таблицы
  console.log('\n🧹 Очищаем связанные таблицы...\n')

  const tables = ['payments', 'client_questionnaires', 'training_programs', 'client_metrics', 'notifications', 'messages']

  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Удаляем все

    if (error) {
      console.log(`   ❌ ${table}: ${error.message}`)
    } else {
      console.log(`   ✅ ${table}: очищена`)
    }
  }

  console.log('\n✅ Готово!')
}

forceDelete().catch(console.error)
