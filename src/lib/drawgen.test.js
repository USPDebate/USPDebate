import { gerarSalas } from './drawgen';

describe('gerarSalas - Draw Generation', () => {
  it('should handle empty input', () => {
    const result = gerarSalas([]);
    expect(result).toEqual([]);
  });

  it('should handle single person', () => {
    const pessoas = [{ nome: 'Alice', dupla: null }];
    const result = gerarSalas(pessoas);
    expect(result).toHaveLength(1);
    expect(result[0].incompleta).toBe(true);
  });

  it('should pair two unpaired people', () => {
    const pessoas = [
      { nome: 'Alice', dupla: null },
      { nome: 'Bob', dupla: null },
    ];
    const result = gerarSalas(pessoas);
    expect(result).toHaveLength(1);
    expect(result[0].numero).toBe(1);
    expect(result[0].posicoes).toHaveLength(1);
    // O sorteio embaralha — a ordem Alice/Bob não é determinística.
    expect([result[0].posicoes[0].p1, result[0].posicoes[0].p2].sort()).toEqual(['Alice', 'Bob']);
    expect(result[0].posicoes[0].confirmado).toBe(false);
  });

  it('should respect mutual pairs', () => {
    const pessoas = [
      { nome: 'Alice', dupla: 'Bob' },
      { nome: 'Bob', dupla: 'Alice' },
      { nome: 'Charlie', dupla: null },
      { nome: 'Diana', dupla: null },
    ];
    const result = gerarSalas(pessoas);
    expect(result).toHaveLength(1);
    const rooms = result[0];
    expect(rooms.posicoes).toHaveLength(2);

    // First position should have Alice and Bob (the confirmed pair)
    const aliceBob = rooms.posicoes.find((p) =>
      (p.p1 === 'Alice' && p.p2 === 'Bob') || (p.p1 === 'Bob' && p.p2 === 'Alice')
    );
    expect(aliceBob).toBeDefined();
    expect(aliceBob.confirmado).toBe(true);
  });

  it('should create exactly numSalas rooms for 8*n people', () => {
    const pessoas = Array.from({ length: 16 }, (_, i) => ({
      nome: `Person${i}`,
      dupla: null,
    }));
    const result = gerarSalas(pessoas);
    expect(result).toHaveLength(2); // 16 / 8 = 2 salas
    expect(result[0].numero).toBe(1);
    expect(result[1].numero).toBe(2);
  });

  it('should create incomplete room for leftover people', () => {
    const pessoas = Array.from({ length: 10 }, (_, i) => ({
      nome: `Person${i}`,
      dupla: null,
    }));
    const result = gerarSalas(pessoas);
    expect(result).toHaveLength(2); // 1 full room + 1 incomplete
    expect(result[0].incompleta).toBe(false);
    expect(result[1].incompleta).toBe(true);
  });

  it('should order positions within each room (OG, OO, CG, CO)', () => {
    const pessoas = Array.from({ length: 8 }, (_, i) => ({
      nome: `Person${i}`,
      dupla: null,
    }));
    const result = gerarSalas(pessoas);
    const room = result[0];
    expect(room.posicoes[0].posicao).toBe('OG');
    expect(room.posicoes[1].posicao).toBe('OO');
    expect(room.posicoes[2].posicao).toBe('CG');
    expect(room.posicoes[3].posicao).toBe('CO');
  });

  it('should handle odd number of unpaired people', () => {
    const pessoas = Array.from({ length: 9 }, (_, i) => ({
      nome: `Person${i}`,
      dupla: null,
    }));
    const result = gerarSalas(pessoas);
    expect(result).toHaveLength(2);
    // Second room should be incomplete with one person alone
    const lastRoom = result[result.length - 1];
    expect(lastRoom.incompleta).toBe(true);
    const lastPos = lastRoom.posicoes[lastRoom.posicoes.length - 1];
    expect(lastPos.p2).toContain('sem par');
  });

  it('should handle unilateral pairs', () => {
    const pessoas = [
      { nome: 'Alice', dupla: 'Bob' },
      { nome: 'Bob', dupla: null }, // Bob doesn't reciprocate
      { nome: 'Charlie', dupla: null },
      { nome: 'Diana', dupla: null },
    ];
    const result = gerarSalas(pessoas);
    expect(result).toHaveLength(1);
    const aliceBob = result[0].posicoes.find((p) =>
      (p.p1 === 'Alice' && p.p2 === 'Bob') || (p.p1 === 'Bob' && p.p2 === 'Alice')
    );
    expect(aliceBob).toBeDefined();
  });

  it('should normalize names when matching pairs (ignoring case/accents)', () => {
    const pessoas = [
      { nome: 'Alice', dupla: 'bób' },
      { nome: 'Bób', dupla: 'alice' },
    ];
    const result = gerarSalas(pessoas);
    expect(result).toHaveLength(1);
    const pair = result[0].posicoes[0];
    expect(pair.confirmado).toBe(true);
  });

  it('should create rooms with all valid positions filled', () => {
    const pessoas = Array.from({ length: 24 }, (_, i) => ({
      nome: `Person${i}`,
      dupla: null,
    }));
    const result = gerarSalas(pessoas);
    expect(result).toHaveLength(3); // 24 / 8 = 3

    result.forEach((room) => {
      expect(room.posicoes.length).toBeGreaterThan(0);
      room.posicoes.forEach((pos) => {
        expect(pos.posicao).toMatch(/^(OG|OO|CG|CO)$/);
        expect(pos.p1).toBeDefined();
        expect(pos.p2).toBeDefined();
        expect(pos.confirmado).toEqual(expect.any(Boolean));
      });
    });
  });

  it('should never have duplicate people in the same draw', () => {
    const pessoas = Array.from({ length: 20 }, (_, i) => ({
      nome: `Person${i}`,
      dupla: null,
    }));
    const result = gerarSalas(pessoas);

    const allNames = new Set();
    result.forEach((room) => {
      room.posicoes.forEach((pos) => {
        if (pos.p1 && !pos.p1.includes('sem par')) allNames.add(pos.p1);
        if (pos.p2 && !pos.p2.includes('sem par')) allNames.add(pos.p2);
      });
    });

    expect(allNames.size).toBe(20);
  });
});
