import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://jqdezlvqumzdkvvcbjtl.supabase.co',
  process.env.SUPABASE_SERVICE_KEY,
)

const clientesFix = [
  ["Bar do Tiao",              "Bar do Tião"],
  ["Distribuidora Olho d'Agua","Distribuidora Olho d'Água"],
  ["Conveniencia 24h Parada",  "Conveniência 24h Parada"],
  ["Espetinho do Carlao",      "Espetinho do Carlão"],
  ["Mercearia Dona Lucia",     "Mercearia Dona Lúcia"],
  ["Bar do Portugues",         "Bar do Português"],
]

const produtosFix = [
  ["Agua Mineral Indaia 500ml", "Água Mineral Indaiá 500ml"],
  ["Agua com Gas 500ml",        "Água com Gás 500ml"],
  ["Agua Indaia 1,5L",          "Água Indaiá 1,5L"],
]

const fornecedoresFix = [
  ["Aguas Indaia Nordeste", "Águas Indaiá Nordeste"],
]

for (const [de, para] of clientesFix) {
  const { error } = await supabase.from('clientes').update({ nome: para }).eq('nome', de)
  if (error) console.error(`Clientes "${de}":`, error.message)
  else console.log(`✓ clientes: "${de}" → "${para}"`)
}

for (const [de, para] of produtosFix) {
  const { error } = await supabase.from('produtos').update({ nome: para }).eq('nome', de)
  if (error) console.error(`Produtos "${de}":`, error.message)
  else console.log(`✓ produtos: "${de}" → "${para}"`)
}

for (const [de, para] of fornecedoresFix) {
  const { error } = await supabase.from('fornecedores').update({ nome: para }).eq('nome', de)
  if (error) console.error(`Fornecedores "${de}":`, error.message)
  else console.log(`✓ fornecedores: "${de}" → "${para}"`)
}

console.log('done')
