'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Appointment, Settings } from '@/lib/types'
import { formatCurrency } from '@/lib/validation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  Scissors, 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  Check, 
  X, 
  DollarSign,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  Users,
  Trash2,
  CreditCard,
  Banknote,
  Smartphone,
  Play,
  Upload,
  Image as ImageIcon
} from 'lucide-react'
import { format, parseISO, startOfMonth, endOfMonth, isToday, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'

export default function AdminDashboard() {
  const [isLoading, setIsLoading] = useState(true)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [activeTab, setActiveTab] = useState('appointments')
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('')
  
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('barberflow_admin')
    if (isLoggedIn !== 'true') {
      router.push('/admin')
      return
    }
    loadData()
  }, [])

  useEffect(() => {
    if (settings) {
      loadAppointments()
    }
  }, [selectedDate, settings])

  async function loadData() {
    setIsLoading(true)
    try {
      const { data: settingsData } = await supabase
        .from('settings')
        .select('*')
        .limit(1)
        .single()
      
      setSettings(settingsData)
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  async function loadAppointments() {
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    
    const { data } = await supabase
      .from('appointments')
      .select(`
        *,
        customer:customers(*),
        barber:barbers(*),
        services:appointment_services(*, service:services(*))
      `)
      .eq('appointment_date', dateStr)
      .order('appointment_time')

    setAppointments(data || [])
  }

  function handleLogout() {
    localStorage.removeItem('barberflow_admin')
    router.push('/admin')
  }

  function openCompleteDialog(appointment: Appointment) {
    setSelectedAppointment(appointment)
    setSelectedPaymentMethod('')
    setCompleteDialogOpen(true)
  }

  function openDeleteDialog(appointment: Appointment) {
    setSelectedAppointment(appointment)
    setDeleteDialogOpen(true)
  }

  async function handleComplete() {
    if (!selectedAppointment) return

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', selectedAppointment.id)

      if (error) throw error

      // Update customer total spent
      if (selectedAppointment.customer) {
        await supabase
          .from('customers')
          .update({ 
            total_spent: selectedAppointment.customer.total_spent + selectedAppointment.total_price 
          })
          .eq('id', selectedAppointment.customer_id)
      }

      toast.success('Atendimento concluído!')
      setCompleteDialogOpen(false)
      loadAppointments()
    } catch (error) {
      toast.error('Erro ao concluir atendimento')
    }
  }

  async function handleDelete() {
    if (!selectedAppointment) return

    try {
      // If was completed, subtract from customer total
      if (selectedAppointment.status === 'completed' && selectedAppointment.customer) {
        await supabase
          .from('customers')
          .update({ 
            total_spent: Math.max(0, selectedAppointment.customer.total_spent - selectedAppointment.total_price)
          })
          .eq('id', selectedAppointment.customer_id)
      }

      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', selectedAppointment.id)

      if (error) throw error

      toast.success('Agendamento removido!')
      setDeleteDialogOpen(false)
      loadAppointments()
    } catch (error) {
      toast.error('Erro ao remover agendamento')
    }
  }

  async function handleCancel(appointment: Appointment) {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointment.id)

      if (error) throw error

      toast.success('Agendamento cancelado!')
      loadAppointments()
    } catch (error) {
      toast.error('Erro ao cancelar agendamento')
    }
  }

  function getPaymentMethodLabel(method: string | null) {
    switch (method) {
      case 'credit': return 'Cartão de Crédito'
      case 'debit': return 'Cartão de Débito'
      case 'cash': return 'Dinheiro'
      case 'pix': return 'Pix'
      default: return '-'
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-500'
      case 'completed': return 'bg-green-500/20 text-green-500'
      case 'cancelled': return 'bg-red-500/20 text-red-500'
      default: return 'bg-gray-500/20 text-gray-500'
    }
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case 'pending': return 'Pendente'
      case 'completed': return 'Concluído'
      case 'cancelled': return 'Cancelado'
      default: return status
    }
  }

  const pendingAppointments = appointments.filter(a => a.status === 'pending')
  const completedAppointments = appointments.filter(a => a.status === 'completed')
  const dayRevenue = completedAppointments.reduce((sum, a) => sum + a.total_price, 0)

  // Generate date options for the next 30 days
  const dateOptions = Array.from({ length: 30 }, (_, i) => addDays(new Date(), i))

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                <Scissors className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">{settings?.shop_name || 'BarberFlow'}</h1>
                <p className="text-sm text-muted-foreground">Painel Admin</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 bg-secondary">
            <TabsTrigger value="appointments" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Agenda</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Relatórios</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Config</span>
            </TabsTrigger>
            <TabsTrigger value="simulator" className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              <span className="hidden sm:inline">Simular</span>
            </TabsTrigger>
          </TabsList>

          {/* Appointments Tab */}
          <TabsContent value="appointments" className="space-y-6">
            {/* Date Selector */}
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <Label className="text-muted-foreground">Data:</Label>
                  <Select
                    value={format(selectedDate, 'yyyy-MM-dd')}
                    onValueChange={(value) => setSelectedDate(parseISO(value))}
                  >
                    <SelectTrigger className="w-[200px] bg-input border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dateOptions.map((date) => (
                        <SelectItem key={date.toISOString()} value={format(date, 'yyyy-MM-dd')}>
                          {isToday(date) ? 'Hoje - ' : ''}
                          {format(date, "EEEE, d 'de' MMM", { locale: ptBR })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-card border-border">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{pendingAppointments.length}</p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-green-500">{completedAppointments.length}</p>
                  <p className="text-xs text-muted-foreground">Concluídos</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{formatCurrency(dayRevenue)}</p>
                  <p className="text-xs text-muted-foreground">Faturamento</p>
                </CardContent>
              </Card>
            </div>

            {/* Appointments List */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">
                Agendamentos - {format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
              </h2>

              {appointments.length === 0 ? (
                <Card className="bg-card border-border">
                  <CardContent className="p-8 text-center">
                    <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Nenhum agendamento para esta data</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {appointments.map((appointment) => (
                    <Card key={appointment.id} className="bg-card border-border">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                                {getStatusLabel(appointment.status)}
                              </span>
                              <span className="text-sm text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {appointment.appointment_time.slice(0, 5)}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-primary" />
                              <span className="font-semibold">{appointment.customer?.name}</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">{appointment.customer?.phone}</span>
                            </div>

                            <div className="text-sm text-muted-foreground">
                              {appointment.services?.map(s => s.service?.name).join(', ')}
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-border">
                              <span className="font-bold text-primary">{formatCurrency(appointment.total_price)}</span>
                              {appointment.payment_method && (
                                <span className="text-xs text-muted-foreground">
                                  {getPaymentMethodLabel(appointment.payment_method)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            {appointment.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  onClick={() => openCompleteDialog(appointment)}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Concluir
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-red-500 text-red-500 hover:bg-red-500/10"
                                  onClick={() => handleCancel(appointment)}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Cancelar
                                </Button>
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => openDeleteDialog(appointment)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <ReportsSection />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <SettingsSection settings={settings} onUpdate={loadData} />
          </TabsContent>

          {/* Simulator Tab */}
          <TabsContent value="simulator">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Simulador de Cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Teste o fluxo de agendamento como se fosse um cliente.
                </p>
                <Button 
                  className="bg-primary text-primary-foreground"
                  onClick={() => window.open('/', '_blank')}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Abrir Página de Agendamento
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Complete Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Concluir Atendimento</DialogTitle>
            <DialogDescription>
              Confirmar que o atendimento foi realizado?
            </DialogDescription>
          </DialogHeader>
          {selectedAppointment && (
            <div className="py-4 space-y-2">
              <p><strong>Cliente:</strong> {selectedAppointment.customer?.name}</p>
              <p><strong>Valor:</strong> {formatCurrency(selectedAppointment.total_price)}</p>
              <p><strong>Pagamento:</strong> {getPaymentMethodLabel(selectedAppointment.payment_method)}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleComplete}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Remover Agendamento</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover este agendamento? Esta ação não pode ser desfeita.
              {selectedAppointment?.status === 'completed' && (
                <span className="block mt-2 text-yellow-500">
                  Atenção: Este atendimento já foi concluído. O valor será removido do faturamento.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDelete}
            >
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Reports Section Component
function ReportsSection() {
  const [dayRevenue, setDayRevenue] = useState(0)
  const [monthRevenue, setMonthRevenue] = useState(0)
  const [customers, setCustomers] = useState<any[]>([])
  const [isClearing, setIsClearing] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadReports()
  }, [])

  async function loadReports() {
    const today = format(new Date(), 'yyyy-MM-dd')
    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')

    const { data: dayData } = await supabase
      .from('appointments')
      .select('total_price')
      .eq('appointment_date', today)
      .eq('status', 'completed')
    setDayRevenue(dayData?.reduce((sum, a) => sum + a.total_price, 0) || 0)

    const { data: monthData } = await supabase
      .from('appointments')
      .select('total_price')
      .gte('appointment_date', monthStart)
      .lte('appointment_date', monthEnd)
      .eq('status', 'completed')
    setMonthRevenue(monthData?.reduce((sum, a) => sum + a.total_price, 0) || 0)

    const { data: customersData } = await supabase
      .from('customers')
      .select('*')
      .order('total_spent', { ascending: false })
      .limit(20)
    setCustomers(customersData || [])
  }

  async function handleClearCancelled() {
    if (!confirm('Apagar todos os agendamentos cancelados? Esta ação não pode ser desfeita.')) return
    setIsClearing(true)
    try {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('status', 'cancelled')
      if (error) throw error
      toast.success('Agendamentos cancelados removidos!')
      loadReports()
    } catch (error) {
      toast.error('Erro ao limpar histórico')
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Faturamento Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{formatCurrency(dayRevenue)}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Faturamento do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{formatCurrency(monthRevenue)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Histórico por Cliente
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="border-red-500 text-red-500 hover:bg-red-500/10"
              onClick={handleClearCancelled}
              disabled={isClearing}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isClearing ? 'Limpando...' : 'Limpar cancelados'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {customers.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary"
                >
                  <div>
                    <p className="font-semibold">{customer.name}</p>
                    <p className="text-sm text-muted-foreground">{customer.phone}</p>
                  </div>
                  <p className="font-bold text-primary">{formatCurrency(customer.total_spent)}</p>
                </div>
              ))}
              {customers.length === 0 && (
                <p className="text-center text-muted-foreground py-8">Nenhum cliente encontrado</p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

// Settings Section Component
function SettingsSection({ settings, onUpdate }: { settings: Settings | null, onUpdate: () => void }) {
  const [shopName, setShopName] = useState(settings?.shop_name || '')
  const [shopLogo, setShopLogo] = useState(settings?.shop_logo_url || '')
  const [shopAddress, setShopAddress] = useState(settings?.shop_address || '')
  const [whatsappLink, setWhatsappLink] = useState(settings?.whatsapp_link || '')
  const [currentPassword, setCurrentPassword] = useState(settings?.admin_password || '')
  const [newPassword, setNewPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    if (settings) {
      setShopName(settings.shop_name)
      setShopLogo(settings.shop_logo_url || '')
      setShopAddress(settings.shop_address || '')
      setWhatsappLink(settings.whatsapp_link || '')
      setCurrentPassword(settings.admin_password)
    }
  }, [settings])

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingLogo(true)
    try {
      // Convert to base64 for storage (simple approach without external storage)
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64 = reader.result as string
        const { error } = await supabase
          .from('settings')
          .update({ shop_logo_url: base64 })
          .eq('id', settings?.id)

        if (error) throw error

        setShopLogo(base64)
        toast.success('Logo atualizado!')
        onUpdate()
      }
      reader.readAsDataURL(file)
    } catch (error) {
      toast.error('Erro ao fazer upload do logo')
    } finally {
      setIsUploadingLogo(false)
    }
  }

  async function handleSaveSettings() {
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('settings')
        .update({
          shop_name: shopName,
          shop_address: shopAddress,
          whatsapp_link: whatsappLink,
          updated_at: new Date().toISOString()
        })
        .eq('id', settings?.id)

      if (error) throw error

      toast.success('Configurações salvas!')
      onUpdate()
    } catch (error) {
      toast.error('Erro ao salvar configurações')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleChangePassword() {
    if (!newPassword || newPassword.length < 4) {
      toast.error('A nova senha deve ter pelo menos 4 caracteres')
      return
    }

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('settings')
        .update({ admin_password: newPassword })
        .eq('id', settings?.id)

      if (error) throw error

      toast.success('Senha alterada com sucesso!')
      setCurrentPassword(newPassword)
      setNewPassword('')
      onUpdate()
    } catch (error) {
      toast.error('Erro ao alterar senha')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Identity Settings */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Identidade da Barbearia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Logo Upload */}
          <div className="space-y-2">
            <Label>Logo da Barbearia</Label>
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center overflow-hidden border-2 border-border">
                {shopLogo ? (
                  <img src={shopLogo} alt="Logo" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div>
                <input
                  type="file"
                  id="logoUpload"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('logoUpload')?.click()}
                  disabled={isUploadingLogo}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploadingLogo ? 'Enviando...' : 'Alterar Logo'}
                </Button>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG ou GIF (máx. 2MB)
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="shopName">Nome da Barbearia</Label>
            <Input
              id="shopName"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="bg-input border-border"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shopAddress">Endereço</Label>
            <Input
              id="shopAddress"
              value={shopAddress}
              onChange={(e) => setShopAddress(e.target.value)}
              placeholder="Rua, número - Bairro, Cidade"
              className="bg-input border-border"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="whatsapp">Link do WhatsApp</Label>
            <Input
              id="whatsapp"
              value={whatsappLink}
              onChange={(e) => setWhatsappLink(e.target.value)}
              placeholder="https://wa.me/5511999999999"
              className="bg-input border-border"
            />
          </div>
          <Button 
            onClick={handleSaveSettings} 
            disabled={isSaving}
            className="bg-primary text-primary-foreground"
          >
            {isSaving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </CardContent>
      </Card>

      {/* Password Settings */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Segurança</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Senha Atual</Label>
            <Input
              type="text"
              value={currentPassword}
              readOnly
              className="bg-secondary border-border"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nova Senha</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Digite a nova senha"
              className="bg-input border-border"
            />
          </div>
          <Button 
            onClick={handleChangePassword} 
            disabled={isSaving}
            variant="outline"
          >
            Alterar Senha
          </Button>
        </CardContent>
      </Card>

      {/* Services Settings */}
      <ServicesSettings />

      {/* Barbers Settings */}
      <BarbersSettings />
    </div>
  )
}

// Services Settings Component
function ServicesSettings() {
  const [services, setServices] = useState<any[]>([])
  const [editingService, setEditingService] = useState<any>(null)
  const [newServiceName, setNewServiceName] = useState('')
  const [newServicePrice, setNewServicePrice] = useState('')
  const [newServiceDuration, setNewServiceDuration] = useState('30')
  const supabase = createClient()

  useEffect(() => {
    loadServices()
  }, [])

  async function loadServices() {
    const { data } = await supabase
      .from('services')
      .select('*')
      .order('name')
    setServices(data || [])
  }

  async function handleAddService() {
    if (!newServiceName || !newServicePrice) {
      toast.error('Preencha todos os campos')
      return
    }

    try {
      const { error } = await supabase
        .from('services')
        .insert({
          name: newServiceName,
          price: parseFloat(newServicePrice),
          duration_minutes: parseInt(newServiceDuration),
          is_active: true
        })

      if (error) throw error

      toast.success('Serviço adicionado!')
      setNewServiceName('')
      setNewServicePrice('')
      setNewServiceDuration('30')
      loadServices()
    } catch (error) {
      toast.error('Erro ao adicionar serviço')
    }
  }

  async function handleUpdateService(service: any) {
    try {
      const { error } = await supabase
        .from('services')
        .update({
          name: service.name,
          price: service.price,
          duration_minutes: service.duration_minutes
        })
        .eq('id', service.id)

      if (error) throw error

      toast.success('Serviço atualizado!')
      setEditingService(null)
      loadServices()
    } catch (error) {
      toast.error('Erro ao atualizar serviço')
    }
  }

  async function handleDeleteService(id: string) {
    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('Serviço removido!')
      loadServices()
    } catch (error) {
      toast.error('Erro ao remover serviço')
    }
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>Serviços e Preços</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new service */}
        <div className="grid grid-cols-4 gap-2">
          <Input
            placeholder="Nome do serviço"
            value={newServiceName}
            onChange={(e) => setNewServiceName(e.target.value)}
            className="bg-input border-border"
          />
          <Input
            type="number"
            placeholder="Preço"
            value={newServicePrice}
            onChange={(e) => setNewServicePrice(e.target.value)}
            className="bg-input border-border"
          />
          <Input
            type="number"
            placeholder="Duração (min)"
            value={newServiceDuration}
            onChange={(e) => setNewServiceDuration(e.target.value)}
            className="bg-input border-border"
          />
          <Button onClick={handleAddService} className="bg-primary text-primary-foreground">
            Adicionar
          </Button>
        </div>

        {/* Services list */}
        <div className="space-y-2">
          {services.map((service) => (
            <div key={service.id} className="flex items-center gap-2 p-3 rounded-lg bg-secondary">
              {editingService?.id === service.id ? (
                <>
                  <Input
                    value={editingService.name}
                    onChange={(e) => setEditingService({ ...editingService, name: e.target.value })}
                    className="flex-1 bg-input border-border"
                  />
                  <Input
                    type="number"
                    value={editingService.price}
                    onChange={(e) => setEditingService({ ...editingService, price: parseFloat(e.target.value) })}
                    className="w-24 bg-input border-border"
                  />
                  <Input
                    type="number"
                    value={editingService.duration_minutes}
                    onChange={(e) => setEditingService({ ...editingService, duration_minutes: parseInt(e.target.value) })}
                    className="w-20 bg-input border-border"
                  />
                  <Button size="sm" onClick={() => handleUpdateService(editingService)}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingService(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-medium">{service.name}</span>
                  <span className="text-primary font-bold">{formatCurrency(service.price)}</span>
                  <span className="text-sm text-muted-foreground">{service.duration_minutes}min</span>
                  <Button size="sm" variant="ghost" onClick={() => setEditingService({ ...service })}>
                    <SettingsIcon className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteService(service.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Barbers Settings Component
function BarbersSettings() {
  const [barbers, setBarbers] = useState<any[]>([])
  const [newBarberName, setNewBarberName] = useState('')
  const [selectedBarber, setSelectedBarber] = useState<any>(null)
  const [schedules, setSchedules] = useState<any[]>([])
  const supabase = createClient()

  const daysOfWeek = [
    { value: 0, label: 'Domingo' },
    { value: 1, label: 'Segunda' },
    { value: 2, label: 'Terça' },
    { value: 3, label: 'Quarta' },
    { value: 4, label: 'Quinta' },
    { value: 5, label: 'Sexta' },
    { value: 6, label: 'Sábado' },
  ]

  useEffect(() => {
    loadBarbers()
  }, [])

  useEffect(() => {
    if (selectedBarber) {
      loadSchedules(selectedBarber.id)
    }
  }, [selectedBarber])

  async function loadBarbers() {
    const { data } = await supabase
      .from('barbers')
      .select('*')
      .order('name')
    setBarbers(data || [])
  }

  async function loadSchedules(barberId: string) {
    const { data } = await supabase
      .from('barber_schedules')
      .select('*')
      .eq('barber_id', barberId)
    setSchedules(data || [])
  }

  async function handleAddBarber() {
    if (!newBarberName) {
      toast.error('Digite o nome do barbeiro')
      return
    }

    try {
      const { data: barber, error } = await supabase
        .from('barbers')
        .insert({ name: newBarberName, is_active: true })
        .select()
        .single()

      if (error) throw error

      // Create default schedules
      const defaultSchedules = daysOfWeek.map((day) => ({
        barber_id: barber.id,
        day_of_week: day.value,
        start_time: day.value === 0 ? '00:00' : '09:00',
        end_time: day.value === 0 ? '00:00' : day.value === 6 ? '18:00' : '19:00',
        is_working: day.value !== 0
      }))

      await supabase.from('barber_schedules').insert(defaultSchedules)

      toast.success('Barbeiro adicionado!')
      setNewBarberName('')
      loadBarbers()
    } catch (error) {
      toast.error('Erro ao adicionar barbeiro')
    }
  }

  async function handleUpdateSchedule(schedule: any) {
    try {
      const { error } = await supabase
        .from('barber_schedules')
        .update({
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          is_working: schedule.is_working
        })
        .eq('id', schedule.id)

      if (error) throw error

      toast.success('Horário atualizado!')
      loadSchedules(selectedBarber.id)
    } catch (error) {
      toast.error('Erro ao atualizar horário')
    }
  }

  async function handleDeleteBarber(id: string) {
    try {
      const { error } = await supabase
        .from('barbers')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('Barbeiro removido!')
      setSelectedBarber(null)
      loadBarbers()
    } catch (error) {
      toast.error('Erro ao remover barbeiro')
    }
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>Barbeiros</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new barber */}
        <div className="flex gap-2">
          <Input
            placeholder="Nome do barbeiro"
            value={newBarberName}
            onChange={(e) => setNewBarberName(e.target.value)}
            className="bg-input border-border"
          />
          <Button onClick={handleAddBarber} className="bg-primary text-primary-foreground">
            Adicionar
          </Button>
        </div>

        {/* Barbers list */}
        <div className="space-y-2">
          {barbers.map((barber) => (
            <div 
              key={barber.id} 
              className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                selectedBarber?.id === barber.id 
                  ? 'bg-primary/20 border border-primary' 
                  : 'bg-secondary hover:bg-secondary/80'
              }`}
              onClick={() => setSelectedBarber(barber)}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <span className="font-medium">{barber.name}</span>
              </div>
              <Button 
                size="sm" 
                variant="ghost" 
                className="text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteBarber(barber.id)
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Schedule editor */}
        {selectedBarber && (
          <div className="mt-4 p-4 rounded-lg bg-secondary/50">
            <h4 className="font-semibold mb-4">Horários de {selectedBarber.name}</h4>
            <div className="space-y-3">
              {daysOfWeek.map((day) => {
                const schedule = schedules.find(s => s.day_of_week === day.value)
                if (!schedule) return null

                return (
                  <div key={day.value} className="flex items-center gap-3">
                    <div className="w-24">
                      <span className="text-sm">{day.label}</span>
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={schedule.is_working}
                        onChange={(e) => handleUpdateSchedule({ ...schedule, is_working: e.target.checked })}
                        className="rounded border-border"
                      />
                      <span className="text-sm text-muted-foreground">Trabalha</span>
                    </label>
                    {schedule.is_working && (
                      <>
                        <Input
                          type="time"
                          value={schedule.start_time}
                          onChange={(e) => handleUpdateSchedule({ ...schedule, start_time: e.target.value })}
                          className="w-28 bg-input border-border"
                        />
                        <span>-</span>
                        <Input
                          type="time"
                          value={schedule.end_time}
                          onChange={(e) => handleUpdateSchedule({ ...schedule, end_time: e.target.value })}
                          className="w-28 bg-input border-border"
                        />
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
