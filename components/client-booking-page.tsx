'use client'

import { useState, useEffect } from 'react'
import { Settings, Service, Barber, BarberSchedule, CartItem } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { validateName, validatePhone, formatPhone, formatCurrency } from '@/lib/validation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Scissors, 
  Star, 
  MessageCircle, 
  MapPin, 
  Calendar,
  Clock,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  X,
  Check,
  User,
  CreditCard,
  Banknote,
  Smartphone
} from 'lucide-react'
import { format, addDays, isSameDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Props {
  settings: Settings | null
  services: Service[]
  barbers: Barber[]
}

type Step = 'services' | 'barber' | 'date' | 'time' | 'confirm'

export function ClientBookingPage({ settings, services, barbers }: Props) {
  const [step, setStep] = useState<Step>('services')
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [availableTimes, setAvailableTimes] = useState<string[]>([])
  const [barberSchedules, setBarberSchedules] = useState<BarberSchedule[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCart, setShowCart] = useState(false)
  
  const supabase = createClient()

  // ✅ Nome fixo — não usa mais settings.shop_name nem fallback "BarberFlow"
  const shopName = 'Thais du Corte'
  const shopLogo = settings?.shop_logo_url
  const shopAddress = settings?.shop_address
  const whatsappLink = settings?.whatsapp_link

  const cartTotal = cart.reduce((sum, item) => sum + (item.service.price * item.quantity), 0)

  useEffect(() => {
    if (selectedBarber) loadBarberSchedules(selectedBarber.id)
  }, [selectedBarber])

  useEffect(() => {
    if (selectedBarber && selectedDate) loadAvailableTimes()
  }, [selectedBarber, selectedDate])

  async function loadBarberSchedules(barberId: string) {
    const { data } = await supabase
      .from('barber_schedules')
      .select('*')
      .eq('barber_id', barberId)
    setBarberSchedules(data || [])
  }

  async function loadAvailableTimes() {
  if (!selectedBarber || !selectedDate) return

  const dayOfWeek = selectedDate.getDay()
  const schedule = barberSchedules.find(s => s.day_of_week === dayOfWeek && s.is_working)
  if (!schedule) { setAvailableTimes([]); return }

  // Busca configurações de intervalo e almoço
  const { data: settingsData } = await supabase
    .from('settings')
    .select('slot_minutes, lunch_start, lunch_end')
    .single()

  const slotMinutes = settingsData?.slot_minutes || 30
  const lunchStart = settingsData?.lunch_start || null
  const lunchEnd = settingsData?.lunch_end || null

  const dateStr = format(selectedDate, 'yyyy-MM-dd')
  const { data: appointments } = await supabase
    .from('appointments')
    .select('appointment_time')
    .eq('barber_id', selectedBarber.id)
    .eq('appointment_date', dateStr)
    .neq('status', 'cancelled')

  const bookedTimes = appointments?.map(a => a.appointment_time.slice(0, 5)) || []
  const times: string[] = []
  const [startHour, startMin] = schedule.start_time.split(':').map(Number)
  const [endHour, endMin] = schedule.end_time.split(':').map(Number)

  // Converte almoço para minutos totais para comparação fácil
  const lunchStartMins = lunchStart
    ? parseInt(lunchStart.split(':')[0]) * 60 + parseInt(lunchStart.split(':')[1])
    : null
  const lunchEndMins = lunchEnd
    ? parseInt(lunchEnd.split(':')[0]) * 60 + parseInt(lunchEnd.split(':')[1])
    : null

  let currentHour = startHour
  let currentMin = startMin

  while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
    const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`
    const currentTotalMins = currentHour * 60 + currentMin

    // Pula horários de almoço
    const isLunch = lunchStartMins !== null && lunchEndMins !== null
      && currentTotalMins >= lunchStartMins
      && currentTotalMins < lunchEndMins

    if (!isLunch && !bookedTimes.includes(timeStr)) {
      const now = new Date()
      const isToday = isSameDay(selectedDate, now)
      if (!isToday || currentHour > now.getHours() || (currentHour === now.getHours() && currentMin > now.getMinutes())) {
        times.push(timeStr)
      }
    }

    currentMin += slotMinutes
    if (currentMin >= 60) {
      currentHour += Math.floor(currentMin / 60)
      currentMin = currentMin % 60
    }
  }
  setAvailableTimes(times)
  }

  function addToCart(service: Service) {
    const existing = cart.find(item => item.service.id === service.id)
    if (existing) {
      setCart(cart.map(item => item.service.id === service.id ? { ...item, quantity: item.quantity + 1 } : item))
    } else {
      setCart([...cart, { service, quantity: 1 }])
    }
    toast.success(`${service.name} adicionado ao carrinho`)
  }

  function removeFromCart(serviceId: string) {
    const existing = cart.find(item => item.service.id === serviceId)
    if (existing && existing.quantity > 1) {
      setCart(cart.map(item => item.service.id === serviceId ? { ...item, quantity: item.quantity - 1 } : item))
    } else {
      setCart(cart.filter(item => item.service.id !== serviceId))
    }
  }

  function clearCart() { setCart([]); setShowCart(false) }

  async function handleSubmit() {
    const nameValidation = validateName(customerName)
    if (!nameValidation.valid) { toast.error(nameValidation.error); return }
    const phoneValidation = validatePhone(customerPhone)
    if (!phoneValidation.valid) { toast.error(phoneValidation.error); return }
    if (!selectedBarber || !selectedDate || !selectedTime || cart.length === 0) { toast.error('Preencha todos os campos'); return }
    if (!selectedPaymentMethod) { toast.error('Selecione a forma de pagamento'); return }

    setIsSubmitting(true)
    try {
      let { data: customer } = await supabase
        .from('customers').select('*').eq('phone', customerPhone.replace(/\D/g, '')).single()

      if (!customer) {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({ name: customerName.trim(), phone: customerPhone.replace(/\D/g, '') })
          .select().single()
        if (customerError) throw customerError
        customer = newCustomer
      }

      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          customer_id: customer.id,
          barber_id: selectedBarber.id,
          appointment_date: format(selectedDate, 'yyyy-MM-dd'),
          appointment_time: selectedTime,
          total_price: cartTotal,
          payment_method: selectedPaymentMethod, // ✅ valor exato: 'credit' | 'debit' | 'cash' | 'pix'
          status: 'pending'
        })
        .select().single()
      if (appointmentError) throw appointmentError

      const appointmentServices = cart.flatMap(item =>
        Array(item.quantity).fill({ appointment_id: appointment.id, service_id: item.service.id, price_at_time: item.service.price })
      )
      const { error: servicesError } = await supabase.from('appointment_services').insert(appointmentServices)
      if (servicesError) throw servicesError

      toast.success('Agendamento realizado com sucesso!')
      setCart([]); setSelectedBarber(null); setSelectedDate(null); setSelectedTime(null)
      setCustomerName(''); setCustomerPhone(''); setSelectedPaymentMethod('')
      setStep('services'); setShowCart(false)
    } catch (error) {
      console.error(error)
      toast.error('Erro ao realizar agendamento. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const next7Days = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i))
  function isDateAvailable(date: Date) {
    return barberSchedules.some(s => s.day_of_week === date.getDay() && s.is_working)
  }

  function handleClose() {
    if (step === 'barber') { setStep('services'); setSelectedBarber(null) }
    else if (step === 'date') { setStep('barber'); setSelectedDate(null) }
    else if (step === 'time') { setStep('date'); setSelectedTime(null) }
    else if (step === 'confirm') { setStep('time') }
  }

  // Opções de pagamento — valor e label separados, sem ambiguidade
  const paymentOptions = [
    { value: 'credit', label: 'Crédito',  icon: <CreditCard className="h-5 w-5" /> },
    { value: 'debit',  label: 'Débito',   icon: <CreditCard className="h-5 w-5" /> },
    { value: 'cash',   label: 'Dinheiro', icon: <Banknote   className="h-5 w-5" /> },
    { value: 'pix',    label: 'Pix',      icon: <Smartphone className="h-5 w-5" /> },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header com banner */}
<header className="sticky top-0 z-50 bg-card border-b border-border">
  {/* Banner */}
  <div className="w-full h-32 bg-primary/10 flex items-center justify-center overflow-hidden">
    {shopLogo ? (
      <img src={shopLogo} alt={shopName} className="w-full h-full object-cover" />
    ) : (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-primary/20 to-primary/5">
        <Scissors className="h-16 w-16 text-primary opacity-30" />
      </div>
    )}
  </div>

  {/* Info abaixo do banner */}
  <div className="container mx-auto px-4 py-3">
    <div className="flex items-center justify-between">
      {/* Esquerda: nome + estrelas */}
      <div>
        <h1 className="text-xl font-bold text-foreground">{shopName}</h1>
        <div className="flex items-center gap-1 mt-1">
          {[1,2,3,4,5].map(s => <Star key={s} className="h-3 w-3 fill-primary text-primary" />)}
          <span className="text-xs text-muted-foreground ml-1">5.0</span>
        </div>
      </div>

      {/* Direita: WhatsApp + carrinho */}
      <div className="flex items-center gap-2">
        {whatsappLink && (
          <Button variant="outline" size="sm"
            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            onClick={() => window.open(whatsappLink, '_blank')}>
            <MessageCircle className="h-4 w-4 mr-2" />WhatsApp
          </Button>
        )}
        <Button variant="outline" size="sm" className="relative" onClick={() => setShowCart(true)}>
          <ShoppingCart className="h-4 w-4" />
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
              {cart.reduce((sum, item) => sum + item.quantity, 0)}
            </span>
          )}
        </Button>
      </div>
    </div>
  </div>
</header>

      <main className="container mx-auto px-4 py-6 pb-48">

        {/* Serviços */}
        {step === 'services' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">Escolha seus serviços</h2>
              <p className="text-muted-foreground mt-1">Selecione um ou mais serviços</p>
            </div>
            <div className="grid gap-4">
              {services.map((service) => {
                const inCart = cart.find(item => item.service.id === service.id)
                return (
                  <Card key={service.id} className="bg-card border-border hover:border-primary/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground">{service.name}</h3>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-primary font-bold">{formatCurrency(service.price)}</span>
                          </div>
                        </div>
                        {inCart ? (
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => removeFromCart(service.id)}><Minus className="h-4 w-4" /></Button>
                            <span className="w-8 text-center font-semibold">{inCart.quantity}</span>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => addToCart(service)}><Plus className="h-4 w-4" /></Button>
                          </div>
                        ) : (
                          <Button variant="outline" size="sm"
                            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                            onClick={() => addToCart(service)}>
                            <Plus className="h-4 w-4 mr-1" />Adicionar
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* Barbeiro */}
        {step === 'barber' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Escolha o barbeiro</h2>
                <p className="text-muted-foreground mt-1">Selecione quem vai te atender</p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleClose}><X className="h-5 w-5" /></Button>
            </div>
            <div className="grid gap-4">
              {barbers.map((barber) => (
                <Card key={barber.id}
                  className={`bg-card border-border cursor-pointer transition-all ${selectedBarber?.id === barber.id ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/50'}`}
                  onClick={() => { setSelectedBarber(barber); setStep('date') }}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {barber.photo_url ? (
                        <img src={barber.photo_url} alt={barber.name} className="h-16 w-16 rounded-full object-cover" />
                      ) : (
                        <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center">
                          <User className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold text-foreground text-lg">{barber.name}</h3>
                        <p className="text-sm text-muted-foreground">Profissional</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Data — ✅ scroll horizontal nativo, funciona no mobile */}
        {step === 'date' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Escolha a data</h2>
                <p className="text-muted-foreground mt-1">Selecione o dia do agendamento</p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleClose}><X className="h-5 w-5" /></Button>
            </div>
            <div className="w-full overflow-x-auto pb-2 -mx-4 px-4">
              <div className="flex gap-3" style={{ width: 'max-content' }}>
                {next7Days.map((date) => {
                  const available = isDateAvailable(date)
                  const isSelected = selectedDate && isSameDay(date, selectedDate)
                  return (
                    <Card key={date.toISOString()}
                      className={`w-[90px] shrink-0 cursor-pointer transition-all ${!available ? 'opacity-50 cursor-not-allowed' : isSelected ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/50'}`}
                      onClick={() => { if (available) { setSelectedDate(date); setStep('time') } }}>
                      <CardContent className="p-3 text-center">
                        <p className="text-xs text-muted-foreground uppercase">{format(date, 'EEE', { locale: ptBR })}</p>
                        <p className="text-2xl font-bold text-foreground mt-1">{format(date, 'd')}</p>
                        <p className="text-xs text-muted-foreground">{format(date, 'MMM', { locale: ptBR })}</p>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Horário */}
        {step === 'time' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Escolha o horário</h2>
                <p className="text-muted-foreground mt-1">
                  {selectedDate && format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleClose}><X className="h-5 w-5" /></Button>
            </div>
            {availableTimes.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="p-8 text-center">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-semibold text-foreground">Ops, nenhum horário disponível</p>
                  <p className="text-muted-foreground mt-1">Selecione outra data ou outro barbeiro</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {availableTimes.map((time) => (
                  <Button key={time}
                    variant={selectedTime === time ? 'default' : 'outline'}
                    className={selectedTime === time ? 'bg-primary text-primary-foreground' : ''}
                    onClick={() => { setSelectedTime(time); setStep('confirm') }}>
                    {time}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Confirmação */}
        {step === 'confirm' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Confirmar agendamento</h2>
                <p className="text-muted-foreground mt-1">Preencha seus dados para finalizar</p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleClose}><X className="h-5 w-5" /></Button>
            </div>

            <Card className="bg-card border-border">
              <CardHeader><CardTitle className="text-lg">Resumo do agendamento</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-primary" />
                  <span className="text-foreground">{selectedDate && format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-primary" />
                  <span className="text-foreground">{selectedTime}</span>
                </div>
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-primary" />
                  <span className="text-foreground">{selectedBarber?.name}</span>
                </div>
                <div className="border-t border-border pt-4">
                   < p className="text-sm text-muted-foreground mb-2">Serviços:</p>
                  {cart.map((item) => (
                    <div key={item.service.id} className="flex justify-between text-sm">
                      <span className="text-foreground">{item.quantity}x {item.service.name}</span>
                      <span className="text-primary font-semibold">{formatCurrency(item.service.price * item.quantity)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between mt-3 pt-3 border-t border-border">
                    <span className="font-semibold text-foreground">Total</span>
                    <span className="font-bold text-primary text-lg">{formatCurrency(cartTotal)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader><CardTitle className="text-lg">Seus dados</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome completo</Label>
                  <Input id="name" placeholder="Digite seu nome" value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)} className="bg-input border-border" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" placeholder="(00) 00000-0000" value={customerPhone}
                    onChange={(e) => setCustomerPhone(formatPhone(e.target.value))} className="bg-input border-border" />
                </div>
              </CardContent>
            </Card>

            {/* ✅ Pagamento corrigido: cada botão usa value único e correto */}
            <Card className="bg-card border-border">
              <CardHeader><CardTitle className="text-lg">Forma de pagamento</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {paymentOptions.map(({ value, label, icon }) => (
                    <button key={value} type="button"
                      className={`flex items-center justify-center gap-2 p-4 rounded-lg border transition-all ${
                        selectedPaymentMethod === value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedPaymentMethod(value)}>
                      {icon}<span>{label}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Button className="w-full h-12 text-lg bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Agendando...' : 'Confirmar agendamento'}
            </Button>
          </div>
        )}
      </main>

      {/* Botão flutuante carrinho */}
      {step === 'services' && cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border">
          <Button className="w-full h-12 text-lg bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setStep('barber')}>
            <Check className="h-5 w-5 mr-2" />Continuar - {formatCurrency(cartTotal)}
          </Button>
        </div>
      )}

      {/* Drawer carrinho */}
      {showCart && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-card border-l border-border shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold">Carrinho</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowCart(false)}><X className="h-5 w-5" /></Button>
            </div>
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="p-4 space-y-4">
                {cart.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Seu carrinho está vazio</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <Card key={item.service.id} className="bg-secondary border-border">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">{item.service.name}</h3>
                            <p className="text-sm text-primary">{formatCurrency(item.service.price)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => removeFromCart(item.service.id)}><Minus className="h-4 w-4" /></Button>
                            <span className="w-8 text-center font-semibold">{item.quantity}</span>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => addToCart(item.service)}><Plus className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
            {cart.length > 0 && (
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-card border-t border-border">
                <div className="flex justify-between mb-4">
                  <span className="text-muted-foreground">Total</span>
                  <span className="text-xl font-bold text-primary">{formatCurrency(cartTotal)}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={clearCart}>
                    <Trash2 className="h-4 w-4 mr-2" />Limpar
                  </Button>
                  <Button className="flex-1 bg-primary text-primary-foreground"
                    onClick={() => { setShowCart(false); setStep('barber') }}>
                    Continuar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      {shopAddress && (
        <footer className="fixed bottom-0 left-0 right-0 bg-card border-t border-border py-3 px-4">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" /><span>{shopAddress}</span>
          </div>
        </footer>
      )}
    </div>
  )
}
