// Compressão de imagem no cliente, antes de subir para o Storage.
// Sem isso o plano não fecha: foto de celular sai com 3–5 MB, o bucket tem
// teto de 1 MB por arquivo e a quota do plano gratuito é de 1 GB no total.
// Depois de passar por aqui, uma foto de formação fica em 150–350 KB.

const MAX_LADO = 1600;
const QUALIDADE = 0.75;
const TETO_BYTES = 1024 * 1024;      // teto do bucket
const ALVO_BYTES = 900 * 1024;       // margem de segurança abaixo do teto
const MAX_ENTRADA = 25 * 1024 * 1024;

// createImageBitmap respeita o EXIF de orientação — foto tirada deitada não
// sobe de lado. O fallback existe para navegador antigo.
async function carregar(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (e) { /* cai no fallback */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
}

function suportaWebp() {
  try {
    return document.createElement('canvas')
      .toDataURL('image/webp').startsWith('data:image/webp');
  } catch (e) {
    return false;
  }
}

function paraBlob(canvas, tipo, q) {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, q));
}

// Devolve { blob, ext } ou { erro }.
export async function comprimirImagem(file) {
  if (!file) return { erro: 'Escolha uma imagem.' };
  if (file.size > MAX_ENTRADA) {
    return { erro: 'Imagem grande demais (máximo 25 MB).' };
  }

  let src;
  try {
    src = await carregar(file);
  } catch (e) {
    return { erro: 'Não consegui ler essa imagem. Tente enviar como JPEG.' };
  }

  const w = src.width || src.naturalWidth;
  const h = src.height || src.naturalHeight;
  if (!w || !h) return { erro: 'Não consegui ler essa imagem. Tente enviar como JPEG.' };

  const escala = Math.min(1, MAX_LADO / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * escala));
  const ch = Math.max(1, Math.round(h * escala));

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  // PNG com transparência viraria preto no JPEG: pinta o fundo de branco.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(src, 0, 0, cw, ch);
  if (typeof src.close === 'function') src.close();

  const webp = suportaWebp();
  const tipo = webp ? 'image/webp' : 'image/jpeg';

  let q = QUALIDADE;
  let blob = await paraBlob(canvas, tipo, q);
  while (blob && blob.size > ALVO_BYTES && q > 0.35) {
    q -= 0.15;
    blob = await paraBlob(canvas, tipo, q);
  }

  if (!blob) return { erro: 'Não consegui processar essa imagem.' };
  if (blob.size > TETO_BYTES) {
    return { erro: 'A imagem continua grande demais depois de comprimir.' };
  }
  return { blob, ext: webp ? 'webp' : 'jpg' };
}

export function tamanhoLegivel(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
