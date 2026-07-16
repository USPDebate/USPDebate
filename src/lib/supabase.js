// Camada de dados — fala diretamente com o Supabase.
// Substitui completamente o Apps Script / JSONP.
import { createClient } from '@supabase/supabase-js';
import { gerarSalas } from './drawgen';

const SUPABASE_URL = 'https://cynzkhrslofjrfwibgrp.supabase.co';
// anon key — pública por design (protegida por RLS no banco).
const SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bnpraHJzbG9manJmd2liZ3JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNDU3NTAsImV4cCI6MjA5NDcyMTc1MH0.-jGE_Q_gVDfd_PTX5uY6nAehGcOxWYrmZTtSuqkbQMI';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── Retry com backoff exponencial ───────────────────────────
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

function isTransientError(error) {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  const code = error.code || '';
  // Network errors, timeouts, rate limits
  return code === 'PGRST116' || msg.includes('network') || msg.includes('timeout') || msg.includes('429');
}

async function withRetry(fn, context = '') {
  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (!isTransientError(e) || attempt === MAX_RETRIES - 1) throw e;
      const delayMs = BASE_DELAY_MS * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

// Mapeamento legível de códigos de erro Supabase
function descricaoErro(error) {
  if (!error) return 'Erro desconhecido';
  const code = error.code || '';
  const msg = error.message || '';

  if (code === '23505') return 'Registro duplicado — verifique os dados';
  if (code === '42P01') return 'Tabela não encontrada no banco de dados';
  if (code === 'PGRST116') return 'Erro de autenticação ou permissão insuficiente';
  if (msg.includes('network') || msg.includes('ECONNREFUSED')) return 'Erro de rede — verifique sua conexão';
  if (msg.includes('timeout')) return 'Operação expirou — tente novamente';
  return msg || 'Erro desconhecido';
}

// ── Real-time subscriptions ─────────────────────────────────
export function subscrevePresenca(data, callback) {
  const temp = temporadaAtiva();
  temp.then(t => {
    if (!t) return;
    const channel = sb.channel(`presenca:${t.id}:${data}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'presencas',
        filter: `temporada_id=eq.${t.id} AND data=eq.${data}` }, callback)
      .subscribe();
    return () => channel.unsubscribe();
  });
}

export function subscreveSpeaks(callback) {
  const temp = temporadaAtiva();
  temp.then(t => {
    if (!t) return;
    const channel = sb.channel(`speaks:${t.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'speaker_points',
        filter: `temporada_id=eq.${t.id}` }, callback)
      .subscribe();
    return () => channel.unsubscribe();
  });
}

export function inscreveDraws(data, callback) {
  const temp = temporadaAtiva();
  temp.then(t => {
    if (!t) return;
    const channel = sb.channel(`draws:${t.id}:${data}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'draws',
        filter: `temporada_id=eq.${t.id} AND data=eq.${data}` }, callback)
      .subscribe();
    return () => channel.unsubscribe();
  });
}

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
  try {
    const { data, error } = await withRetry(() =>
      sb.from('pessoas').select('id,nome,nome_norm').order('nome')
    );
    if (error) {
      console.error('Erro ao listar pessoas:', descricaoErro(error));
      return [];
    }
    return data || [];
  } catch (e) {
    console.error('listarPessoas falhou:', descricaoErro(e));
    return [];
  }
}

export async function acharOuCriarPessoa(nome) {
  const limpo = String(nome || '').trim();
  if (limpo.length < 2) return null;
  const n = norm(limpo);
  try {
    const { data: achadas } = await withRetry(
      () => sb.from('pessoas').select('id,nome,nome_norm').eq('nome_norm', n).limit(1)
    );
    if (achadas && achadas.length) return achadas[0];

    const { data, error } = await withRetry(
      () => sb.from('pessoas').insert({ nome: limpo, nome_norm: n }).select('id,nome,nome_norm').single()
    );
    if (error) {
      console.error('Erro ao criar pessoa:', descricaoErro(error));
      return null;
    }
    return data;
  } catch (e) {
    console.error('acharOuCriarPessoa falhou:', descricaoErro(e));
    return null;
  }
}

// ── Presença ────────────────────────────────────────────────
export async function listarPresentes(dataISO) {
  const temp = await temporadaAtiva();
  if (!temp) return [];
  try {
    const [{ data: presData, error: presErr }, { data: pessData }] = await Promise.all([
      withRetry(() => sb.from('presencas')
        .select('id,pessoa_id,dupla_pessoa_id,tipo,criada_em')
        .eq('temporada_id', temp.id).eq('data', dataISO)),
      withRetry(() => sb.from('pessoas').select('id,nome')),
    ]);
    if (presErr || !presData) {
      console.error('Erro ao listar presentes:', descricaoErro(presErr));
      return [];
    }
    const nomeDe = new Map((pessData || []).map((p) => [p.id, p.nome]));
    return presData
      .map((r) => ({
        presencaId: r.id,
        pessoaId: r.pessoa_id,
        nome: nomeDe.get(r.pessoa_id) || '',
        dupla: r.dupla_pessoa_id ? nomeDe.get(r.dupla_pessoa_id) || '' : '',
        tipo: r.tipo,
        naoDebate: r.tipo === 'observador' || r.tipo === 'juiz',
        hora: new Date(r.criada_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  } catch (e) {
    console.error('listarPresentes falhou:', descricaoErro(e));
    return [];
  }
}

export async function listarPresentesHoje() {
  return listarPresentes(hojeISO());
}

// Datas (treinos) que têm presença registrada — mais recente primeiro.
export async function getDatasPresenca() {
  const temp = await temporadaAtiva();
  if (!temp) return [];
  try {
    const { data, error } = await withRetry(() =>
      sb.from('presencas').select('data').eq('temporada_id', temp.id)
    );
    if (error || !data) return [];
    return [...new Set(data.map((r) => r.data))].sort().reverse();
  } catch (e) {
    console.error('getDatasPresenca falhou:', descricaoErro(e));
    return [];
  }
}

// Datas que têm speaker points registrados.
export async function getDatasSpeaks() {
  const temp = await temporadaAtiva();
  if (!temp) return [];
  try {
    const { data, error } = await withRetry(() =>
      sb.from('speaker_points').select('data').eq('temporada_id', temp.id)
    );
    if (error || !data) return [];
    return [...new Set(data.map((r) => r.data))].sort().reverse();
  } catch (e) {
    console.error('getDatasSpeaks falhou:', descricaoErro(e));
    return [];
  }
}

// Apaga todos os speaker points de um treino (limpa testes).
export async function apagarSpeaksData({ data, senha }) {
  try {
    const { error } = await withRetry(() =>
      sb.rpc('apagar_speaks_data', { p_senha: senha, p_data: data })
    );
    if (error) return { ok: false, erro: descricaoErro(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: descricaoErro(e) };
  }
}

export async function registrarPresenca({ nome, dupla, tipo }) {
  try {
    const temp = await temporadaAtiva();
    if (!temp) return { ok: false, erro: 'Nenhuma temporada ativa.' };
    const pessoa = await acharOuCriarPessoa(nome);
    if (!pessoa) return { ok: false, erro: 'Nome inválido.' };

    let duplaId = null;
    if (tipo === 'ps' && dupla && dupla.trim().length >= 2) {
      const d = await acharOuCriarPessoa(dupla);
      duplaId = d ? d.id : null;
    }
    const { error } = await withRetry(() =>
      sb.from('presencas').insert({
        temporada_id: temp.id, pessoa_id: pessoa.id, data: hojeISO(),
        dupla_pessoa_id: duplaId, tipo,
      })
    );
    if (error) {
      if (error.code === '23505') return { ok: false, erro: 'Você já registrou presença hoje!' };
      return { ok: false, erro: descricaoErro(error) };
    }
    return { ok: true, mensagem: 'Presença registrada com sucesso!' };
  } catch (e) {
    return { ok: false, erro: descricaoErro(e) };
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
    const { error } = await withRetry(() =>
      sb.from('presencas')
        .update({ dupla_pessoa_id: duplaId })
        .eq('temporada_id', temp.id).eq('pessoa_id', pessoaId).eq('data', hojeISO())
    );
    if (error) return { ok: false, erro: descricaoErro(error) };
    return { ok: true, mensagem: duplaId ? 'Dupla atualizada.' : 'Dupla removida.' };
  } catch (e) {
    return { ok: false, erro: descricaoErro(e) };
  }
}

export async function apagarPresenca({ presencaId, senha }) {
  try {
    const { error } = await withRetry(() =>
      sb.rpc('apagar_presenca', {
        p_senha: senha, p_presenca_id: presencaId,
      })
    );
    if (error) return { ok: false, erro: descricaoErro(error) };
    return { ok: true, mensagem: 'Presença removida.' };
  } catch (e) {
    return { ok: false, erro: descricaoErro(e) };
  }
}

// ── Admin / senha ───────────────────────────────────────────
export async function verificarSenha(senha) {
  try {
    const { data, error } = await withRetry(() =>
      sb.rpc('verificar_senha', { p_senha: senha })
    );
    return !error && data === true;
  } catch (e) {
    console.error('verificarSenha falhou:', descricaoErro(e));
    return false;
  }
}

// ── Draw ────────────────────────────────────────────────────
export async function salvarDraw({ salas, juizes = [], publicado = false, senha }) {
  try {
    const { error } = await withRetry(() =>
      sb.rpc('salvar_draw', {
        p_senha: senha,
        p_data: hojeISO(),
        p_conteudo: { salas, juizes },
        p_publicado: publicado,
      })
    );
    if (error) return { ok: false, erro: descricaoErro(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: descricaoErro(e) };
  }
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
    return { ok: false, erro: descricaoErro(e) };
  }
}

export async function getDrawHoje() {
  const temp = await temporadaAtiva();
  if (!temp) return null;
  try {
    const { data, error } = await withRetry(() =>
      sb.from('draws')
        .select('conteudo,publicado')
        .eq('temporada_id', temp.id).eq('data', hojeISO()).maybeSingle()
    );
    if (error || !data) return null;
    return { salas: data.conteudo.salas || [], juizes: data.conteudo.juizes || [], publicado: data.publicado };
  } catch (e) {
    console.error('getDrawHoje falhou:', descricaoErro(e));
    return null;
  }
}

export async function getDrawHojePublico() {
  const draw = await getDrawHoje();
  return draw && draw.publicado ? draw : null;
}

export async function getDrawsAnteriores() {
  const temp = await temporadaAtiva();
  if (!temp) return [];
  try {
    const { data, error } = await withRetry(() =>
      sb.from('draws')
        .select('data')
        .eq('temporada_id', temp.id).eq('publicado', true)
        .order('data', { ascending: false })
    );
    if (error || !data) return [];
    return data.map((d) => d.data);
  } catch (e) {
    console.error('getDrawsAnteriores falhou:', descricaoErro(e));
    return [];
  }
}

export async function getDrawPorData(dataISO) {
  const temp = await temporadaAtiva();
  if (!temp) return null;
  try {
    const { data, error } = await withRetry(() =>
      sb.from('draws')
        .select('conteudo')
        .eq('temporada_id', temp.id).eq('data', dataISO).maybeSingle()
    );
    if (error || !data) return null;
    return { salas: data.conteudo.salas || [], juizes: data.conteudo.juizes || [] };
  } catch (e) {
    console.error('getDrawPorData falhou:', descricaoErro(e));
    return null;
  }
}

// ── Speaker points ──────────────────────────────────────────
// Registro feito pelo juiz da sala — sem senha (upsert idempotente).
// lista = [{ pessoa_id, sala, posicao, speaks, juiz }]
export async function registrarSpeaks({ data, lista }) {
  const temp = await temporadaAtiva();
  if (!temp) return { ok: false, erro: 'Nenhuma temporada ativa.' };
  const dataISO = data || hojeISO();
  try {
    const rows = lista.map((x) => ({
      temporada_id: temp.id,
      pessoa_id: x.pessoa_id,
      data: dataISO,
      rodada: 1,
      sala: x.sala,
      posicao: x.posicao,
      speaks: x.speaks,
      juiz: x.juiz || null,
    }));
    const { error } = await withRetry(() =>
      sb.from('speaker_points')
        .upsert(rows, { onConflict: 'temporada_id,pessoa_id,data,rodada' })
    );
    if (error) return { ok: false, erro: descricaoErro(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: descricaoErro(e) };
  }
}

// Sala manual (treino organizado): mescla a sala no draw do dia.
export async function adicionarSalaManual({ data, sala }) {
  try {
    const { error } = await withRetry(() =>
      sb.rpc('adicionar_sala_manual', {
        p_data: data || hojeISO(),
        p_sala: sala,
      })
    );
    if (error) return { ok: false, erro: descricaoErro(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: descricaoErro(e) };
  }
}

// Salas que já tiveram speaks registrados hoje (com o juiz que registrou).
export async function getSpeaksDoDia() {
  const temp = await temporadaAtiva();
  if (!temp) return [];
  try {
    const { data, error } = await withRetry(() =>
      sb.from('speaker_points')
        .select('pessoa_id,sala,juiz')
        .eq('temporada_id', temp.id).eq('data', hojeISO())
    );
    if (error) {
      console.error('Erro ao buscar speaks do dia:', descricaoErro(error));
      return [];
    }
    return data || [];
  } catch (e) {
    console.error('getSpeaksDoDia falhou:', descricaoErro(e));
    return [];
  }
}

// Todos os speaks da temporada ativa — base do dashboard.
export async function getSpeaks() {
  const temp = await temporadaAtiva();
  if (!temp) return [];
  try {
    const [{ data: spData, error: spErr }, { data: pessData }] = await Promise.all([
      withRetry(() =>
        sb.from('speaker_points')
          .select('pessoa_id,data,sala,posicao,speaks,juiz')
          .eq('temporada_id', temp.id)
      ),
      withRetry(() => sb.from('pessoas').select('id,nome')),
    ]);
    if (spErr || !spData) {
      console.error('Erro ao buscar speaks:', descricaoErro(spErr));
      return [];
    }
    const nomeDe = new Map((pessData || []).map((p) => [p.id, p.nome]));
    return spData.map((r) => ({
      pessoaId: r.pessoa_id,
      nome: nomeDe.get(r.pessoa_id) || '',
      data: r.data,
      sala: r.sala,
      posicao: r.posicao,
      speaks: Number(r.speaks),
      juiz: r.juiz || '',
    }));
  } catch (e) {
    console.error('getSpeaks falhou:', descricaoErro(e));
    return [];
  }
}

// ── Temporada / dedup ───────────────────────────────────────
export async function criarTemporada({ nome, senha }) {
  try {
    const { error } = await withRetry(() =>
      sb.rpc('criar_temporada', { p_senha: senha, p_nome: nome })
    );
    if (error) return { ok: false, erro: descricaoErro(error) };
    _temp = null; // limpa cache da temporada
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: descricaoErro(e) };
  }
}

export async function mesclarPessoas({ manter, remover, senha }) {
  try {
    const { error } = await withRetry(() =>
      sb.rpc('mesclar_pessoas', {
        p_senha: senha, p_manter: manter, p_remover: remover,
      })
    );
    if (error) return { ok: false, erro: descricaoErro(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: descricaoErro(e) };
  }
}

export async function apagarPessoa({ pessoaId, senha }) {
  try {
    const { error } = await withRetry(() =>
      sb.rpc('apagar_pessoa', {
        p_senha: senha, p_pessoa_id: pessoaId,
      })
    );
    if (error) return { ok: false, erro: descricaoErro(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: descricaoErro(e) };
  }
}

// ── Trainees ────────────────────────────────────────────────
export async function getTrainees() {
  const temp = await temporadaAtiva();
  if (!temp) return [];
  try {
    const [{ data: trData, error: trErr }, { data: pessData }] = await Promise.all([
      withRetry(() => sb.from('trainees').select('pessoa_id,mentor').eq('temporada_id', temp.id)),
      withRetry(() => sb.from('pessoas').select('id,nome')),
    ]);
    if (trErr || !trData) return [];
    const nomeDe = new Map((pessData || []).map((p) => [p.id, p.nome]));
    return trData
      .map((t) => ({ pessoaId: t.pessoa_id, nome: nomeDe.get(t.pessoa_id) || '', mentor: t.mentor || '' }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  } catch (e) {
    console.error('getTrainees falhou:', descricaoErro(e));
    return [];
  }
}

export async function getTraineeSemanas() {
  const temp = await temporadaAtiva();
  if (!temp) return [];
  try {
    const { data, error } = await withRetry(() =>
      sb.from('trainee_semanas')
        .select('id,nome,data_inicio,data_fim')
        .eq('temporada_id', temp.id).order('data_inicio')
    );
    if (error) {
      console.error('Erro ao buscar semanas trainee:', descricaoErro(error));
      return [];
    }
    return data || [];
  } catch (e) {
    console.error('getTraineeSemanas falhou:', descricaoErro(e));
    return [];
  }
}

export async function getTraineeFormacoes() {
  const temp = await temporadaAtiva();
  if (!temp) return [];
  try {
    const { data, error } = await withRetry(() =>
      sb.from('trainee_formacoes')
        .select('pessoa_id,semana_id').eq('temporada_id', temp.id)
    );
    if (error) {
      console.error('Erro ao buscar formações trainee:', descricaoErro(error));
      return [];
    }
    return data || [];
  } catch (e) {
    console.error('getTraineeFormacoes falhou:', descricaoErro(e));
    return [];
  }
}

export async function getPresencasRaw() {
  const temp = await temporadaAtiva();
  if (!temp) return [];
  try {
    const { data, error } = await withRetry(() =>
      sb.from('presencas')
        .select('pessoa_id,data').eq('temporada_id', temp.id)
    );
    if (error) {
      console.error('Erro ao buscar presenças raw:', descricaoErro(error));
      return [];
    }
    return data || [];
  } catch (e) {
    console.error('getPresencasRaw falhou:', descricaoErro(e));
    return [];
  }
}

// lista = [{ nome, mentor }]
export async function importarTrainees(lista) {
  const temp = await temporadaAtiva();
  if (!temp) return { ok: false, erro: 'Nenhuma temporada ativa.' };
  try {
    const rows = [];
    for (const item of lista) {
      const p = await acharOuCriarPessoa(item.nome);
      if (p) rows.push({ temporada_id: temp.id, pessoa_id: p.id, mentor: item.mentor || null });
    }
    if (!rows.length) return { ok: false, erro: 'Nenhum nome válido.' };
    const { error } = await withRetry(() =>
      sb.from('trainees')
        .upsert(rows, { onConflict: 'temporada_id,pessoa_id' })
    );
    if (error) return { ok: false, erro: descricaoErro(error) };
    return { ok: true, n: rows.length };
  } catch (e) {
    return { ok: false, erro: descricaoErro(e) };
  }
}

export async function resetarTrainees() {
  const temp = await temporadaAtiva();
  if (!temp) return { ok: false, erro: 'Nenhuma temporada ativa.' };
  try {
    await withRetry(() =>
      sb.from('trainee_formacoes').delete().eq('temporada_id', temp.id)
    );
    const { error } = await withRetry(() =>
      sb.from('trainees').delete().eq('temporada_id', temp.id)
    );
    if (error) return { ok: false, erro: descricaoErro(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: descricaoErro(e) };
  }
}

// Uma semana = um período (seg–dom). Numeração é derivada da ordem no front.
export async function criarSemana({ inicio, fim }) {
  const temp = await temporadaAtiva();
  if (!temp) return { ok: false, erro: 'Nenhuma temporada ativa.' };
  try {
    const { error } = await withRetry(() =>
      sb.from('trainee_semanas')
        .insert({ temporada_id: temp.id, nome: '', data_inicio: inicio, data_fim: fim })
    );
    if (error) return { ok: false, erro: descricaoErro(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: descricaoErro(e) };
  }
}

export async function editarSemana({ id, inicio, fim }) {
  try {
    const { error } = await withRetry(() =>
      sb.from('trainee_semanas')
        .update({ data_inicio: inicio, data_fim: fim }).eq('id', id)
    );
    if (error) return { ok: false, erro: descricaoErro(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: descricaoErro(e) };
  }
}

export async function apagarSemana(id) {
  try {
    const { error } = await withRetry(() =>
      sb.from('trainee_semanas').delete().eq('id', id)
    );
    if (error) return { ok: false, erro: descricaoErro(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: descricaoErro(e) };
  }
}

// Apaga o draw do dia (rascunho ou publicado).
export async function apagarDrawDia({ data, senha }) {
  try {
    const { error } = await withRetry(() =>
      sb.rpc('apagar_draw_dia', {
        p_senha: senha, p_data: data,
      })
    );
    if (error) return { ok: false, erro: descricaoErro(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: descricaoErro(e) };
  }
}

// Lista todos os speaks de uma data, com nome da pessoa.
export async function getSpeaksDeData(data) {
  const temp = await temporadaAtiva();
  if (!temp) return [];
  try {
    const [{ data: spData, error: spErr }, { data: pessData }] = await Promise.all([
      withRetry(() =>
        sb.from('speaker_points')
          .select('id,pessoa_id,sala,posicao,speaks,juiz')
          .eq('temporada_id', temp.id).eq('data', data)
          .order('sala').order('posicao')
      ),
      withRetry(() => sb.from('pessoas').select('id,nome')),
    ]);
    if (spErr || !spData) {
      console.error('Erro ao buscar speaks de data:', descricaoErro(spErr));
      return [];
    }
    const nomeDe = new Map((pessData || []).map((p) => [p.id, p.nome]));
    return spData.map((r) => ({
      id: r.id, pessoaId: r.pessoa_id, nome: nomeDe.get(r.pessoa_id) || '',
      sala: r.sala, posicao: r.posicao, speaks: Number(r.speaks), juiz: r.juiz || '',
    }));
  } catch (e) {
    console.error('getSpeaksDeData falhou:', descricaoErro(e));
    return [];
  }
}

export async function editarSpeak({ id, pessoaId, speaks, senha }) {
  try {
    const { error } = await withRetry(() =>
      sb.rpc('editar_speak', {
        p_senha: senha, p_id: id,
        p_pessoa_id: pessoaId ?? null, p_speaks: speaks ?? null,
      })
    );
    if (error) return { ok: false, erro: descricaoErro(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: descricaoErro(e) };
  }
}

export async function apagarSpeak({ id, senha }) {
  try {
    const { error } = await withRetry(() =>
      sb.rpc('apagar_speak', { p_senha: senha, p_id: id })
    );
    if (error) return { ok: false, erro: descricaoErro(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: descricaoErro(e) };
  }
}

export async function inserirSpeak({ pessoaId, data, sala, posicao, speaks, juiz, senha }) {
  try {
    const { error } = await withRetry(() =>
      sb.rpc('inserir_speak', {
        p_senha: senha, p_pessoa_id: pessoaId, p_data: data,
        p_sala: sala, p_posicao: posicao, p_speaks: speaks, p_juiz: juiz || null,
      })
    );
    if (error) return { ok: false, erro: descricaoErro(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: descricaoErro(e) };
  }
}

// Correção manual de presença num treino (admin).
export async function marcarPresenca({ pessoaId, data, presente, senha }) {
  try {
    const { error } = await withRetry(() =>
      sb.rpc('marcar_presenca', {
        p_senha: senha, p_pessoa_id: pessoaId, p_data: data, p_presente: presente,
      })
    );
    if (error) return { ok: false, erro: descricaoErro(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: descricaoErro(e) };
  }
}

export async function toggleFormacao({ pessoaId, semanaId, feito }) {
  const temp = await temporadaAtiva();
  if (!temp) return { ok: false };
  try {
    if (feito) {
      const { error } = await withRetry(() =>
        sb.from('trainee_formacoes')
          .upsert({ temporada_id: temp.id, pessoa_id: pessoaId, semana_id: semanaId },
            { onConflict: 'pessoa_id,semana_id' })
      );
      return { ok: !error };
    }
    const { error } = await withRetry(() =>
      sb.from('trainee_formacoes')
        .delete().eq('pessoa_id', pessoaId).eq('semana_id', semanaId)
    );
    return { ok: !error };
  } catch (e) {
    console.error('toggleFormacao falhou:', descricaoErro(e));
    return { ok: false };
  }
}
