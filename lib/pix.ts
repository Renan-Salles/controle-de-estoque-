// Gerador de BR Code Pix estatico com valor (padrao EMV/BACEN). Funcao
// pura, sem dependencia -- o QR em si e renderizado pela lib 'qrcode' no
// client. Testavel via node: gerarPayloadPix({...}).

function campo(id: string, valor: string): string {
  const len = String(valor.length).padStart(2, '0')
  return `${id}${len}${valor}`
}

// CRC16-CCITT (polinomio 0x1021, inicial 0xFFFF) sobre o payload com o
// placeholder "6304" no final -- exatamente como o BACEN especifica.
function crc16(payload: string): string {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

// Nome/cidade no padrao: sem acento, maiusculas, tamanho maximo do EMV.
function sanitizar(texto: string, max: number): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, max)
}

export function gerarPayloadPix({
  chave,
  valor,
  nome,
  cidade,
}: {
  chave: string
  valor: number
  nome: string
  cidade: string
}): string {
  const mai = campo('26', campo('00', 'br.gov.bcb.pix') + campo('01', chave.trim()))
  const adicional = campo('62', campo('05', '***'))
  const semCrc =
    campo('00', '01') +
    mai +
    campo('52', '0000') +
    campo('53', '986') +
    campo('54', valor.toFixed(2)) +
    campo('58', 'BR') +
    campo('59', sanitizar(nome, 25) || 'DEPOSITO') +
    campo('60', sanitizar(cidade, 15) || 'BRASIL') +
    adicional +
    '6304'
  return semCrc + crc16(semCrc)
}
