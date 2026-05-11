import { createClient } from '@/lib/supabase/server'
import { ClientBookingPage } from '@/components/client-booking-page'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createClient()
  
  const [settingsRes, servicesRes, barbersRes] = await Promise.all([
    supabase.from('settings').select('*').limit(1).single(),
    supabase.from('services').select('*').eq('is_active', true).order('name'),
    supabase.from('barbers').select('*').eq('is_active', true).order('name')
  ])

  const settings = settingsRes.data
  const services = servicesRes.data || []
  const barbers = barbersRes.data || []

  return (
    <ClientBookingPage 
      settings={settings}
      services={services}
      barbers={barbers}
    />
  )
}
