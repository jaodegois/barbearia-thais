export interface Settings {
  id: string
  shop_name: string
  shop_logo_url: string | null
  shop_address: string | null
  whatsapp_link: string | null
  admin_password: string
  created_at: string
  updated_at: string
}

export interface Service {
  id: string
  name: string
  price: number
  duration_minutes: number
  is_active: boolean
  created_at: string
}

export interface Barber {
  id: string
  name: string
  photo_url: string | null
  is_active: boolean
  created_at: string
}

export interface BarberSchedule {
  id: string
  barber_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_working: boolean
}

export interface Customer {
  id: string
  name: string
  phone: string
  total_spent: number
  created_at: string
}

export interface Appointment {
  id: string
  customer_id: string
  barber_id: string
  appointment_date: string
  appointment_time: string
  status: 'pending' | 'completed' | 'cancelled'
  total_price: number
  payment_method: 'credit' | 'debit' | 'cash' | 'pix' | null
  created_at: string
  completed_at: string | null
  customer?: Customer
  barber?: Barber
  services?: AppointmentService[]
}

export interface AppointmentService {
  id: string
  appointment_id: string
  service_id: string
  price_at_time: number
  service?: Service
}

export interface CartItem {
  service: Service
  quantity: number
}
