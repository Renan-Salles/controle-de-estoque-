export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          nome: string
          email: string
          perfil: 'admin' | 'gerente'
          status: 'ativo' | 'inativo'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      categorias: {
        Row: { id: string; nome: string; ordem: number; ativo: boolean }
        Insert: Omit<Database['public']['Tables']['categorias']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['categorias']['Insert']>
      }
      produtos: {
        Row: {
          id: string
          codigo_barras: string | null
          nome: string
          marca: string | null
          categoria_id: string
          embalagem: string
          volume_ml: number | null
          fator_conversao: number
          custo_atual: number
          preco_venda_padrao: number
          margem_alvo_pct: number | null
          estoque_minimo: number
          estoque_maximo: number | null
          ativo: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['produtos']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['produtos']['Insert']>
      }
      estoque: {
        Row: {
          id: string
          produto_id: string
          saldo_atual: number
          custo_medio: number
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['estoque']['Row'], 'id' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['estoque']['Insert']>
      }
      clientes: {
        Row: {
          id: string
          tipo: string
          nome: string
          cpf_cnpj: string | null
          telefone: string | null
          whatsapp: string | null
          endereco: Json
          observacoes: string | null
          limite_credito: number
          prazo_pagamento_dias: number
          forma_pagamento_padrao: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['clientes']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['clientes']['Insert']>
      }
      pedidos: {
        Row: {
          id: string
          numero_pedido: number
          cliente_id: string
          atendente_id: string
          status: string
          data_pedido: string
          data_entrega_prevista: string | null
          forma_pagamento: string
          prazo_pagamento_dias: number
          data_vencimento: string | null
          subtotal: number
          desconto_total: number
          total: number
          total_pago: number
          observacoes: string | null
          canal: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['pedidos']['Row'], 'id' | 'numero_pedido' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['pedidos']['Insert']>
      }
      pedido_itens: {
        Row: {
          id: string
          pedido_id: string
          produto_id: string
          quantidade_pedida: number
          quantidade_entregue: number | null
          preco_unitario: number
          desconto_pct: number
          total: number
        }
        Insert: Omit<Database['public']['Tables']['pedido_itens']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['pedido_itens']['Insert']>
      }
      movimentacoes_estoque: {
        Row: {
          id: string
          produto_id: string
          tipo: string
          quantidade: number
          custo_unitario: number | null
          saldo_apos: number
          referencia_tipo: string | null
          referencia_id: string | null
          usuario_id: string | null
          observacao: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['movimentacoes_estoque']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['movimentacoes_estoque']['Insert']>
      }
      contas_receber: {
        Row: {
          id: string
          pedido_id: string | null
          cliente_id: string
          descricao: string | null
          valor: number
          valor_pago: number
          status: string
          data_emissao: string
          data_vencimento: string
          data_pagamento: string | null
          forma_pagamento: string | null
          observacoes: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['contas_receber']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['contas_receber']['Insert']>
      }
      contas_pagar: {
        Row: {
          id: string
          categoria: string
          descricao: string
          valor: number
          valor_pago: number
          status: string
          data_emissao: string
          data_vencimento: string
          data_pagamento: string | null
          forma_pagamento: string | null
          observacoes: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['contas_pagar']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['contas_pagar']['Insert']>
      }
      alertas: {
        Row: {
          id: string
          tipo: string
          severidade: string
          titulo: string
          mensagem: string | null
          referencia_tipo: string | null
          referencia_id: string | null
          resolvido: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['alertas']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['alertas']['Insert']>
      }
      audit_log: {
        Row: {
          id: string
          tabela: string
          operacao: string
          registro_id: string | null
          dados_antes: Json | null
          dados_depois: Json | null
          usuario_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['audit_log']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['audit_log']['Insert']>
      }
    }
    Views: {
      v_posicao_estoque: {
        Row: {
          id: string
          nome: string
          marca: string | null
          categoria: string
          embalagem: string
          volume_ml: number | null
          saldo_atual: number
          estoque_minimo: number
          custo_atual: number
          custo_medio: number
          valor_total: number
          status_estoque: 'ok' | 'alerta' | 'critico' | 'ruptura'
          preco_venda_padrao: number
          ativo: boolean
        }
      }
      v_aging_receber: {
        Row: {
          id: string
          cliente: string
          valor: number
          valor_pago: number
          saldo: number
          data_vencimento: string
          dias_atraso: number
          faixa: string
          status: string
        }
      }
      v_faturamento_mensal: {
        Row: {
          mes: string
          total_pedidos: number
          receita_bruta: number
          descontos: number
          receita_liquida: number
          ticket_medio: number
        }
      }
      v_curva_abc: {
        Row: {
          produto_id: string
          nome: string
          total_unidades: number
          total_faturamento: number
          total_geral: number
          acumulado: number
          pct_acumulado: number
          classe_abc: 'A' | 'B' | 'C'
        }
      }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
