import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default function FornecedoresPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fornecedores</h1>
        <Button disabled className="bg-[#2B7A78] hover:bg-[#1e5654]">
          <Plus size={16} className="mr-2" />Novo Fornecedor (em breve)
        </Button>
      </div>
      <p className="text-muted-foreground">Modulo de fornecedores em desenvolvimento.</p>
    </div>
  )
}
