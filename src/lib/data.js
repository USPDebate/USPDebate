// Lista do PS — constante, embutida (não precisa de request ao servidor).
export const NOMES_PS = [
  'Alanna Carriço Vilela', 'Álvaro Ribeiro Furtado', 'Ana Lara Rodrigues', 'Ana Luiza',
  'Annelyce maryanne de jesus', 'Aretha', 'Augusto Silva de Queiroz',
  'Beatriz Abrahão', 'Beatriz Custódio',
  'Caio Krüger Monteiro', 'Caio Massi de Souza', 'Carlos Eduardo Dutra Bodart',
  'Carolina Sacchetto da Silva', 'Cinthia Borelli',
  'Daniel Loureiro Rodrigues', 'Darlei Pamplona',
  'Eduardo Kohlsdorf', 'Enzo Augusto Federle Gemelli',
  'Felipe Barreto Távora', 'Felipe Gabriel Courel Souza',
  'Gabriel Grazia de Azambuja Villanova', 'Gabriel kenzo kobayashi',
  'Gabriela Espinhara Siqueira', 'Gabriela Risso Fernandes', 'Gabriela Saito Pereira',
  'Giuseppe Argenta Zaneti', 'Guilherme Mecenas Duarte', 'Gustavo Pettirossi',
  'Heitor Carlos Soares', 'Heloísa Viana Fonsêca', 'Henry Gabriel Lima da Silva',
  'Isabela Rebello Presgrave', 'Izabela de Caria Bertanha',
  'Jean Lima Neres', 'Jeissymirian Saraiva Barreto',
  'João Marcelo Silva Gomes', 'João Paulo Felipe Gonçalves',
  'João Pedro Rufino Sandamil', 'João Pedro Silveira Ferreira',
  'Julia Mendes Cosme', 'Julia Oliveira Rezende Coêlho', 'Julia Rangel Rosa Nasser',
  'Kaique Antunes', 'Kaique Lima Santos', 'Kleber Alves Henriques dos Santos',
  'Leonardo Carneiro Burlacchini de Carvalho', 'Lívia Dantas do Nascimento',
  'Lucas De Oliveira De Almeida',
  'Manuela Maria Martins Adriano', 'Manuela Reis Garin',
  'Manuella Félix Teodoro Magalhães e Souza', 'Marcela Fusco Pina',
  'Maria Eduarda Trimont Galhardo', 'Maria Vitória Rocha Veloso',
  'Maryane Feitoza', 'Mateus Torres Nery Figueiredo', 'Matheus Martins Trandafilov',
  'Max Vaz de Sousa Leite',
  'Nicolas Fagundes Justi Muniz', 'Nícolas Marques Preto',
  'Pedro Antônio Almeida e Nogueira', 'Pedro da Costa Silva',
  'Pedro dos Santos Pereira', 'Pedro Henrique G. Candido',
  'Rafael Noia Meira do Nascimento', 'Saulo Domingos Lima', 'Sofia Mendes Nery Costa',
  'Thiago Fernando Martins Gomes', 'Tomas Wolffenbüttel',
  'Victor Souza Santos', 'Wesley Santos', 'Yasmim Nobre de Oliveira',
].sort((a, b) => a.localeCompare(b, 'pt-BR'));

export function norm(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
