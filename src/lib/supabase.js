// Camada de dados — fala diretamente com o Supabase.
// Substitui completamente o Apps Script / JSONP.
import { createClient } from '@supabase/supabase-js';
import { gerarSalas } from './drawgen';

const SUPABASE_URL = 'https://cynzkhrslofjrfwibgrp.supabase.co';
// anon key — pública por design (protegida por RLS no banco).
const SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bnpraHJzbG9manJmd2liZ3JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNDU3NTAsImV4cCI6MjA5NDcyMTc1MH0.-jGE_Q_gVDfd_PTX5uY6nAehGcOxWYrmZTtSuqkbQMI';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── Helpers ─────────────────────────────────────────────────
export function norm(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function hojeISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

let _temp = null;
export async function temporadaAtiva() {
  if (_temp) return _temp;
  const { data } = await sb.from('temporadas').select('id,nome').eq('ativa', true).maybeSingle();
  _temp = data;
  return data;
}

// ── Pessoas ─────────────────────────────────────────────────
export async function listarPessoas() {
  const { data } = await sb.from('pessoas').select('id,nome,nome_norm').order('nome');
  return data || [];
}

export async function acharOuCriarPessoa(nome) {
  const limpo = String(nome || '').trim();
  if (limpo.length < 2) return null;
  const n = norm(limpo);
  const { data: achadas } = await sb
    .from('pessoas').select('id,nome,nome_norm').eq('nome_norm', n).limit(1);
  if (achadas && achadas.length) return achadas[0];
  const { data, error } = await sb
    .from('pessoas').insert({ nome: limpo, nome_norm: n }).select('id,nome,nome_norm').single();
  return error ? null : data;
}

// ── Presença ────────────────────────────────────────────────
export async function listarPresentesHoje() {
  const temp = await temporadaAtiva();
  if (!temp) return [];
  const [pres, pess] = await Promise.all([
    sb.from('presencas')
      .select('id,pessoa_id,dupla_pessoa_id,tipo,criada_em')
      .eq('temporada_id', temp.id).eq('data', hojeISO()),
    sb.from('pessoas').select('id,nome'),
  ]);
  if (pres.error || !pres.data) return [];
  const nomeDe = new Map((pess.data || []).map((p) => [p.id, p.nome]));
  return pres.data
    .map((r) => ({
      presencaId: r.id,
      pessoaId: r.pessoa_id,
      nome: nomeDe.get(r.pessoa_id) || '',
      dupla: r.dupla_pessoa_id ? nomeDe.get(r.dupla_pessoa_id) || '' : '',
      tipo: r.tipo,
      naoDebate: r.tipo === 'observador',
      hora: new Date(r.criada_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function registrarPresenca({ nome, dupla, tipo }) {
  try {
    const temp = await temporadaAtiva();
    if (!temp) return { ok: false, erro: 'Nenhuma temporada ativa.' };
    const pessoa = await acharOuCriarPessoa(nome);
    if (!pessoa) return { ok: false, erro: 'Nome inválido.' };

    let duplaId = null;
    if (tipo !== 'observador' && dupla && dupla.trim().length >= 2) {
      const d = await acharOuCriarPessoa(dupla);
      duplaId = d ? d.id : null;
    }
    const { error } = await sb.from('presencas').insert({
      temporada_id: temp.id, pessoa_id: pessoa.id, data: hojeISO(),
      dupla_pessoa_id: duplaId, tipo,
    });
    if (error) {
      if (error.code === '23505') return { ok: false, erro: 'Você já registrou presença hoje!' };
      return { ok: false, erro: 'Erro ao registrar: ' + error.message };
    }
    return { ok: true, mensagem: 'Presença registrada com sucesso!' };
  } catch (e) {
    return { ok: false, erro: String(e.message || e) };
  }
}

export async function atualizarDupla({ pessoaId, dupla }) {
  try {
    const temp = await temporadaAtiva();
    let duplaId = null;
    if (dupla && dupla.trim().length >= 2) {
      const d = await acharOuCriarPessoa(dupla);
      duplaId = d ? d.id : null;
    }
    const { error } = await sb.from('presencas')
      .update({ dupla_pessoa_id: duplaId })
      .eq('temporada_id', temp.id).eq('pessoa_id', pessoaId).eq('data', hojeISO());
    if (error) return { ok: false, erro: error.message };
    return { ok: true, mensagem: duplaId ? 'Dupla atualizada.' : 'Dupla removida.' };
  } catch (e) {
    return { ok: false, erro: String(e.message || e) };
  }
}

export async function apagarPresenca({ presencaId, senha }) {
  const { error } = await sb.rpc('apagar_presenca', {
    p_senha: senha, p_presenca_id: presencaId,
  });
  if (error) return { ok: false, erro: error.message };
  return { ok: true, mensagem: 'Presença removida.' };
}

// ── Admin / senha ───────────────────────────────────────────
export async function verificarSenha(senha) {
  const { data, error } = await sb.rpc('verificar_senha', { p_senha: senha });
  return !error && data === true;
}

// ── Draw ────────────────────────────────────────────────────
export async function salvarDraw({ salas, juizes = [], publicado = false, senha }) {
  const { error } = await sb.rpc('salvar_draw', {
    p_senha: senha,
    p_data: hojeISO(),
    p_conteudo: { salas, juizes },
    p_publicado: publicado,
  });
  if (error) return { ok: false, erro: error.message };
  return { ok: true };
}

export async function gerarDraw({ juizes = [], duplasAdmin = [], senha }) {
  try {
    const presentes = await listarPresentesHoje();
    let pessoas = presentes
      .filter((p) => !p.naoDebate)
      .map((p) => ({ nome: p.nome, dupla: p.dupla }));

    // duplas forçadas pelo admin sobrescrevem
    (duplasAdmin || []).forEach((par) => {
      pessoas.forEach((p) => {
        if (norm(p.nome) === norm(par.p1)) p.dupla = par.p2;
        if (norm(p.nome) === norm(par.p2)) p.dupla = par.p1;
      });
    });

    // remove juízes do draw
    const nj = (juizes || []).map(norm);
    pessoas = pessoas.filter((p) => !nj.includes(norm(p.nome)));
    if (!pessoas.length) return { ok: false, erro: 'Nenhum participante hoje.' };

    const salas = gerarSalas(pessoas);
    const res = await salvarDraw({ salas, juizes, publicado: false, senha });
    if (!res.ok) return res;
    return { ok: true, salas, juizes, total: pessoas.length };
  } catch (e) {
    return { ok: false, erro: String(e.message || e) };
  }
}

export async function getDrawHoje() {
  const temp = await temporadaAtiva();
  if (!temp) return null;
  const { data } = await sb.from('draws')
    .select('conteudo,publicado')
    .eq('temporada_id', temp.id).eq('data', hojeISO()).maybeSingle();
  if (!data) return null;
  return { salas: data.conteudo.salas || [], juizes: data.conteudo.juizes || [], publicado: data.publicado };
}

export async function getDrawHojePublico() {
  const draw = await getDrawHoje();
  return draw && draw.publicado ? draw : null;
}

export async function getDrawsAnteriores() {
  const temp = await temporadaAtiva();
  if (!temp) return [];
  const { data } = await sb.from('draws')
    .select('data')
    .eq('temporada_id', temp.id).eq('publicado', true)
    .order('data', { ascending: false });
  return (data || []).map((d) => d.data);
}

export async function getDrawPorData(dataISO) {
  const temp = await temporadaAtiva();
  if (!temp) return null;
  const { data } = await sb.from('draws')
    .select('conteudo')
    .eq('temporada_id', temp.id).eq('data', dataISO).maybeSingle();
  if (!data) return null;
  return { salas: data.conteudo.salas || [], juizes: data.conteudo.juizes || [] };
}

// ── Speaker points ──────────────────────────────────────────
export async function registrarSpeaks({ data, rodada = 1, lista, senha }) {
  const { error } = await sb.rpc('registrar_speaks', {
    p_senha: senha, p_data: data || hojeISO(), p_rodada: rodada, p_lista: lista,
  });
  if (error) return { ok: false, erro: error.message };
  return { ok: true };
}

// ── Temporada / dedup ───────────────────────────────────────
export async function criarTemporada({ nome, senha }) {
  const { error } = await sb.rpc('criar_temporada', { p_senha: senha, p_nome: nome });
  if (error) return { ok: false, erro: error.message };
  _temp = null; // limpa cache da temporada
  return { ok: true };
}

export async function mesclarPessoas({ manter, remover, senha }) {
  const { error } = await sb.rpc('mesclar_pessoas', {
    p_senha: senha, p_manter: manter, p_remover: remover,
  });
  if (error) return { ok: false, erro: error.message };
  return { ok: true };
}
