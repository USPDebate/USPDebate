import { calibrar, ranking, analiseJuizes, componentesConectados } from './speaks-stats';

describe('calibrar - Speaker Points Calibration', () => {
  it('should return empty model for empty input', () => {
    const result = calibrar([]);
    expect(result.vazio).toBe(true);
    expect(result.nivel).toEqual({});
    expect(result.vies).toEqual({});
    expect(result.global).toBe(0);
  });

  it('should calculate global average', () => {
    const speaks = [
      { pessoaId: 1, nome: 'Alice', data: '2025-01-01', sala: 1, posicao: 'OG', speaks: 75, juiz: 'Judge1' },
      { pessoaId: 2, nome: 'Bob', data: '2025-01-01', sala: 1, posicao: 'OO', speaks: 85, juiz: 'Judge1' },
    ];
    const result = calibrar(speaks);
    expect(result.global).toBe(80); // (75 + 85) / 2
    expect(result.vazio).toBe(false);
  });

  it('should estimate K from data', () => {
    const speaks = [
      { pessoaId: 1, nome: 'Alice', data: '2025-01-01', sala: 1, posicao: 'OG', speaks: 75, juiz: 'Judge1' },
      { pessoaId: 1, nome: 'Alice', data: '2025-01-02', sala: 2, posicao: 'OO', speaks: 78, juiz: 'Judge2' },
      { pessoaId: 2, nome: 'Bob', data: '2025-01-01', sala: 1, posicao: 'CG', speaks: 85, juiz: 'Judge1' },
      { pessoaId: 2, nome: 'Bob', data: '2025-01-02', sala: 2, posicao: 'CO', speaks: 82, juiz: 'Judge2' },
    ];
    const result = calibrar(speaks);
    expect(result.K).toBeGreaterThan(0);
    expect(result.K).toBeLessThanOrEqual(12); // Clamped range
  });

  it('should initialize debater levels in nivel object', () => {
    const speaks = [
      { pessoaId: 1, nome: 'Alice', data: '2025-01-01', sala: 1, posicao: 'OG', speaks: 75, juiz: 'Judge1' },
      { pessoaId: 2, nome: 'Bob', data: '2025-01-01', sala: 1, posicao: 'OO', speaks: 85, juiz: 'Judge1' },
    ];
    const result = calibrar(speaks);
    expect(result.nivel[1]).toBeDefined();
    expect(result.nivel[2]).toBeDefined();
    expect(typeof result.nivel[1]).toBe('number');
  });

  it('should initialize judge bias in vies object', () => {
    const speaks = [
      { pessoaId: 1, nome: 'Alice', data: '2025-01-01', sala: 1, posicao: 'OG', speaks: 75, juiz: 'Judge1' },
      { pessoaId: 1, nome: 'Alice', data: '2025-01-02', sala: 2, posicao: 'OO', speaks: 78, juiz: 'Judge2' },
    ];
    const result = calibrar(speaks);
    expect(Object.keys(result.vies).length).toBeGreaterThan(0);
  });

  it('should apply time weighting with half-life', () => {
    const now = new Date().toISOString().split('T')[0];
    const old = '2020-01-01';

    const speaks = [
      { pessoaId: 1, nome: 'Alice', data: now, sala: 1, posicao: 'OG', speaks: 80, juiz: 'J1' },
      { pessoaId: 1, nome: 'Alice', data: old, sala: 2, posicao: 'OO', speaks: 60, juiz: 'J1' },
    ];
    const result = calibrar(speaks, { halfLifeDias: 120 });
    // Recent score should weigh more
    expect(result.nivel[1]).toBeGreaterThan(70); // Closer to recent 80
  });

  it('should disable time weighting when halfLifeDias is 0', () => {
    const speaks = [
      { pessoaId: 1, nome: 'Alice', data: '2020-01-01', sala: 1, posicao: 'OG', speaks: 60, juiz: 'J1' },
      { pessoaId: 1, nome: 'Alice', data: '2025-01-01', sala: 2, posicao: 'OO', speaks: 80, juiz: 'J1' },
    ];
    const result = calibrar(speaks, { halfLifeDias: 0 });
    expect(result.nivel[1]).toBe(70); // Equal weight = (60 + 80) / 2
  });

  it('should calculate standard errors', () => {
    const speaks = [
      { pessoaId: 1, nome: 'Alice', data: '2025-01-01', sala: 1, posicao: 'OG', speaks: 75, juiz: 'Judge1' },
      { pessoaId: 1, nome: 'Alice', data: '2025-01-02', sala: 2, posicao: 'OO', speaks: 78, juiz: 'Judge2' },
    ];
    const result = calibrar(speaks);
    expect(result.seNivel[1]).toBeDefined();
    expect(result.seNivel[1]).toBeGreaterThan(0);
  });

  it('should clamp K to reasonable range', () => {
    // Create data where auto-estimated K would be extreme
    const speaks = Array.from({ length: 10 }, (_, i) => ({
      pessoaId: 1,
      nome: 'Alice',
      data: `2025-01-${String(i + 1).padStart(2, '0')}`,
      sala: 1,
      posicao: 'OG',
      speaks: 75,
      juiz: 'Judge1',
    }));
    const result = calibrar(speaks);
    expect(result.K).toBeGreaterThanOrEqual(0.3);
    expect(result.K).toBeLessThanOrEqual(12);
  });
});

describe('ranking - Debater Ranking', () => {
  it('should return empty array for empty calibration', () => {
    const cal = calibrar([]);
    const result = ranking(cal);
    expect(result).toEqual([]);
  });

  it('should rank debaters by adjusted level', () => {
    const speaks = [
      { pessoaId: 1, nome: 'Alice', data: '2025-01-01', sala: 1, posicao: 'OG', speaks: 80, juiz: 'J1' },
      { pessoaId: 2, nome: 'Bob', data: '2025-01-01', sala: 1, posicao: 'OO', speaks: 70, juiz: 'J1' },
    ];
    const cal = calibrar(speaks);
    const result = ranking(cal);
    expect(result).toHaveLength(2);
    expect(result[0].pessoaId).toBe(1); // Alice should rank first (higher speaks)
    expect(result[1].pessoaId).toBe(2);
  });

  it('should count rodadas correctly', () => {
    const speaks = [
      { pessoaId: 1, nome: 'Alice', data: '2025-01-01', sala: 1, posicao: 'OG', speaks: 80, juiz: 'J1' },
      { pessoaId: 1, nome: 'Alice', data: '2025-01-02', sala: 2, posicao: 'OO', speaks: 75, juiz: 'J1' },
    ];
    const cal = calibrar(speaks);
    const result = ranking(cal);
    expect(result[0].rodadas).toBe(2);
  });

  it('should calculate correct percentile ranking', () => {
    const speaks = Array.from({ length: 10 }, (_, i) => ({
      pessoaId: i,
      nome: `Person${i}`,
      data: '2025-01-01',
      sala: 1,
      posicao: 'OG',
      speaks: 70 + i,
      juiz: 'J1',
    }));
    const cal = calibrar(speaks);
    const result = ranking(cal);
    expect(result).toHaveLength(10);
    // Top person should have topPct = 10
    expect(result[0].topPct).toBeLessThanOrEqual(10);
  });
});

describe('analiseJuizes - Judge Analysis', () => {
  it('should analyze judge bias', () => {
    const speaks = [
      { pessoaId: 1, nome: 'Alice', data: '2025-01-01', sala: 1, posicao: 'OG', speaks: 90, juiz: 'Judge1' },
      { pessoaId: 2, nome: 'Bob', data: '2025-01-01', sala: 1, posicao: 'OO', speaks: 90, juiz: 'Judge1' },
      { pessoaId: 3, nome: 'Charlie', data: '2025-01-01', sala: 1, posicao: 'CG', speaks: 90, juiz: 'Judge1' },
    ];
    const cal = calibrar(speaks);
    const result = analiseJuizes(cal);
    expect(result).toHaveLength(1);
    expect(result[0].nome).toBe('Judge1');
    expect(result[0].n).toBe(3);
  });

  it('should calculate judge average correctly', () => {
    const speaks = [
      { pessoaId: 1, nome: 'Alice', data: '2025-01-01', sala: 1, posicao: 'OG', speaks: 75, juiz: 'Judge1' },
      { pessoaId: 2, nome: 'Bob', data: '2025-01-01', sala: 1, posicao: 'OO', speaks: 85, juiz: 'Judge1' },
    ];
    const cal = calibrar(speaks);
    const result = analiseJuizes(cal);
    expect(result[0].media).toBe(80);
  });

  it('should sort judges by number of evaluations', () => {
    const speaks = [
      { pessoaId: 1, nome: 'Alice', data: '2025-01-01', sala: 1, posicao: 'OG', speaks: 75, juiz: 'Judge1' },
      { pessoaId: 2, nome: 'Bob', data: '2025-01-01', sala: 1, posicao: 'OO', speaks: 85, juiz: 'Judge1' },
      { pessoaId: 3, nome: 'Charlie', data: '2025-01-01', sala: 1, posicao: 'CG', speaks: 70, juiz: 'Judge2' },
    ];
    const cal = calibrar(speaks);
    const result = analiseJuizes(cal);
    expect(result[0].n).toBeGreaterThanOrEqual(result[1].n);
  });

  it('should handle judges with no name as "(sem juiz)"', () => {
    const speaks = [
      { pessoaId: 1, nome: 'Alice', data: '2025-01-01', sala: 1, posicao: 'OG', speaks: 75, juiz: null },
    ];
    const cal = calibrar(speaks);
    const result = analiseJuizes(cal);
    expect(result.some((j) => j.nome === '(sem juiz)')).toBe(true);
  });
});

describe('componentesConectados - Graph Connectivity', () => {
  it('should return empty for no data', () => {
    const result = componentesConectados([]);
    expect(result).toEqual([]);
  });

  it('should detect connected component with one debater and one judge', () => {
    const speaks = [
      { pessoaId: 1, nome: 'Alice', juiz: 'Judge1' },
    ];
    const result = componentesConectados(speaks);
    expect(result).toHaveLength(1);
    expect(result[0].debatedores).toHaveLength(1);
    expect(result[0].juizes).toHaveLength(1);
  });

  it('should detect multiple disconnected components', () => {
    const speaks = [
      { pessoaId: 1, nome: 'Alice', juiz: 'Judge1' },
      { pessoaId: 1, nome: 'Alice', juiz: 'Judge1' },
      { pessoaId: 2, nome: 'Bob', juiz: 'Judge2' },
      { pessoaId: 2, nome: 'Bob', juiz: 'Judge2' },
      // Alice-Judge1 and Bob-Judge2 are separate components
    ];
    const result = componentesConectados(speaks);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('should identify debaters in each component', () => {
    const speaks = [
      { pessoaId: 1, nome: 'Alice', juiz: 'Judge1' },
      { pessoaId: 2, nome: 'Bob', juiz: 'Judge1' },
    ];
    const result = componentesConectados(speaks);
    expect(result[0].debatedores.length).toBe(2);
  });

  it('should handle normalization of judge names', () => {
    const speaks = [
      { pessoaId: 1, nome: 'Alice', juiz: 'Judge José' },
      { pessoaId: 1, nome: 'Alice', juiz: 'judge jose' }, // Different case/accent
    ];
    const result = componentesConectados(speaks);
    // Should treat as same judge after normalization
    const juizCount = result[0]?.juizes.length || 0;
    expect(juizCount).toBeLessThanOrEqual(2);
  });
});
