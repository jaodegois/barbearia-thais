'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Scissors, Lock } from 'lucide-react'
import { toast } from 'sonner'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [shopName, setShopName] = useState('BarberFlow')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkExistingSession()
    loadShopName()
  }, [])

  async function loadShopName() {
    const { data } = await supabase.from('settings').select('shop_name').limit(1).single()
    if (data) setShopName(data.shop_name)
  }

  async function checkExistingSession() {
    const isLoggedIn = localStorage.getItem('barberflow_admin')
    if (isLoggedIn === 'true') {
      router.push('/admin/dashboard')
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { data: settings } = await supabase
        .from('settings')
        .select('admin_password')
        .limit(1)
        .single()

      if (settings && settings.admin_password === password) {
        localStorage.setItem('barberflow_admin', 'true')
        toast.success('Login realizado com sucesso!')
        router.push('/admin/dashboard')
      } else {
        toast.error('Senha incorreta')
      }
    } catch (error) {
      toast.error('Erro ao fazer login')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary flex items-center justify-center mb-4">
            <Scissors className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">{shopName}</CardTitle>
          <CardDescription>Painel Administrativo</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Digite a senha do admin"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-input border-border"
                />
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isLoading}
            >
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
