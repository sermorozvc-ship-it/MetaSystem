// Скрипт для проверки пользователей
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

async function checkUsers() {
  console.log('🔍 Проверяем пользователей...\n')

  // Получаем всех пользователей
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ Ошибка:', error)
    return
  }

  console.log(`👥 Всего пользователей: ${profiles.length}\n`)

  if (profiles.length === 0) {
    console.log('⚠️  Пользователей нет в базе!')
    return
  }

  console.log('📊 Список пользователей:')
  console.log('─'.repeat(100))
  
  for (const profile of profiles) {
    console.log(`\n📧 Email: ${profile.email}`)
    console.log(`   ID: ${profile.id}`)
    console.log(`   Роль: ${profile.role}`)
    console.log(`   Анкета заполнена: ${profile.questionnaire_completed ? '✅ Да' : '❌ Нет'}`)
    console.log(`   Создан: ${new Date(profile.created_at).toLocaleString('ru-RU')}`)

    // Проверяем оплату
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (payment) {
      console.log(`   💳 Оплата: ${payment.status} (${payment.amount} ₽)`)
    } else {
      console.log(`   💳 Оплата: нет`)
    }

    // Проверяем анкету
    const { data: questionnaire } = await supabase
      .from('client_questionnaires')
      .select('id, age, gender, goal')
      .eq('user_id', profile.id)
      .maybeSingle()

    if (questionnaire) {
      console.log(`   📋 Анкета: ✅ Заполнена (возраст: ${questionnaire.age}, пол: ${questionnaire.gender})`)
    } else {
      console.log(`   📋 Анкета: ❌ Не заполнена`)
    }
  }

  console.log('\n' + '─'.repeat(100))
}

checkUsers().catch(console.error)
