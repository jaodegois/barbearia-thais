const BLOCKED_WORDS = [
  'porra', 'caralho', 'merda', 'foda', 'puta', 'viado', 'buceta', 'cu',
  'arrombado', 'fdp', 'vsf', 'tnc', 'pqp', 'krl', 'cuzao', 'cuzão',
  'desgraça', 'desgraca', 'vagabundo', 'vagabunda', 'piranha', 'safado',
  'safada', 'cacete', 'bosta', 'corno', 'otario', 'otário', 'idiota',
  'imbecil', 'babaca', 'trouxa', 'droga', 'cocaina', 'maconha', 'crack',
  'fuck', 'shit', 'damn', 'bitch', 'asshole', 'bastard'
]

export function validateName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length < 2) {
    return { valid: false, error: 'Nome deve ter pelo menos 2 caracteres' }
  }

  if (name.trim().length > 100) {
    return { valid: false, error: 'Nome deve ter no máximo 100 caracteres' }
  }

  const lowerName = name.toLowerCase()
  
  for (const word of BLOCKED_WORDS) {
    if (lowerName.includes(word)) {
      return { valid: false, error: 'Nome contém palavras não permitidas' }
    }
  }

  return { valid: true }
}

export function validatePhone(phone: string): { valid: boolean; error?: string } {
  const cleanPhone = phone.replace(/\D/g, '')
  
  if (cleanPhone.length < 10 || cleanPhone.length > 11) {
    return { valid: false, error: 'Telefone inválido. Use o formato (XX) XXXXX-XXXX' }
  }

  return { valid: true }
}

export function formatPhone(phone: string): string {
  const cleanPhone = phone.replace(/\D/g, '')
  
  if (cleanPhone.length === 11) {
    return `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(2, 7)}-${cleanPhone.slice(7)}`
  } else if (cleanPhone.length === 10) {
    return `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(2, 6)}-${cleanPhone.slice(6)}`
  }
  
  return phone
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}
